'use client'

import { useRef, useState } from 'react'
import { Paperclip, ImageIcon, FileText, AlertTriangle } from 'lucide-react'
import type { Card, FileAttachment } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { uid } from '@/lib/kali/utils/id'
import { formatSize } from '@/lib/kali/utils/format'
import SectionLabel from '../shared/SectionLabel'

export const MAX_FILE_SIZE = 2 * 1024 * 1024

export default function CardAttachments({ card }: { card: Card }) {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const addFile = (file: File | undefined, type: 'file' | 'image') => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `"${file.name}" is ${formatSize(file.size)} — keep attachments under 2 MB.`,
      )
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const attachment: FileAttachment = {
        id: uid(),
        name: file.name,
        type,
        dataUrl: reader.result as string,
        size: file.size,
        addedAt: new Date().toISOString(),
      }
      store.updateCard(card.id, { files: [...card.files, attachment] })
      store.addActivity(card.id, `attached ${file.name}`)
      setError(null)
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsDataURL(file)
  }

  const remove = (id: string) => {
    store.updateCard(card.id, { files: card.files.filter((a) => a.id !== id) })
  }

  const ghostClass =
    'inline-flex items-center gap-1.5 rounded-md bg-surface-alt px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-primary-subtle hover:text-primary-hover active:scale-[0.98]'

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
                <FileText size={18} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-text-primary" title={attachment.name}>
                  {attachment.name}
                </p>
                {isCover && (
                  <span className="shrink-0 rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10px] font-bold text-primary-hover">
                    Cover
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-text-muted">
                {formatSize(attachment.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(attachment.id)}
              title="Remove attachment"
              aria-label={`Remove ${attachment.name}`}
              className="rounded-md p-1.5 text-text-muted transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
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

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghostClass} onClick={() => fileRef.current?.click()}>
            <Paperclip size={13} />
            Attach file
          </button>
          <button type="button" className={ghostClass} onClick={() => imageRef.current?.click()}>
            <ImageIcon size={13} />
            Attach image
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              addFile(e.target.files?.[0], 'file')
              e.target.value = ''
            }}
          />
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              addFile(e.target.files?.[0], 'image')
              e.target.value = ''
            }}
          />
        </div>

        <p className="text-[11px] leading-snug text-text-muted">
          Files are stored in your browser&apos;s local storage — keep uploads under ~2 MB. They
          won&apos;t sync across devices yet.
        </p>
      </div>
    </section>
  )
}
