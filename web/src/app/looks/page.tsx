import type { Metadata } from 'next'
import { LookClient } from '@/components/home/LookClient'

export const metadata: Metadata = {
  title: 'Looks · Darpan',
  description: 'Explore sample Darpan looks rendered at true physical scale.',
}

export default function LooksPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-24 pt-16 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-3 font-display text-5xl sm:text-6xl">Looks</h1>
        <p className="mb-10 max-w-[62ch] text-[17px] leading-[1.6] text-[var(--ink)]">Every look here is a real try-on on our sample face.</p>
        <LookClient />
      </div>
    </main>
  )
}
