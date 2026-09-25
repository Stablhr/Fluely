'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'

export default function PromoCard() {
  return (
    <div className="rounded-hero bg-sidebar-bg p-6 text-brand-ivory shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-accent-teal-bg/15 text-accent-teal-text">
        <Users size={16} />
      </div>
      <p className="mt-4 text-card-title text-brand-ivory">Invite teammates</p>
      <p className="mt-1 text-body text-brand-ivory/75">
        Keep boards, due dates, and the content calendar in sync with your whole team.
      </p>
      <Link
        href="/boards"
        className="mt-4 inline-flex h-8 items-center justify-center rounded-pill bg-brand-vanilla px-4 text-[13px] font-semibold text-brand-ink transition-colors duration-150 hover:bg-brand-green"
      >
        Get started
      </Link>
    </div>
  )
}