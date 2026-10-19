import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { StylistClient } from './StylistClient'

export const metadata: Metadata = {
  title: 'Virtual Stylist · Personal Harmony | Darpan',
  description:
    'AI colour science consultation pairing Indian skin undertones and attire fabrics with optimal jewellery metals and harmonious lipstick shades.',
}

export default function StylistPage() {
  return (
    <main className="min-h-screen pt-36 pb-24 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
      {/* Standard Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 ui-label text-[11px] text-[var(--ink-2)]">
          <li>
            <Link
              href="/"
              className="hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] transition-colors"
            >
              HOME
            </Link>
          </li>
          <li aria-hidden="true" className="text-[var(--line)]">
            /
          </li>
          <li className="text-[var(--ink)]">STYLIST</li>
        </ol>
      </nav>

      {/* Hero Title Section */}
      <section className="mb-12">
        <span className="ui-label text-[var(--gold)] block mb-2">Colour harmony</span>
        <h1 className="text-4xl md:text-6xl font-light tracking-tight text-[var(--ink)] mb-4">
          Personal <span className="font-serif-italic">stylist</span>
        </h1>
        <p className="text-base md:text-lg text-[var(--ink-2)] max-w-2xl leading-relaxed font-normal">
          Select skin undertones and outfit fabrics to find your ideal metal tone and lipstick shade pairing, powered by CIE L*a*b* colour science and Indian skin tone benchmarks.
        </p>
      </section>

      {/* Interactive Stylist Client */}
      <StylistClient />
    </main>
  )
}
