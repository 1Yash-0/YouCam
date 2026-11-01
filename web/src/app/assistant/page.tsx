import type { Metadata } from 'next'
import { AssistantClient } from './AssistantClient'

export const metadata: Metadata = {
  title: 'AI Concierge & Jewellery Stylist · Darpan',
  description: 'Personalized fine jewellery advice, honest scale recommendations, and skin undertone analysis powered by Darpan AI.',
}

export default function AssistantPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 pb-24 pt-24 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <span className="text-[13px] font-mono uppercase tracking-[0.2em] text-[var(--gold)]">
            Agentic Fine Jewellery Concierge
          </span>
          <h1 className="mt-2 font-display text-4xl sm:text-6xl">Darpan AI Concierge</h1>
          <p className="mt-4 max-w-[65ch] text-[17px] leading-relaxed text-[var(--ink-2)]">
            Ask any styling, sizing, or proportion question. Upload your photo or use our calibrated reference to discover pieces matched to your facial anatomy and skin undertones.
          </p>
        </div>
        <AssistantClient />
      </div>
    </main>
  )
}
