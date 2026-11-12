'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn } from 'lucide-react'

type Props = {
  file: File
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

export default function AvatarCropModal({ file, onCancel, onConfirm }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  // The file that failed to decode; a new file is tried fresh without a reset.
  const [failedFile, setFailedFile] = useState<File | null>(null)
  const loadError = failedFile === file
  // Smallest zoom at which the image still covers the circle. Measured once the
  // image has loaded; kept in state because refs must not be read during render.
  const [minZoom, setMinZoom] = useState(1)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerSize = 280

  useEffect(() => {
    // Owning an object URL is a real external resource: it is created here and
    // revoked in the cleanup, so state has to be set from the effect.
    const url = URL.createObjectURL(file)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Reset scale/offset when image loads; enforce min zoom so image covers circle.
  const handleImgLoad = () => {
    const img = imgRef.current
    if (!img) return
    const coverScale = Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight)
    setMinZoom(coverScale)
    setScale(coverScale)
    setOffset({ x: 0, y: 0 })
  }

  const clampScale = (v: number) => Math.max(minZoom, Math.min(4, v))

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    // Clamp offset so the image always covers the circle.
    const img = imgRef.current
    if (!img) return
    const drawnW = img.naturalWidth * scale
    const drawnH = img.naturalHeight * scale
    const maxOffsetX = Math.max(0, (drawnW - containerSize) / 2)
    const maxOffsetY = Math.max(0, (drawnH - containerSize) / 2)
    const nx = Math.max(-maxOffsetX, Math.min(maxOffsetX, dragStart.current.ox + dx))
    const ny = Math.max(-maxOffsetY, Math.min(maxOffsetY, dragStart.current.oy + dy))
    setOffset({ x: nx, y: ny })
  }
  const onPointerUp = () => setDragging(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => clampScale(prev + delta))
  }

  const handleSave = () => {
    const img = imgRef.current
    if (!img) return
    setSaving(true)
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) { setSaving(false); return }

    // Compute draw transform matching the preview.
    // Preview scale is relative to "fit circle" (min scale). Output 512 = containerSize * (512/containerSize).
    const minSc = Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight)
    const ratio = scale / minSc
    const outMin = Math.max(512 / img.naturalWidth, 512 / img.naturalHeight)
    const outScale = outMin * ratio
    const w = img.naturalWidth * outScale
    const h = img.naturalHeight * outScale
    const scaleFactor = 512 / containerSize
    const x = (512 - w) / 2 + offset.x * scaleFactor
    const y = (512 - h) / 2 + offset.y * scaleFactor

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    ctx.drawImage(img, x, y, w, h)
    canvas.toBlob((blob) => {
      setSaving(false)
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-medium">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text-primary">Adjust your photo</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-md p-1.5 text-text-secondary hover:bg-surface-alt">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 p-4">
          {loadError ? (
            <p className="text-sm text-danger-text">We couldn&apos;t read that image. Try a different file.</p>
          ) : (
            <div
              className="relative overflow-hidden rounded-full bg-surface-alt"
              style={{ width: containerSize, height: containerSize, cursor: dragging ? 'grabbing' : 'grab' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={handleWheel}
            >
              {src && (
                <img
                  ref={imgRef}
                  src={src}
                  alt="Preview"
                  draggable={false}
                  onLoad={handleImgLoad}
                  onError={() => setFailedFile(file)}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    userSelect: 'none',
                    transformOrigin: 'center center',
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80 ring-inset" />
            </div>
          )}
          {!loadError && (
            <div className="flex w-full items-center gap-3">
              <ZoomIn size={16} className="text-text-secondary" />
              <input
                type="range"
                min={minZoom}
                max={4}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(clampScale(Number(e.target.value)))}
                className="flex-1"
                aria-label="Zoom"
              />
            </div>
          )}
          <p className="text-[11px] text-text-muted">Drag to reposition, scroll or use the slider to zoom.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-alt">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loadError || saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
