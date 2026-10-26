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
    <main className="min-h-screen pt-16 pb-24 px-6 md:px-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-10">
        <ol className="flex flex-wrap items-center gap-2 text-[16px] text-[var(--ink-2)]">
          <li>
            <Link href="/" className="link-draw text-[var(--ink)]">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span>Looks</span>
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
