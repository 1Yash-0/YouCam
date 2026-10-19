import type { Metadata } from 'next'
import Link from 'next/link'
import { LookClient } from './LookClient'

interface SharedLookPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: SharedLookPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Curated Look #${id} — Darpan`,
    description: `Experience this curated atelier look at true physical scale. One-tap virtual jewellery try-on calibrated to 11.7 mm iris baseline.`,
  }
}

export default async function SharedLookPage({ params }: SharedLookPageProps) {
  const { id } = await params

  return (
    <main className="min-h-screen pt-36 pb-24 px-6 md:px-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 ui-label text-[11px] text-[var(--ink-2)]">
          <li>
            <Link
              href="/"
              className="hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
            >
              HOME
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span className="text-[var(--ink-2)]">LOOKS</span>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--ink)]">#{id}</li>
        </ol>
      </nav>

      {/* Interactive Client Component */}
      <LookClient lookId={id} />
    </main>
  )
}
