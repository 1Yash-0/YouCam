import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminClient } from './AdminClient'

export const metadata: Metadata = {
  title: 'Retailer tools · Darpan',
  description:
    'Add and preview earring products in the Darpan try-on demo.',
}

export default function AdminPage() {
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
          <li className="text-[var(--ink)]">ADMIN</li>
        </ol>
      </nav>

      {/* Page Heading */}
      <header className="mb-10">
        <span className="ui-label text-[var(--gold)] block mb-2 tracking-[0.2em]">
          RETAILER TOOLS
        </span>
        <h1 className="text-4xl md:text-5xl font-light tracking-tight text-[var(--ink)] mb-3">
          Product <span className="font-display">editor</span>
        </h1>
        <p className="text-sm md:text-base text-[var(--ink-2)] max-w-2xl leading-relaxed">
          Add single earrings and studs with measured dimensions, then preview their product page and try-on flow. This editor is a focused demo catalogue tool.
        </p>
      </header>

      {/* Admin Controller */}
      <AdminClient />
    </main>
  )
}
