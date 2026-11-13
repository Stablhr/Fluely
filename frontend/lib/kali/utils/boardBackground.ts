import type { CSSProperties } from 'react'

/**
 * A board's `background` is one of:
 *   - "default" or empty   → no background (the theme's canvas)
 *   - a hex color           → solid color
 *   - an https image URL    → a photo uploaded to the board (Cloudinary)
 * The server only accepts the first two plus photos uploaded to the board, but
 * older values (data: URLs from local-only boards, gradients) may still exist,
 * so anything unrecognised is treated as "no background" rather than being
 * handed to CSS.
 */
export type BoardBackground =
  | { kind: 'none' }
  | { kind: 'color'; color: string }
  | { kind: 'image'; url: string }

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function parseBoardBackground(value?: string | null): BoardBackground {
  const v = (value ?? '').trim()
  if (HEX.test(v)) return { kind: 'color', color: v }
  if (/^https:\/\//i.test(v)) return { kind: 'image', url: v }
  return { kind: 'none' }
}

/**
 * Inserts a Cloudinary delivery transformation so the browser downloads a
 * right-sized, modern-format image (thumbnails stay tiny; the canvas is capped).
 * Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryVariant(url: string, transform: string): string {
  const marker = '/image/upload/'
  const i = url.indexOf(marker)
  if (i === -1 || !url.includes('res.cloudinary.com')) return url
  return url.slice(0, i + marker.length) + transform + '/' + url.slice(i + marker.length)
}

const THUMB = 'c_fill,w_480,h_200,g_auto,q_auto,f_auto'
const CANVAS = 'c_limit,w_2560,q_auto,f_auto'

/** Small surfaces: board tiles, sidebar dots, recent-board swatches. */
export function boardThumbStyle(value?: string | null): CSSProperties {
  const bg = parseBoardBackground(value)
  if (bg.kind === 'color') return { background: bg.color }
  if (bg.kind === 'image') {
    return { background: `center / cover no-repeat url("${cloudinaryVariant(bg.url, THUMB)}")` }
  }
  return { background: 'var(--color-surface-alt)' }
}

/** The board canvas behind the lists. */
export function boardCanvasStyle(value?: string | null): CSSProperties | undefined {
  const bg = parseBoardBackground(value)
  if (bg.kind === 'color') return { background: bg.color }
  if (bg.kind === 'image') {
    return {
      backgroundImage: `url("${cloudinaryVariant(bg.url, CANVAS)}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return undefined
}
