'use client'

import { useRef, useState } from 'react'
import { Paperclip, FileText, AlertTriangle } from 'lucide-react'
import type { Card, FileAttachment } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatSize } from '@/lib/kali/utils/format'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { deleteMedia, uploadMediaFile } from '@/lib/api/mediaApi'
import SectionLabel from '../shared/SectionLabel'

/**
 * Mirrors the backend's `MEDIA_MAX_FILE_SIZE_MB` default. The server rejects
 * anything larger regardless, so this is only early feedback.
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

export default function CardAttachments({ card, readOnly = false }: { card: Card; readOnly?: boolean }) {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFile = async (file: File | undefined, type: 'file' | 'video') => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `"${file.name}" is ${formatSize(file.size)} — keep attachments under ${formatSize(MAX_FILE_SIZE)}.`,
      )
      return
    }
    setUploading(true)
    setError(null)
    try {
      const media = await uploadMediaFile(file, { boardId: card.boardId, cardId: card.id })
      const attachment: FileAttachment = {
        id: uid(),
        name: file.name,
        type,
        dataUrl: media.url,
        mediaId: media.id,
        mimeType: media.mimeType,
        size: media.sizeBytes,
        addedAt: new Date().toISOString(),
      }
      store.updateCard(card.id, { files: [...card.files, attachment] })
      store.addActivity(card.id, `attached ${file.name}`)
    } catch (error) {
      setError(getFriendlyErrorMessage(error, 'Could not upload that file. Please try again.'))
    } finally {
      setUploading(false)
    }
  }

  const remove = (id: string) => {
    const attachment = card.files.find((a) => a.id === id)
    const isActiveCover =
      !!attachment &&
      card.cover !== null &&
      typeof card.cover !== 'string' &&
      card.cover.type === 'image' &&
      card.cover.dataUrl === attachment.dataUrl

    store.updateCard(card.id, {
      files: card.files.filter((a) => a.id !== id),
      ...(isActiveCover ? { cover: null } : {}),
    })

    // Best-effort: drop the asset from Cloudinary too, so replacing attachments
    // does not leave orphans accumulating in the account.
    if (attachment?.mediaId) {
      void deleteMedia(attachment.mediaId).catch(() => undefined)
    }
  }

  const ghostClass =
    'inline-flex items-center gap-1.5 rounded-md bg-surface-alt px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover active:scale-[0.98] disabled:opacity-40'

  return (
    <section>
      <SectionLabel icon={<Paperclip size={14} />}>Attachments</SectionLabel>

      <div className="mt-2 space-y-2">
        {card.files.map((attachment) => {
          const isCover =
            card.cover !== null &&
            typeof card.cover !== 'string' &&
            card.cover.type === 'image' &&
            card.cover.dataUrl === attachment.dataUrl
          return (
          <div key={attachment.id} className="flex items-center gap-3 rounded-md bg-surface-alt px-3 py-2">
            {attachment.type === 'image' ? (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className="h-11 w-11 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-text-secondary">
                <FileText size={16} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-medium text-text-primary">{attachment.name}</span>
                {isCover && (
                  <span className="shrink-0 rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-hover">
                    Cover
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                {formatSize(attachment.size)}
              </p>
            </div>
            {!readOnly && (
            <button
              type="button"
              onClick={() => remove(attachment.id)}
              title="Remove attachment"
              aria-label={`Remove ${attachment.name}`}
              className="shrink-0 rounded-md p-1.5 text-text-muted transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            )}
          </div>
          )
        })}

        {error && (
          <p className="animate-in flex items-center gap-1.5 break-words rounded-md bg-danger-subtle px-3 py-2 text-xs font-medium text-danger-text">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </p>
        )}

        {store.error && (
          <p className="animate-in flex items-center gap-1.5 break-words rounded-md bg-warning-subtle px-3 py-2 text-xs font-medium text-warning-text">
            <AlertTriangle size={14} className="shrink-0" />
            {store.error}
          </p>
        )}

        {!readOnly && (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghostClass} disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Paperclip size={13} />
            {uploading ? 'Uploading…' : 'Attach file'}
          </button>
          <button type="button" className={ghostClass} disabled={uploading} onClick={() => videoRef.current?.click()}>
            <Paperclip size={13} />
            {uploading ? 'Uploading...' : 'Attach video'}
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              void addFile(e.target.files?.[0], 'file')
              e.target.value = ''
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              void addFile(e.target.files?.[0], 'video')
              e.target.value = ''
            }}
          />
        </div>

        <p className="text-[11px] leading-snug text-text-muted">
          Uploads are stored on Cloudinary and shared with everyone on the board.
          Add images from the cover panel.
        </p>
        </>
        )}
      </div>
    </section>
  )
}
