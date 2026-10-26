import type { Metadata } from 'next'
import { getAllProductsWithRuntime } from '@/lib/runtime-products'
import { COLLECTION_CATEGORIES, ProductGrid } from '@/components/home/ProductGrid'

export const metadata: Metadata = {
  title: 'Collection · Darpan',
  description: 'Browse Darpan jewellery by category, price, and physical size.',
}

export const dynamic = 'force-static'
export const revalidate = 60

export default async function CollectionPage() {
  const products = await getAllProductsWithRuntime()

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 md:pt-20 lg:px-8">
        <h1 className="font-display text-[clamp(44px,5vw,80px)] text-[var(--ink)]">All pieces</h1>
        <p className="mt-4 text-[17px] text-[var(--ink-2)]">Every piece shows its real size. Hover to see it worn.</p>
      </header>
      <ProductGrid
        initialProducts={products}
        categories={COLLECTION_CATEGORIES}
        showHeader={false}
        showFilters
        showSort
        flushTop
      />
      <p className="mx-auto max-w-7xl px-4 pb-12 text-[15px] text-[var(--ink-2)] sm:px-6 lg:px-8">
        Demo shop · prices illustrative
      </p>
    </main>
  )
}
