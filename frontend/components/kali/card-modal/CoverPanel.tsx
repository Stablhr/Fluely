'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ImageIcon, AlertTriangle } from 'lucide-react'
import type { Card, FileAttachment } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatSize } from '@/lib/kali/utils/format'
import { MAX_FILE_SIZE } from './CardAttachments'

interface CoverPanelProps {
  card: Card
  open: boolean
  onClose: () => void
}

export default function CoverPanel({ card, open, onClose }: CoverPanelProps) {
  const store = useStore()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const imageCoverUrl = card.cover !== null && typeof card.cover !== 'string' ? card.cover.dataUrl : null
  const activeColor = typeof card.cover === 'string' ? card.cover : null
  const imageAttachments = card.files.filter((f) => f.type === 'image')

  const setCoverSize = (size: 'large' | 'small') => {
    store.updateCard(card.id, { coverSize: size })
    store.addActivity(card.id, 'changed cover size')
  }

  const removeCover = () => {
    store.updateCard(card.id, { cover: null, coverSize: 'small' })
    store.addActivity(card.id, 'removed the cover')
  }

  const setImageCover = (attachment: FileAttachment) => {
    store.updateCard(card.id, {
      cover: { type: 'image', dataUrl: attachment.dataUrl },
    })
    store.addActivity(card.id, 'changed the cover image')
  }

  const uploadCover = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError(`"${file.name}" is ${formatSize(file.size)} — keep cover images under 2 MB.`)
      return
    }
    setUploading(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const attachment: FileAttachment = {
        id: uid(),
        name: file.name,
        type: 'image',
        dataUrl,
        size: file.size,
        addedAt: new Date().toISOString(),
      }
      store.updateCard(card.id, {
        files: [...card.files, attachment],
        cover: { type: 'image', dataUrl },
        coverSize: card.coverSize || 'small',
      })
      store.addActivity(card.id, `attached ${file.name} as cover`)
      setUploading(false)
    }
    reader.onerror = () => setUploading(false)
    reader.readAsDataURL(file)
  }

  const sectionTitle =
    'text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0f1a19]/50" onClick={onClose} />
      <aside className="animate-in fixed bottom-0 right-0 top-0 z-40 flex w-full flex-col border-l border-border bg-surface-elevated shadow-medium sm:bottom-auto sm:w-80">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">Cover</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cover panel"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="scroll-slim flex-1 overflow-y-auto p-4 space-y-5">
          {/* Size */}
          <section>
            <p className={sectionTitle}>Size</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setCoverSize('large')}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2.5 transition-colors duration-150 active:scale-[0.98] ${
                  card.coverSize === 'large'
                    ? 'bg-primary-subtle ring-2 ring-primary'
                    : 'ring-1 ring-border hover:ring-primary'
                }`}
              >
                <div className="h-16 w-12 rounded-lg bg-surface-alt overflow-hidden">
                  {imageCoverUrl ? (
                    <img src={imageCoverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: activeColor ?? '#0DABA3' }}
                    />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-text-secondary">Large</span>
              </button>
              <button
                type="button"
                onClick={() => setCoverSize('small')}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2.5 transition-colors duration-150 active:scale-[0.98] ${
                  card.coverSize === 'small'
                    ? 'bg-primary-subtle ring-2 ring-primary'
                    : 'ring-1 ring-border hover:ring-primary'
                }`}
              >
                <div className="h-4 w-12 rounded-lg overflow-hidden">
                  {imageCoverUrl ? (
                    <img src={imageCoverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: activeColor ?? '#0DABA3' }}
                    />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-text-secondary">Small</span>
              </button>
            </div>
          </section>

          {/* Remove cover */}
          {card.cover && (
            <button
              type="button"
              onClick={removeCover}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:text-danger-text"
            >
              <X size={12} />
              Remove cover
            </button>
          )}

          {/* Attachments */}
          <section>
            <p className={sectionTitle}>Attachments</p>
            {imageAttachments.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">No image attachments yet.</p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {imageAttachments.map((att) => {
                  const isActiveCover =
                    imageCoverUrl !== null && imageCoverUrl === att.dataUrl
                  return (
                    <button
                      key={att.id}
                      type="button"
                      title={att.name}
                      onClick={() => setImageCover(att)}
                      className={`relative aspect-square overflow-hidden rounded-lg transition-transform duration-150 active:scale-[0.98] ${
                        isActiveCover
                          ? 'ring-2 ring-primary ring-offset-1'
                          : 'ring-1 ring-border hover:ring-primary'
                      }`}
                    >
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="h-full w-full object-cover"
                      />
                      {isActiveCover && (
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">
                          Cover
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Upload */}
          <section>
            <p className={sectionTitle}>Upload a cover image</p>
            {error && (
              <p className="animate-in mt-2 flex items-center gap-1.5 rounded-md bg-danger-subtle px-3 py-2 text-xs font-medium text-danger-text">
                <AlertTriangle size={14} className="shrink-0" />
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-surface-alt px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover active:scale-[0.98] disabled:opacity-40"
            >
              <ImageIcon size={13} />
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                uploadCover(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </section>
        </div>
      </aside>
    </>
  )
}
