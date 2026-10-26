import type { Metadata } from 'next'
import Link from 'next/link'
import { IrisNarrative } from '@/components/home/IrisNarrative'

export const metadata: Metadata = {
  title: 'How we scale jewellery · Darpan',
  description: 'How Darpan estimates jewellery scale, and where category measurements differ.',
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="mx-auto max-w-6xl px-6 pb-10 pt-[calc(var(--header-h)+5rem)] sm:px-10 sm:pb-14 lg:px-16">
        <h1 className="max-w-[15ch] font-display text-5xl leading-[1.02] tracking-[-0.035em] sm:text-7xl">How we scale jewellery.</h1>
        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-[var(--ink-2)] sm:text-xl">
          A centimetre makes a difference. We bring product dimensions into your photo, using a reference suited to each piece.
        </p>
        <nav aria-label="Scaling methods" className="mt-8 flex flex-wrap gap-x-7 gap-y-4 text-sm underline decoration-[var(--gold)] underline-offset-4">
          <a href="#earring-method">Earrings: iris reference</a>
          <a href="#necklace-method">Necklaces: chain length</a>
          <a href="#watch-method">Watches: wrist reference</a>
          <a href="#ring-method">Rings & bracelets: visual fit</a>
        </nav>
      </header>

      <div id="earring-method" className="scroll-mt-[var(--header-h)]"><IrisNarrative /></div>

      <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10 lg:px-16">
        <div id="necklace-method" className="grid scroll-mt-[var(--header-h)] gap-8 border-t border-[var(--line)] py-10 md:grid-cols-[1fr_2fr] md:gap-20">
          <h2 className="font-display text-3xl sm:text-4xl">Necklaces</h2>
          <div className="max-w-2xl space-y-5 text-[var(--ink-2)] leading-relaxed">
            <p>The product’s chain length guides the preview. The same necklace can sit differently with another neckline or pose, so drape remains approximate.</p>
          </div>
        </div>

        <div id="watch-method" className="grid scroll-mt-[var(--header-h)] gap-8 border-t border-[var(--line)] py-10 md:grid-cols-[1fr_2fr] md:gap-20">
          <h2 className="font-display text-3xl sm:text-4xl">Watches</h2>
          <div className="max-w-2xl space-y-5 text-[var(--ink-2)] leading-relaxed">
            <p>The case is scaled against a 60 mm reference wrist. Compare the published case dimensions with your own wrist when choosing your size.</p>
          </div>
        </div>
        <div id="ring-method" className="grid scroll-mt-[var(--header-h)] gap-8 border-t border-[var(--line)] py-10 md:grid-cols-[1fr_2fr] md:gap-20">
          <h2 className="font-display text-3xl sm:text-4xl">Rings & bracelets</h2>
          <div className="max-w-2xl space-y-5 text-[var(--ink-2)] leading-relaxed">
            <p>Prepared ring references use your selected US ring size to estimate stone proportions. Other rings and bracelets fit visually to the photo; their published dimensions stay visible as a guide.</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-[var(--line)] pt-8">
          <p className="max-w-xl text-sm leading-relaxed text-[var(--ink-2)]">Try-on is a visual guide. Use the product’s published dimensions and your retailer’s fit advice before buying.</p>
          <Link href="/try-on/gilded-teardrop?sample=1" className="inline-flex min-h-[52px] items-center bg-[var(--ink)] px-8 text-base text-[var(--paper)] hover:bg-[var(--ink-2)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2">Try a sample</Link>
        </div>
      </div>
    </main>
  )
}
