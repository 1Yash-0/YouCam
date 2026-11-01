'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function FloatingConcierge() {
  const pathname = usePathname()

  // Hide on the assistant page itself
  if (pathname === '/assistant') return null

  return (
    <aside aria-label="AI Assistant" className="fixed bottom-6 right-6 z-40">
      <Link
        href="/assistant"
        className="group flex items-center gap-2.5 px-4 py-2.5 bg-[var(--ink)] text-[var(--paper)] rounded-full shadow-lg border border-[var(--gold)]/30 hover:border-[var(--gold)] hover:shadow-xl transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
        <span className="text-sm font-medium tracking-wide">✦ AI Concierge</span>
        <span className="text-xs text-[var(--gold)] opacity-80 group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </Link>
    </aside>
  )
}
