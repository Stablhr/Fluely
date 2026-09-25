'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Eye, EyeOff, Trash2, Archive, Check, RotateCcw, MoreHorizontal, ArrowRight } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'
import CardDescription from './CardDescription'
import CardLabels from './CardLabels'
import CardMembers from './CardMembers'
import CardDueDate from './CardDueDate'
import CardLocation from './CardLocation'
import CardCover from './CardCover'
import CardAttachments from './CardAttachments'
import CardComments from './CardComments'
import CardActivity from './CardActivity'
import CoverPanel from './CoverPanel'
import MoveCardDialog from './MoveCardDialog'
import CardSocialPosts from '../social/CardSocialPosts'

interface CardModalProps {
  cardId: string
  onClose: () => void
}

export default function CardModal({ cardId, onClose }: CardModalProps) {
  const { data, updateCard, addActivity, deleteCard, archiveCard, toggleDone } = useStore()
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [coverPanelOpen, setCoverPanelOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!overflowOpen) return
    const onDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [overflowOpen])

  const card = data.cards[cardId]
  if (!card) return null
  const board = data.boards[card.boardId]
  const list = data.lists[card.listId]
  if (!board || !list) return null

  const commitTitle = () => {
    setEditingTitle(false)
    const t = title.trim()
    if (t && t !== card.title) {
      updateCard(card.id, { title: t })
      addActivity(card.id, 'renamed this card')
    }
  }

  const toggleWatch = () => {
    updateCard(card.id, { watching: !card.watching })
    addActivity(card.id, card.watching ? 'stopped watching this card' : 'started watching this card')
  }

  const handleDelete = () => {
    if (window.confirm(`Delete "${card.title}"? This cannot be undone.`)) {
      deleteCard(card.id)
      onClose()
    }
  }

  const handleArchive = () => {
    archiveCard(card.id)
    setOverflowOpen(false)
    onClose()
  }

  return (
    <Modal open onClose={onClose} className="max-w-2xl max-h-[85vh] sm:max-h-[80vh] h-full">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close card"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-subtle transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary active:scale-[0.98] sm:right-4 sm:top-4"
        >
          <X size={18} />
        </button>

        {/* Scrollable area: cover + content */}
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {card.cover && (
            <div className={`w-full ${card.coverSize === 'large' ? 'h-48' : typeof card.cover === 'string' ? 'h-28' : 'h-16'}`}>
              {typeof card.cover === 'string' ? (
                <div
                  className="h-full w-full"
                  style={{ background: card.cover as string }}
                />
              ) : (
                <img src={card.cover.dataUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          )}

          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitTitle()
                      if (e.key === 'Escape') {
                        setTitle(card.title)
                        setEditingTitle(false)
                      }
                    }}
                    onBlur={commitTitle}
                    autoFocus
                    className="w-full rounded-md px-2 py-1 text-[20px] font-semibold leading-snug text-text-primary outline-none ring-2 ring-primary/30"
                  />
                ) : (
                  <h2
                    onClick={() => {
                      setTitle(card.title)
                      setEditingTitle(true)
                    }}
                    title="Click to rename"
                    className="cursor-text break-words rounded-md px-2 py-1 text-[20px] font-semibold leading-snug text-text-primary transition-colors duration-150 hover:bg-surface-alt"
                  >
                    {card.title}
                  </h2>
                )}
                <p className="mt-0.5 px-2 text-xs text-text-secondary">
                  in list{' '}
                  <span className="font-medium text-primary-hover">{list.name}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleDone(card.id)}
                title={card.done ? 'Mark as not done' : 'Mark as done'}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.98] sm:px-2.5 ${
                  card.done
                    ? 'bg-success text-white'
                    : 'bg-surface-alt text-text-secondary hover:bg-success-subtle hover:text-success-text'
                }`}
              >
                {card.done ? <RotateCcw size={14} /> : <Check size={14} />}
                <span className="hidden sm:inline">{card.done ? 'Reopen' : 'Mark as done'}</span>
              </button>

              <button
                type="button"
                onClick={toggleWatch}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors duration-150 active:scale-[0.98] sm:px-2.5 ${
                  card.watching
                    ? 'bg-primary-subtle text-primary-hover'
                    : 'bg-surface-alt text-text-secondary hover:bg-primary-subtle hover:text-primary-hover'
                }`}
              >
                {card.watching ? <Eye size={14} /> : <EyeOff size={14} />}
                <span className="hidden sm:inline">{card.watching ? 'Watching' : 'Watch'}</span>
              </button>

              {/* Overflow menu */}
              <div className="relative shrink-0" ref={overflowRef}>
                <button
                  type="button"
                  onClick={() => setOverflowOpen((o) => !o)}
                  title="More actions"
                  aria-expanded={overflowOpen}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary active:scale-[0.98]"
                >
                  <MoreHorizontal size={16} />
                </button>
                {overflowOpen && (
                  <div className="animate-in absolute right-0 top-9 z-30 w-52 rounded-lg border border-border-strong bg-surface-elevated py-1 shadow-subtle">
                    <div className="px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOverflowOpen(false)
                        setMoveDialogOpen(true)
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
                    >
                      <ArrowRight size={14} className="text-text-secondary" />
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
                    >
                      <Archive size={14} className="text-text-secondary" />
                      Archive
                    </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 sm:mt-5 sm:gap-7 md:grid-cols-[1fr_220px]">
              <div className="min-w-0 space-y-6">
                <CardDescription card={card} />
                <CardAttachments card={card} />
                <CardComments card={card} />
              </div>

              <aside className="min-w-0 space-y-5">
                <CardLabels card={card} />
                <CardMembers card={card} />
                <CardDueDate card={card} />
                <CardLocation card={card} />
                <CardCover card={card} onOpenPanel={() => setCoverPanelOpen(true)} />
                <CardSocialPosts cardId={card.id} />
              </aside>
            </div>

            <div className="mt-7 border-t border-border pt-4">
              <CardActivity card={card} />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-danger-text transition-colors duration-150 hover:bg-danger-subtle active:scale-[0.98]"
              >
                <Trash2 size={14} />
                Delete card
              </button>
            </div>
          </div>
        </div>
      </div>

      <CoverPanel card={card} open={coverPanelOpen} onClose={() => setCoverPanelOpen(false)} />
      {moveDialogOpen && <MoveCardDialog card={card} onClose={() => setMoveDialogOpen(false)} />}
    </Modal>
  )
}
