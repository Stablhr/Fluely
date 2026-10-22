'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, ExternalLink, Download, Trash2, ImageIcon } from 'lucide-react'
import type { FileAttachment } from '@/lib/kali/store/schema'

export interface ViewerImage {
  url: string
  name: string
  size: number
  mimeType?: string
  addedAt: string
  isCover: boolean
  mediaId?: string
  publicId?: string
}

interface ImageViewerProps {
  images: ViewerImage[]
  startIndex: number
  canEdit: boolean
  onClose: () => void
  onRemoveCover: (img: ViewerImage) => void
  onDelete: (img: ViewerImage) => Promise<void>
}

function formatSize2(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return d
  }
}

function cloudinaryDownloadUrl(url: string, filename: string): string {
  // Insert the attachment flag into the Cloudinary delivery URL so the browser
  // downloads instead of navigating. Cloudinary preserves the original extension,
  // so strip it from the flag value to avoid a doubled extension.
  const base = filename.replace(/\.[^.]+$/, '')
  const safe = base.replace(/[^\w.\- ]/g, '').replace(/ /g, '_') || 'download'
  if (url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/fl_attachment:${safe}/`)
  }
  return url
}

function displayedUrl(url: string): string {
  // Use f_auto,q_auto for the on-screen copy (per implementation notes).
  if (url.includes('/upload/') && !url.includes('f_auto')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto/')
  }
  return url
}

export default function ImageViewer({ images, startIndex, canEdit, onClose, onRemoveCover, onDelete }: ImageViewerProps) {
  const [index, setIndex] = useState(Math.max(0, Math.min(startIndex, images.length - 1)))
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const img = images[index]
  const total = images.length
  const hasNav = total > 1

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Reset loading on index change.
  useEffect(() => {
    setLoading(true)
  }, [index])

  // Preload neighbors.
  useEffect(() => {
    if (!hasNav) return
    const prev = images[(index - 1 + total) % total]
    const next = images[(index + 1) % total]
    for (const n of [prev, next]) {
      if (!n) continue
      const i = new Image()
      i.src = displayedUrl(n.url)
    }
  }, [index, images, total, hasNav])

  // Keyboard handling: Esc closes; arrows navigate. Esc only closes viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        if (confirmDelete) setConfirmDelete(false)
        else onClose()
        return
      }
      if (hasNav) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setIndex((i) => (i - 1 + total) % total)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setIndex((i) => (i + 1) % total)
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [hasNav, total, confirmDelete, onClose])

  // Focus trap: focus container on mount.
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  if (!img) return null
  if (typeof document === 'undefined') return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(img)
      setConfirmDelete(false)
      // Move to next if available, else close.
      if (total > 1) {
        setIndex((i) => Math.min(i, images.length - 2))
      } else {
        onClose()
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleRemoveCover = () => {
    onRemoveCover(img)
    onClose()
  }

  const isCover = img.isCover

  const node = (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-4 animate-in"
      role="dialog"
      aria-modal="true"
      aria-label={img.name}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute right-4 top-4 z-[101] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {/* Navigation arrows */}
      {hasNav && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-[101] -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % total)}
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-[101] -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 sm:right-4"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div
        ref={containerRef}
        tabIndex={-1}
        className="flex w-full max-w-5xl flex-col items-center outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative flex w-full items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
          <img
            src={displayedUrl(img.url)}
            alt={img.name}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            className="max-h-[calc(100vh-160px)] max-w-full rounded-lg object-contain shadow-2xl"
            style={{ maxWidth: '100%' }}
          />
        </div>

        {/* Counter */}
        {hasNav && (
          <div className="mt-2 text-xs font-medium text-white/70">
            {index + 1} / {total}
          </div>
        )}

        {/* Caption */}
        <div className="mt-2 text-center text-white">
          <div className="text-base font-bold">{img.name}</div>
          <div className="mt-0.5 text-xs text-white/70">
            Added {formatDate(img.addedAt)}
            {formatSize2(img.size) ? ` • ${formatSize2(img.size)}` : ''}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <a
            href={img.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
          >
            <ExternalLink size={16} />
            Open in new tab
          </a>
          <a
            href={cloudinaryDownloadUrl(img.url, img.name)}
            download={img.name}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
          >
            <Download size={16} />
            Download
          </a>
          {canEdit && isCover && (
            <button
              type="button"
              onClick={handleRemoveCover}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
            >
              <ImageIcon size={16} />
              Remove cover
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-[102] flex items-center justify-center bg-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-sm rounded-xl bg-surface p-4 text-text-primary shadow-medium">
            <p className="text-sm font-semibold">Delete this attachment?</p>
            <p className="mt-1 text-xs text-text-muted">This can't be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors duration-150 hover:bg-surface-alt"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-danger-text disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(node, document.body)
}
