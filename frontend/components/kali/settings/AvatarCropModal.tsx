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
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerSize = 240

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
  }
  const onPointerUp = () => setDragging(false)

  const handleSave = () => {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Draw scaled image centered, then crop to the circular-ish square.
    const baseSize = Math.min(img.naturalWidth, img.naturalHeight)
    // Compute the drawn size in the 512 canvas: scale relative to the container.
    const drawScale = scale * (512 / containerSize) * (containerSize / baseSize) * 1.2
    // Simpler: fit image into canvas with scale, then translate by offset (scaled).
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    const s = scale * (512 / Math.min(img.naturalWidth, img.naturalHeight))
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    const x = (512 - w) / 2 + offset.x * (512 / containerSize)
    const y = (512 - h) / 2 + offset.y * (512 / containerSize)
    ctx.drawImage(img, x, y, w, h)
    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/png', 0.92)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-medium">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text-primary">Crop profile picture</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-md p-1.5 text-text-secondary hover:bg-surface-alt">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 p-4">
          <div
            className="relative overflow-hidden rounded-full bg-surface-alt"
            style={{ width: containerSize, height: containerSize, cursor: dragging ? 'grabbing' : 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {src && (
              <img
                ref={imgRef}
                src={src}
                alt="Preview"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  userSelect: 'none',
                }}
              />
            )}
            {/* circular mask overlay */}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80 ring-inset" />
          </div>
          <div className="flex w-full items-center gap-3">
            <ZoomIn size={16} className="text-text-secondary" />
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <p className="text-[11px] text-text-muted">Drag to reposition, zoom to adjust. Output is a 512×512 square.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-alt">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
