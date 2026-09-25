'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'

export default function PromoCard() {
  return (
    <div className="rounded-card bg-sidebar-bg p-6 text-white shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-accent-teal-bg/15 text-accent-teal-text">
        <Users size={16} />
      </div>
      <p className="mt-4 text-card-title text-white">Invite teammates</p>
      <p className="mt-1 text-body text-white/65">
        Keep boards, due dates, and the content calendar in sync with your whole team.
      </p>
      <Link
        href="/boards"
        className="mt-4 inline-flex h-8 items-center justify-center rounded-pill bg-accent-teal-bg px-4 text-[13px] font-semibold text-accent-teal-text transition-colors duration-150 hover:bg-accent-teal-text hover:text-white"
      >
        Get started
      </Link>
    </div>
  )
}