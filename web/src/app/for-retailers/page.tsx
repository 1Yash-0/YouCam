import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'For retailers · Darpan',
  description: 'Add an earring to the Darpan try-on demo and preview its shopper journey.',
}

const bodyClass = 'text-[17px] leading-[1.6] text-[var(--ink)]'
const buttonClass =
  'inline-flex h-[52px] items-center bg-[var(--ink)] px-7 text-[16px] text-[var(--paper)] transition-opacity duration-[180ms] ease-[var(--ease-out)] hover:opacity-[0.86]'

export default function ForRetailersPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] px-6 pb-24 pt-16 text-[var(--ink)] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <section className="grid items-end gap-12 pb-20 md:grid-cols-[1.35fr_0.65fr] md:pb-28">
          <div>
            <h1 className="max-w-4xl font-display text-5xl sm:text-7xl lg:text-8xl">Give shoppers a clearer sense of size.</h1>
            <p className={`mt-8 max-w-[62ch] ${bodyClass}`}>Add an earring with its published dimensions, then see the same piece in a product preview and a try-on flow.</p>
          </div>
          <div className="flex flex-col items-start gap-5 md:justify-self-end">
            <Link href="/admin" className={buttonClass}>Open retailer tools</Link>
            <p className={`max-w-[34ch] ${bodyClass}`}>Use the protected editor to add an earring listing and open its shopper preview.</p>
          </div>
        </section>

        <section className="grid gap-12 pb-20 md:grid-cols-[1fr_2fr] md:gap-20">
          <h2 className="font-display text-3xl sm:text-4xl">From listing to try-on</h2>
          <div className="max-w-3xl">
            <p className={`max-w-[62ch] ${bodyClass}`}>Add a single earring or stud with a product image, name, brand, price and measured dimensions. Then follow the product into a shopper view and photo try-on.</p>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              <div>
                <h3 className="font-display text-2xl">Add</h3>
                <p className={`mt-3 ${bodyClass}`}>Upload a PNG, JPG or WebP under 4 MB and enter the product’s dimensions.</p>
              </div>
              <div>
                <h3 className="font-display text-2xl">Preview</h3>
                <p className={`mt-3 ${bodyClass}`}>See the product image, selected dimensions and listing together.</p>
              </div>
              <div>
                <h3 className="font-display text-2xl">Try on</h3>
                <p className={`mt-3 ${bodyClass}`}>View the shopper flow and see the piece on a photo.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-20">
          <h2 className="font-display text-3xl sm:text-4xl">Sizing, by category</h2>
          <div className="max-w-3xl space-y-6">
            <p className={`max-w-[62ch] ${bodyClass}`}>Earring scale uses an average iris reference and a check of the rendered image against product dimensions. This render check is a guide, not a guarantee across every face or screen. Necklace length is approximate, watch scale uses an assumed wrist, and rings and bracelets are auto-fitted.</p>
            <p className={`max-w-[62ch] ${bodyClass}`}><Link href="/how-it-works" className="link-draw">See how sizing works</Link> for the shopper explanation.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
