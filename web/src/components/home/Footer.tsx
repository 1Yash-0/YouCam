'use client'

import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--line)] bg-[var(--paper)]/40 text-[var(--ink-2)] text-xs py-16 px-6 sm:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="max-w-md">
          <span className="ui-label text-[11px] font-bold text-[var(--ink)] block mb-2 tracking-widest">
            DARPAN · KAARI STUDIO
          </span>
          <p className="leading-relaxed">
            True physical scale virtual jewellery try-on. Size check calibrated against a 11.7 mm anatomical iris standard with sub-millimeter precision. Accuracy ±10%.
          </p>
          <p className="text-[10px] text-[var(--ink-2)]/60 mt-2">
            Kaari Studio and jewellery prices are fictional demo data created for demonstration purposes.
          </p>
        </div>

        <div className="flex flex-wrap gap-8 ui-label text-[11px] tracking-wider">
          <Link href="/about" className="hover:text-[var(--gold)] transition-colors">
            ABOUT & SCIENCE
          </Link>
          <Link href="/stylist" className="hover:text-[var(--gold)] transition-colors">
            VIRTUAL STYLIST
          </Link>
          <Link href="/admin" className="hover:text-[var(--gold)] transition-colors">
            ADMIN STUDIO
          </Link>
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="hover:text-[var(--gold)] transition-colors"
          >
            BACK TO TOP ↑
          </a>
        </div>
      </div>
    </footer>
  )
}
