'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Share2,
  Info,
  Eye,
  Printer,
  Star,
  Settings,
  Palette,
  Tag,
  Copy,
  Activity,
  Archive,
  Trash2,
} from 'lucide-react'
import type { Board } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import ShareModal from './ShareModal'
import VisibilityModal from './VisibilityModal'
import LabelsModal from './LabelsModal'
import ArchivedPanel from './ArchivedPanel'
import ExportPrintModal from './ExportPrintModal'
import SettingsModal from './SettingsModal'
import BackgroundPickerPopover from './BackgroundPickerPopover'
import BoardActivityPanel from './BoardActivityPanel'

type DrawerModal =
  | 'share'
  | 'visibility'
  | 'labels'
  | 'archived'
  | 'exportPrint'
  | 'settings'
  | 'activity'
  | null

export default function BoardMenuDrawer({
  board,
  open,
  onClose,
}: {
  board: Board
  open: boolean
  onClose: () => void
}) {
  const { data, setBoardDescription, toggleStar, resetAll, deleteBoard, makeTemplate } = useStore()
  const router = useRouter()
  const [modal, setModal] = useState<DrawerModal>(null)
  const [desc, setDesc] = useState(board.description)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const [templateConfirm, setTemplateConfirm] = useState(false)

  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDesc(board.description)
      setAboutOpen(false)
      setBgOpen(false)
      setTemplateConfirm(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const archivedCardCount = Object.values(data.cards).filter(
    (c) => c.boardId === board.id && c.archived,
  ).length
  const archivedListCount = (board.archivedLists ?? []).length

  const menuItem =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt'

  const handleDeleteBoard = () => {
    if (window.confirm(`Delete "${board.name}"? All lists and cards on it will be removed. This cannot be undone.`)) {
      deleteBoard(board.id)
      router.push('/boards')
    }
  }

  const handleReset = () => {
    if (
      window.confirm(
        'Reset ALL app data? This clears every board, card, and inbox item on this device. This cannot be undone.',
      )
    ) {
      resetAll()
      router.push('/')
    }
  }

  const handleMakeTemplate = () => {
    const newId = makeTemplate(board.id)
    if (newId) {
      onClose()
      router.push(`/boards/${newId}`)
    }
  }

  const visibilityLabel = {
    private: 'Private',
    workspace: 'Workspace',
    public: 'Public',
  }[board.visibility]

  const members = board.shares ?? []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-brand-ink/50" onClick={onClose} />
      <aside className="animate-in fixed bottom-0 right-0 top-0 z-40 flex w-full flex-col border-l border-border bg-surface-elevated shadow-medium sm:bottom-auto sm:w-72">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">Menu</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X size={16} />
          </button>
        </div>

        <div className="scroll-slim flex-1 overflow-y-auto p-4">
          {/* ── Group 1 ── */}
          <section className="space-y-0.5">
            {/* Share */}
            <button type="button" className={menuItem} onClick={() => setModal('share')}>
              <Share2 size={15} className="text-text-secondary" />
              <span className="flex-1">Share</span>
              {members.length > 0 && (
                <div className="flex -space-x-1.5">
                  {members.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground ring-2 ring-surface-elevated"
                    >
                      {s.name.charAt(0)}
                    </span>
                  ))}
                  {members.length > 3 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-alt text-[8px] font-bold text-text-secondary ring-2 ring-surface-elevated">
                      +{members.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* About this board */}
            <button
              type="button"
              className={menuItem}
              onClick={() => setAboutOpen((o) => !o)}
            >
              <Info size={15} className="text-text-secondary" />
              <span className="flex-1 text-left">About this board</span>
            </button>
            {aboutOpen && (
              <div className="ml-7 mr-2.5 mb-1">
                <textarea
                  value={desc}
                  onChange={(e) => {
                    setDesc(e.target.value)
                    setBoardDescription(board.id, e.target.value)
                  }}
                  rows={3}
                  placeholder="Add a description to your board"
                  className="w-full resize-none rounded-md border border-border-strong bg-surface px-2.5 py-2 text-sm leading-relaxed text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {board.description && (
                  <p className="mt-1 truncate text-xs text-text-muted">{board.description}</p>
                )}
              </div>
            )}

            {/* Visibility */}
            <button type="button" className={menuItem} onClick={() => setModal('visibility')}>
              <Eye size={15} className="text-text-secondary" />
              <span className="flex-1">Visibility: {visibilityLabel}</span>
            </button>

            {/* Print, export, and share */}
            <button type="button" className={menuItem} onClick={() => setModal('exportPrint')}>
              <Printer size={15} className="text-text-secondary" />
              <span className="flex-1">Print, export, and share</span>
            </button>

            {/* Star */}
            <button
              type="button"
              className={menuItem}
              onClick={() => toggleStar(board.id)}
            >
              <Star
                size={15}
                className={board.starred ? 'text-warning fill-warning' : 'text-text-secondary'}
              />
              <span className="flex-1">{board.starred ? 'Starred' : 'Star'}</span>
            </button>
          </section>

          <div className="my-3 h-px bg-border" />

          {/* ── Group 2 ── */}
          <section className="space-y-0.5">
            {/* Settings */}
            <button type="button" className={menuItem} onClick={() => setModal('settings')}>
              <Settings size={15} className="text-text-secondary" />
              <span className="flex-1">Settings</span>
            </button>

            {/* Change background */}
            <div className="relative">
              <button type="button" className={menuItem} onClick={() => setBgOpen((o) => !o)}>
                <Palette size={15} className="text-text-secondary" />
                <span className="flex-1">Change background</span>
              </button>
              {bgOpen && (
                <BackgroundPickerPopover
                  boardId={board.id}
                  onClose={() => setBgOpen(false)}
                />
              )}
            </div>
          </section>

          <div className="my-3 h-px bg-border" />

          {/* ── Group 3 ── */}
          <section className="space-y-0.5">
            {/* Labels */}
            <button type="button" className={menuItem} onClick={() => setModal('labels')}>
              <Tag size={15} className="text-text-secondary" />
              <span className="flex-1">Labels</span>
            </button>

            {/* Make template */}
            <div>
              <button
                type="button"
                className={menuItem}
                onClick={() => setTemplateConfirm((o) => !o)}
              >
                <Copy size={15} className="text-text-secondary" />
                <span className="flex-1">Make template</span>
              </button>
              {templateConfirm && (
                <div className="ml-7 mr-2.5 mb-1 rounded-md bg-surface-alt p-2.5">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Creates a copy of this board&apos;s lists and labels, without cards.
                  </p>
                  <button
                    type="button"
                    onClick={handleMakeTemplate}
                    className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98]"
                  >
                    Make template
                  </button>
                </div>
              )}
            </div>

            {/* Activity */}
            <button type="button" className={menuItem} onClick={() => setModal('activity')}>
              <Activity size={15} className="text-text-secondary" />
              <span className="flex-1">Activity</span>
            </button>

            {/* Archived items */}
            <button type="button" className={menuItem} onClick={() => setModal('archived')}>
              <Archive size={15} className="text-text-secondary" />
              <span className="flex-1">Archived items</span>
              {(archivedCardCount > 0 || archivedListCount > 0) && (
                <span className="rounded-full bg-surface-alt px-1.5 py-0.5 font-mono text-[10.5px] text-text-secondary">
                  {archivedCardCount + archivedListCount}
                </span>
              )}
            </button>
          </section>

          <div className="my-3 h-px bg-border" />

          {/* ── Danger zone ── */}
          <section className="space-y-0.5">
            <button
              type="button"
              onClick={handleDeleteBoard}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-danger-text transition-colors duration-150 hover:bg-danger-subtle"
            >
              <Trash2 size={15} />
              Delete board
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-danger-text transition-colors duration-150 hover:bg-danger-subtle"
            >
              <Trash2 size={15} />
              Reset all data
            </button>
          </section>
        </div>
      </aside>

      {modal === 'share' && <ShareModal board={board} onClose={() => setModal(null)} />}
      {modal === 'visibility' && <VisibilityModal board={board} onClose={() => setModal(null)} />}
      {modal === 'labels' && <LabelsModal board={board} onClose={() => setModal(null)} />}
      {modal === 'archived' && <ArchivedPanel board={board} onClose={() => setModal(null)} />}
      {modal === 'exportPrint' && <ExportPrintModal board={board} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal board={board} onClose={() => setModal(null)} />}
      {modal === 'activity' && <BoardActivityPanel board={board} onClose={() => setModal(null)} />}
    </>
  )
}
