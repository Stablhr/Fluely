'use client'

import { useRef, useState } from 'react'
import { Check, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { BOARD_BACKGROUNDS } from '@/lib/kali/store/schema'
import { useStore } from '@/lib/kali/store/useStore'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { boardThumbStyle, parseBoardBackground } from '@/lib/kali/utils/boardBackground'
import { formatSize } from '@/lib/kali/utils/format'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Board background picker, rendered inline inside the board menu (it used to be
 * a floating popover that spilled out of the drawer). Two ways to set it:
 * upload a photo, or pick a color. "None" returns to the theme's canvas.
 */
export default function BackgroundPickerPopover({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const { data, setBoardBackground, setBoardBackgroundImage } = useStore()
  const board = data.boards[boardId]
  const current = parseBoardBackground(board?.background)
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const uploading = progress !== null

  const upload = async (file: File | undefined) => {
    if (!file || uploading) return
    if (!ACCEPTED.includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is ${formatSize(file.size)}. The limit is ${formatSize(MAX_BYTES)}.`)
      return
    }
    setError(null)
    setProgress(0)
    try {
      await setBoardBackgroundImage(boardId, file, setProgress)
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not upload that photo. Try again.'))
    } finally {
      setProgress(null)
    }
  }

  const swatchClass = (selected: boolean) =>
    `relative flex h-9 items-center justify-center rounded-md transition-transform duration-150 hover:scale-[1.04] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
      selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-elevated' : 'ring-1 ring-inset ring-black/10'
    }`

  return (
    <div className="animate-drop mt-1 rounded-card border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between">
        <p className="text-label uppercase text-text-muted">Background</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close background picker"
          className="rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>

      {/* Photo */}
      <p className="mt-3 text-[12px] font-medium text-text-secondary">Photo</p>
      {current.kind === 'image' && !uploading ? (
        <div className="mt-1.5 overflow-hidden rounded-md border border-border">
          <div className="h-20" style={boardThumbStyle(board?.background)} aria-label="Current background photo" role="img" />
          <div className="flex gap-1 p-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setBoardBackground(boardId, 'default')}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-danger-text transition-colors duration-150 hover:bg-danger-subtle"
            >
              <Trash2 size={12} aria-hidden />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void upload(e.dataTransfer.files?.[0])
          }}
          className={`mt-1.5 flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-3 py-4 text-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
            dragOver ? 'border-primary bg-primary-subtle' : 'border-border-strong hover:border-primary hover:bg-surface-alt'
          } disabled:cursor-progress`}
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin text-primary-text" aria-hidden />
              <span className="text-[12px] font-medium text-text-primary">Uploading… {progress}%</span>
              <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-alt">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </>
          ) : (
            <>
              <ImagePlus size={18} className="text-text-muted" aria-hidden />
              <span className="text-[12px] font-medium text-text-primary">Upload a photo</span>
              <span className="text-[11px] text-text-muted">JPG, PNG, or WebP up to 10 MB</span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        aria-label="Upload a background photo"
        onChange={(e) => {
          void upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p aria-live="polite" className={error ? 'mt-2 rounded-md bg-danger-subtle px-2 py-1.5 text-[12px] font-medium text-danger-text' : 'sr-only'}>
        {error ?? ''}
      </p>

      {/* Colors */}
      <p className="mt-3 text-[12px] font-medium text-text-secondary">Color</p>
      <div className="mt-1.5 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Background color">
        <button
          type="button"
          role="radio"
          aria-checked={current.kind === 'none'}
          aria-label="No background"
          title="None"
          onClick={() => setBoardBackground(boardId, 'default')}
          className={`${swatchClass(current.kind === 'none')} bg-surface-alt text-text-muted`}
        >
          <span className="h-px w-5 rotate-[-35deg] bg-current" aria-hidden />
        </button>
        {BOARD_BACKGROUNDS.map((color) => {
          const selected = current.kind === 'color' && current.color.toLowerCase() === color.toLowerCase()
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Color ${color}`}
              title={color}
              onClick={() => setBoardBackground(boardId, color)}
              className={swatchClass(selected)}
              style={{ background: color }}
            >
              {selected && <Check size={14} className="text-white drop-shadow" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
