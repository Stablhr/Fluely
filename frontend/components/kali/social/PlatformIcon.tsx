'use client'

import type { CSSProperties } from 'react'
import type { Platform } from '@/lib/kali/store/schema'

interface PlatformIconProps {
  platform: Platform
  size?: number
  className?: string
  style?: CSSProperties
}

/**
 * Brand SVGs drawn in `currentColor` so they adapt to their container
 * (white on platform-colored chips, or the inherited text color).
 * Kept dependency-free (no react-icons).
 */
export default function PlatformIcon({ platform, size = 12, className, style }: PlatformIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    className,
    style,
    'aria-hidden': true,
  } as const

  switch (platform) {
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81z" />
          <path fill="#fff" d="M9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...common}>
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M19.32 5.56a4.68 4.68 0 0 1-3.18-2.18 4.7 4.7 0 0 1-.58-1.89h-3.44v13.13a2.7 2.7 0 1 1-2.67-2.7c.28 0 .55.04.8.11V8.42a6.12 6.12 0 0 0-.8-.05 6.09 6.09 0 1 0 6.1 6.09V9.53a7.94 7.94 0 0 0 4.6 1.43V7.51a4.7 4.7 0 0 1-2.83 0v-1.95z" />
        </svg>
      )
  }
}
