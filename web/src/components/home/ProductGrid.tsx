'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Product } from '@/lib/products'
import { ProductCard } from './ProductCard'
import { CategoryChips } from './CategoryChips'
import { BoxRevealHeading } from '@/components/BoxReveal'

export const GRID_CATEGORIES = ['All', 'Earrings', 'Studs', 'Necklaces']

export function filterProducts(products: Product[], category: string): Product[] {
  // Primary jewellery focus: filter out non-jewellery garments unless empty
  const jewellery = products.filter((p) => p.type !== 'garment')
  const cat = category.toLowerCase()

  if (cat === 'all') {
    return jewellery
  }
  if (cat === 'earrings' || cat === 'teardrops' || cat === 'drops') {
    return jewellery.filter(
      (p) =>
        p.type === 'single' ||
        p.id.includes('teardrop') ||
        p.id.includes('earring') ||
        p.id.includes('pendant')
    )
  }
  if (cat === 'studs') {
    return jewellery.filter((p) => p.type === 'stud')
  }
  if (cat === 'necklaces') {
    return jewellery.filter((p) => p.type === 'necklace')
  }

  return jewellery.filter((p) => p.type === (cat as any))
}

export interface ProductGridProps {
  initialProducts?: Product[]
  className?: string
}

export function ProductGrid({ initialProducts, className = '' }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts || [])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [loading, setLoading] = useState<boolean>(!initialProducts || initialProducts.length === 0)
  const [error, setError] = useState<string | null>(null)

  // Fetch products if initialProducts was not passed
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts)
      setLoading(false)
      return
    }

    let isMounted = true
    fetch('/api/products')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load products')
        return res.json()
      })
      .then((data: Product[]) => {
        if (isMounted) {
          setProducts(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [initialProducts])

  // Listen to hash and custom events for category navigation
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleCategoryEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) {
        const cat = customEvent.detail.toLowerCase()
        if (cat === 'earrings' || cat === 'drops') setActiveCategory('Earrings')
        else if (cat === 'studs') setActiveCategory('Studs')
        else if (cat === 'necklaces') setActiveCategory('Necklaces')
        else setActiveCategory('All')
      }
    }

    const handleHash = () => {
      const hash = window.location.hash.toLowerCase()
      if (hash.includes('earring') || hash.includes('drop')) setActiveCategory('Earrings')
      else if (hash.includes('stud')) setActiveCategory('Studs')
      else if (hash.includes('necklace')) setActiveCategory('Necklaces')
      else if (hash.includes('all')) setActiveCategory('All')
    }

    window.addEventListener('darpan:category', handleCategoryEvent)
    window.addEventListener('hashchange', handleHash)
    handleHash()

    return () => {
      window.removeEventListener('darpan:category', handleCategoryEvent)
      window.removeEventListener('hashchange', handleHash)
    }
  }, [])

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return filterProducts(products, activeCategory)
  }, [products, activeCategory])

  // Category counts
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: filterProducts(products, 'All').length,
      Earrings: filterProducts(products, 'Earrings').length,
      Studs: filterProducts(products, 'Studs').length,
      Necklaces: filterProducts(products, 'Necklaces').length,
    }
    return map
  }, [products])

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 ${className}`}>
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--line)] mb-10">
        <div>
          <span className="ui-label text-[var(--gold)] block mb-2">
            AUTUMN / WINTER ATELIER
          </span>
          <BoxRevealHeading
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-[var(--ink)]"
          >
            The <span className="font-serif-italic">Collection</span> — Measured to Scale
          </BoxRevealHeading>
        </div>

        {/* Category Chips Filter */}
        <CategoryChips
          categories={GRID_CATEGORIES}
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
          counts={counts}
        />
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="aspect-[4/5] bg-[var(--paper)] rounded-2xl animate-pulse border border-[var(--line)]"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-[var(--ink-2)] mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ui-label text-xs underline text-[var(--gold)]"
          >
            RELOAD CATALOGUE
          </button>
        </div>
      )}

      {/* Empty Filter State */}
      {!loading && !error && filteredProducts.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="text-center py-20 bg-[var(--paper)]/50 rounded-2xl border border-[var(--line)]"
        >
          <p className="ui-label text-sm text-[var(--ink-2)] mb-3">
            NO PIECES FOUND IN THIS CATEGORY
          </p>
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className="ui-label text-xs text-[var(--gold)] underline hover:text-[var(--ink)]"
          >
            VIEW ALL PIECES
          </button>
        </div>
      )}

      {/* Product Cards Grid */}
      {!loading && !error && filteredProducts.length > 0 && (
        <div
          id="product-grid-items"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8"
        >
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
