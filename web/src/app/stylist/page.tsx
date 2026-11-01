import type { Metadata } from 'next'
import { StylistClient } from './StylistClient'

export const metadata: Metadata = {
  title: 'AI Stylist & Metal Match · Color Science · Darpan',
  description: 'Harmonize jewellery metals, celebratory attire fabrics, and lipstick shades using CIELAB and Delta-E color science.',
}

export default function StylistPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-24 pt-24 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <span className="text-[13px] font-mono uppercase tracking-[0.2em] text-[var(--gold)]">Color Science & Undertones</span>
          <h1 className="mt-2 font-display text-4xl sm:text-6xl">AI Stylist & Metal Match</h1>
          <p className="mt-4 max-w-[65ch] text-[17px] leading-relaxed text-[var(--ink-2)]">
            Harmonize your jewellery metal and lipstick palette with your natural undertones and festive attire fabrics using CIELAB ΔE₂₀₀₀ color science.
          </p>
        </div>
        <StylistClient />
      </div>
    </main>
  )
}
