'use client'

import { useEffect, useRef, useState } from 'react'
import { cloudinaryVariant, parseBoardBackground } from '@/lib/kali/utils/boardBackground'

/*
 * The board's background, as a layer behind everything on the board (top bar
 * included) rather than a CSS background on the scrolling list area.
 *
 * Photos are cropped by Cloudinary to the shape of the board with `g_auto`, so
 * the subject (faces, the main object) stays in view instead of a blind
 * centre crop. The board's size is rounded to a few aspect ratios and widths
 * so the same derived images are reused and cached. A tiny blurred version
 * shows instantly; the sharp image fades in once it has loaded.
 */

const RATIOS: [number, number][] = [
  [21, 9],
  [16, 9],
  [16, 10],
  [4, 3],
  [1, 1],
  [3, 4],
  [9, 16],
]
const WIDTHS = [960, 1280, 1920, 2560]

function nearestRatio(w: number, h: number): [number, number] {
  const target = w / Math.max(1, h)
  return RATIOS.reduce((best, r) =>
    Math.abs(r[0] / r[1] - target) < Math.abs(best[0] / best[1] - target) ? r : best,
  )
}

function widthBucket(cssWidth: number): number {
  const needed = cssWidth * Math.min(2, window.devicePixelRatio || 1)
  return WIDTHS.find((w) => w >= needed) ?? WIDTHS[WIDTHS.length - 1]
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) =>
        prev && Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2 ? prev : { w: width, h: height },
      )
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}

function Photo({ url }: { url: string }) {
  const { ref, size } = useSize<HTMLDivElement>()
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const src = size
    ? (() => {
        const [aw, ah] = nearestRatio(size.w, size.h)
        return cloudinaryVariant(url, `c_fill,g_auto,ar_${aw}:${ah},w_${widthBucket(size.w)},q_auto,f_auto`)
      })()
    : null
  const placeholder = cloudinaryVariant(url, 'c_fill,g_auto,w_64,e_blur:600,q_30,f_auto')

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {/* Blurred stand-in, scaled up slightly so its soft edges stay off-screen. */}
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{ backgroundImage: `url("${placeholder}")` }}
      />
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(src)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${
            loadedSrc === src ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {/* Keeps the top bar legible over bright photos, and calms the photo a
          little in dark mode so it doesn't glare. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-0 bg-black/0 dark:bg-black/25" />
    </div>
  )
}

export default function BoardBackdrop({ background }: { background?: string | null }) {
  const bg = parseBoardBackground(background)
  if (bg.kind === 'none') return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {bg.kind === 'color' ? (
        <div className="absolute inset-0" style={{ background: bg.color }} />
      ) : (
        <Photo url={bg.url} />
      )}
    </div>
  )
}
