'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-modal"
      >
        Skip to content
      </a>
      {/* Keyboard focus expands the sidebar too, so its board lists are reachable without a mouse. */}
      <div
        className="contents"
        onFocus={() => setHovered(true)}
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false)
        }}
      >
        <Sidebar
          collapsed={!hovered}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
      </div>
      <main id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden pb-16 md:pb-0">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  )
}