'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'

export default function PromoCard() {
  return (
    <div className="rounded-hero border border-border bg-surface p-6 shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-primary-subtle text-primary-text">
        <Users size={16} />
      </div>
      <p className="mt-4 text-card-title text-text-primary">Invite teammates</p>
      <p className="mt-1 text-body text-text-secondary">
        Keep boards, due dates, and the content calendar in sync with your whole team.
      </p>
      <Link
        href="/boards"
        className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
      >
        Get started
      </Link>
    </div>
  )
}
