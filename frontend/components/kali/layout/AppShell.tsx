'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      <Sidebar
        collapsed={!hovered}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pb-16 md:pb-0">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  )
}