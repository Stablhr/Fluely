'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Eye, EyeOff, Trash2, Archive, Check, RotateCcw, MoreHorizontal, ArrowRight, ImageIcon } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import Modal from '../shared/Modal'
import CardDescription from './CardDescription'
import CardLabels from './CardLabels'
import CardMembers from './CardMembers'
import CardDueDate from './CardDueDate'
import CardLocation from './CardLocation'
import CardAttachments from './CardAttachments'
import CardComments from './CardComments'
import ImageViewer, { type ViewerImage } from './ImageViewer'
import { deleteMedia } from '@/lib/api/mediaApi'
import CardActivity from './CardActivity'
import CardCover from './CardCover'
import CoverPanel from './CoverPanel'

import MoveCardDialog from './MoveCardDialog'
import CardSocialPosts from '../social/CardSocialPosts'

interface CardModalProps {
  cardId: string
  highlightCommentId?: string | null
  onClose: () => void
}

export default function CardModal({ cardId, highlightCommentId, onClose }: CardModalProps) {
  const { data, updateCard, addActivity, deleteCard, archiveCard, toggleDone, canWrite } = useStore()
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerStart, setViewerStart] = useState(0)
  const [viewerTrigger, setViewerTrigger] = useState<HTMLElement | null>(null)

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

  // A viewer gets a read-only card: the editors below would otherwise accept
  // input that the store guard silently drops.
  const mayWrite = canWrite(card.boardId)

  const viewerImages: ViewerImage[] = []
  if (card.cover && typeof card.cover !== 'string' && card.cover.type === 'image') {
    const url = card.cover.dataUrl
    const att = card.files.find((f) => f.type === 'image' && f.dataUrl === url)
    viewerImages.push({
      url,
      name: att?.name ?? url.split('/').pop() ?? 'cover.jpg',
      size: att?.size ?? 0,
      mimeType: att?.mimeType,
      addedAt: att?.addedAt ?? card.updatedAt,
      isCover: true,
      mediaId: card.cover.mediaId ?? att?.mediaId,
      publicId: att?.publicId,
    })
  }
  for (const f of card.files) {
    if (f.type !== 'image') continue
    if (viewerImages.some((v) => v.url === f.dataUrl)) continue
    viewerImages.push({
      url: f.dataUrl,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      addedAt: f.addedAt,
      isCover: false,
      mediaId: f.mediaId,
      publicId: f.publicId,
    })
  }

  const openViewerAt = (url: string, trigger: HTMLElement | null) => {
    const idx = viewerImages.findIndex((v) => v.url === url)
    setViewerStart(idx >= 0 ? idx : 0)
    setViewerTrigger(trigger)
    setViewerOpen(true)
  }

  const handleRemoveCoverFromViewer = () => {
    updateCard(card.id, { cover: null, coverSize: 'large' })
    addActivity(card.id, 'removed the cover')
    setViewerOpen(false)
  }

  const handleDeleteFromViewer = async (img: ViewerImage) => {
    const isActiveCover =
      card.cover !== null &&
      typeof card.cover !== 'string' &&
      (card.cover.type === 'image' || card.cover.type === 'video') &&
      card.cover.dataUrl === img.url
    const attachment = card.files.find((f) => f.dataUrl === img.url)
    updateCard(card.id, {
      files: card.files.filter((f) => f.dataUrl !== img.url),
      ...(isActiveCover ? { cover: null } : {}),
    })
    addActivity(card.id, `removed ${img.name}`)
    if (attachment?.mediaId) {
      try {
        await deleteMedia(attachment.mediaId)
      } catch {
        // best-effort
      }
    }
  }

  const closeViewer = () => {
    setViewerOpen(false)
    // return focus to the trigger
    setTimeout(() => viewerTrigger?.focus(), 0)
  }

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
              ) : card.cover.type === 'video' ? (
                <video
                  src={card.cover.dataUrl}
                  className="h-full w-full bg-black object-cover"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => openViewerAt(card.cover && typeof card.cover !== 'string' ? card.cover.dataUrl : '', e.currentTarget)}
                  className="group relative block h-full w-full cursor-zoom-in overflow-hidden"
                  aria-label="View cover image"
                >
                  <img
                    src={card.cover.dataUrl}
                    alt=""
                    className="h-full w-full object-cover transition-[filter] duration-150 group-hover:brightness-90"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <span className="rounded-full bg-black/50 p-2 text-white">
                      <ImageIcon size={18} />
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                {editingTitle && mayWrite ? (
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
                      if (!mayWrite) return
                      setTitle(card.title)
                      setEditingTitle(true)
                    }}
                    title={mayWrite ? 'Click to rename' : card.title}
                    className={`break-words rounded-md px-2 py-1 text-[20px] font-semibold leading-snug text-text-primary transition-colors duration-150 ${
                      mayWrite ? 'cursor-text hover:bg-surface-alt' : ''
                    }`}
                  >
                    {card.title}
                  </h2>
                )}
                <p className="mt-0.5 px-2 text-xs text-text-secondary">
                  in list{' '}
                  <span className="font-medium text-primary-hover">{list.name}</span>
                </p>
              </div>

              {mayWrite && (
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
              )}

              {mayWrite && (
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
              )}

              {/* Overflow menu */}
              {mayWrite && (
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
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 sm:mt-5 sm:gap-7 md:grid-cols-[1fr_220px]">
              <div className="min-w-0 space-y-6">
                <CardDescription card={card} readOnly={!mayWrite} />
                <CardAttachments
                  card={card}
                  readOnly={!mayWrite}
                  onViewImage={(att, trigger) => openViewerAt(att.dataUrl, trigger)}
                />
                <CardComments card={card} readOnly={!mayWrite} highlightCommentId={highlightCommentId} />
              </div>

              <aside className="min-w-0 space-y-5">
                <CardLabels card={card} readOnly={!mayWrite} />
                <CardMembers card={card} readOnly={!mayWrite} />
                <CardDueDate card={card} readOnly={!mayWrite} />
                <CardLocation card={card} readOnly={!mayWrite} />
                <CardCover
                  card={card}
                  readOnly={!mayWrite}
                  onOpenPanel={() => setCoverOpen(true)}
                />
                <CardSocialPosts cardId={card.id} />
              </aside>
            </div>

            <div className="mt-7 border-t border-border pt-4">
              <CardActivity card={card} />
            </div>

            {mayWrite && (
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
            )}
          </div>
        </div>
      </div>

      {moveDialogOpen && mayWrite && <MoveCardDialog card={card} onClose={() => setMoveDialogOpen(false)} />}
      <CoverPanel
        card={card}
        open={coverOpen}
        onClose={() => setCoverOpen(false)}
      />
      {viewerOpen && viewerImages.length > 0 && (
        <ImageViewer
          images={viewerImages}
          startIndex={viewerStart}
          canEdit={mayWrite}
          onClose={closeViewer}
          onRemoveCover={handleRemoveCoverFromViewer}
          onDelete={handleDeleteFromViewer}
        />
      )}
    </Modal>
  )
}
