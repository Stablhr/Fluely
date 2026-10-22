'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, List as ListIcon } from 'lucide-react'
import { useToast } from '../shared/useToastState'

export interface MoveToListTarget {
  id: string
  name: string
  /** How many cards the list currently holds. */
  count: number
}

export interface MoveToListResult {
  ok: boolean
  error?: string
  /** Where the card came from, so the caller can undo the move. */
  previous?: { listId: string; index: number }
}

interface MoveToListMenuProps {
  cardId: string
  /** The list the card is in right now. */
  currentListId: string
  /** Every list on the board, in board order, archived ones excluded. */
  lists: MoveToListTarget[]
  /** Whether the signed-in person may move the card. */
  canEdit: boolean
  /** Performs the move. Resolves with the outcome so failures can be reported. */
  onMove: (
    listId: string,
    options?: { index?: number },
  ) => MoveToListResult | Promise<MoveToListResult>
}

const MENU_WIDTH = 240
const MENU_MAX_HEIGHT = 288
const TRIGGER_MAX_NAME = 18

/**
 * The "move to list" control in the card modal's top-left corner.
 *
 * It mirrors the close button on the other side: a frosted pill that stays
 * readable on top of any cover image. The menu itself is rendered in a portal
 * so the modal's overflow cannot clip it, and it is anchored below the
 * trigger, flipping upward when there is not enough room underneath.
 */
export default function MoveToListMenu({
  cardId,
  currentListId,
  lists,
  canEdit,
  onMove,
}: MoveToListMenuProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<{ top: number; left: number; flip: boolean } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const current = lists.find((l) => l.id === currentListId)
  const currentName = current?.name ?? 'List'

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    setActiveIndex(-1)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const select = useCallback(
    async (target: MoveToListTarget) => {
      if (target.id === currentListId) {
        close()
        return
      }

      const result = await onMove(target.id)
      if (!result.ok) {
        toast(result.error ?? 'Could not move that card.', 'error')
        return
      }
      close(false)
      const previous = result.previous
      toast(`Moved to "${target.name}"`, 'success', {
        duration: 5000,
        action: previous
          ? {
              label: 'Undo',
              onClick: () => {
                void onMove(previous.listId, { index: previous.index })
              },
            }
          : undefined,
      })
    },
    [currentListId, onMove, close, toast],
  )

  /** Where the portal menu should sit, given the trigger's box. */
  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const flip = spaceBelow < Math.min(MENU_MAX_HEIGHT, spaceAbove) && spaceAbove > spaceBelow
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - MENU_WIDTH - 12),
    )
    setPosition({
      top: flip ? rect.top - 8 : rect.bottom + 8,
      left,
      flip,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const onChange = () => measure()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [open, measure])

  // A click anywhere outside the trigger and the menu dismisses it.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, close])

  // Keyboard handling lives on the window in the capture phase so Escape
  // closes only this menu: the card modal listens for Escape too, and it must
  // stay open underneath.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      }
      if (e.key === 'Tab') {
        close(false)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => {
          if (lists.length === 0) return -1
          const delta = e.key === 'ArrowDown' ? 1 : -1
          const next = prev + delta
          if (next < 0) return lists.length - 1
          if (next >= lists.length) return 0
          return next
        })
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        const target = lists[activeIndex]
        if (!target) return
        e.preventDefault()
        e.stopPropagation()
        void select(target)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, lists, activeIndex, close, select])

  const truncated =
    currentName.length > TRIGGER_MAX_NAME
      ? `${currentName.slice(0, TRIGGER_MAX_NAME - 1)}…`
      : currentName

  const pillClass =
    'inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-semibold text-text-primary shadow-subtle backdrop-blur transition-colors duration-150 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'

  return (
    <>
      {canEdit ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              setOpen(true)
              setActiveIndex(0)
            }
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="move-to-list-menu"
          title={currentName}
          className={pillClass}
        >
          <ListIcon size={13} className="shrink-0 text-text-secondary" />
          <span className="truncate font-heading">{truncated}</span>
          <ChevronDown size={13} className="shrink-0 text-text-secondary" />
        </button>
      ) : (
        <span
          title={currentName}
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-semibold text-text-primary shadow-subtle backdrop-blur"
        >
          <ListIcon size={13} className="shrink-0 text-text-secondary" />
          <span className="truncate font-heading">{truncated}</span>
        </span>
      )}

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            id="move-to-list-menu"
            role="menu"
            aria-label="Move to list"
            aria-activedescendant={
              activeIndex >= 0 ? `move-to-list-item-${activeIndex}` : undefined
            }
            style={{
              position: 'fixed',
              top: position.flip ? undefined : position.top,
              bottom: position.flip ? window.innerHeight - position.top : undefined,
              left: position.left,
              width: MENU_WIDTH,
              maxHeight: MENU_MAX_HEIGHT,
            }}
            className="z-[60] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-medium"
          >
            <div className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
              Move to list
            </div>
            {lists.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-text-muted">No lists on this board.</p>
            ) : (
              lists.map((list, index) => {
                const isCurrent = list.id === currentListId
                return (
                  <button
                    key={list.id}
                    id={`move-to-list-item-${index}`}
                    type="button"
                    role="menuitem"
                    aria-current={isCurrent ? 'true' : undefined}
                    disabled={isCurrent}
                    onClick={() => void select(list)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors duration-150 ${
                      isCurrent
                        ? 'cursor-default bg-primary-subtle font-semibold text-primary-hover'
                        : activeIndex === index
                          ? 'bg-surface-alt text-text-primary'
                          : 'text-text-primary hover:bg-surface-alt'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-body">{list.name}</span>
                    <span className="shrink-0 text-xs text-text-muted">· {list.count}</span>
                    {isCurrent && <Check size={14} className="shrink-0 text-primary-hover" />}
                  </button>
                )
              })
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
