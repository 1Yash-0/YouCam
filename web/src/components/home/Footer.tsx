'use client'

import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-[20svh] px-5 pb-10 text-[15px] text-[var(--ink-2)] sm:px-8 lg:px-12">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-8">
        <p className="md:justify-self-start">Darpan · true-size try-on</p>

        <nav aria-label="Footer links" className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-7 md:justify-self-center">
          <Link href="/about" className="link-draw text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]">
            About
          </Link>
          <Link href="/how-it-works" className="link-draw text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]">
            How sizing works
          </Link>
          <Link href="/for-retailers" className="link-draw text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]">
            For retailers
          </Link>
          <Link href="/privacy" className="link-draw text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]">
            Privacy
          </Link>
        </nav>

        <p className="md:justify-self-end">Demo shop · prices illustrative</p>
      </div>
    </footer>
  )
}
