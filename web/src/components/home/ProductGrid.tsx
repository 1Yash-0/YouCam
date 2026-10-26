'use client'

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Product } from '@/lib/products'
import { ProductCard } from './ProductCard'
import { CategoryChips } from './CategoryChips'
import { Skeleton } from '@/components/Skeleton'

export const COLLECTION_CATEGORIES = ['All', 'Studs', 'Drops', 'Stacks', 'Necklaces', 'Rings', 'Bracelets', 'Watches'] as const
export const GRID_CATEGORIES = ['All', 'Studs', 'Drops', 'Necklaces', 'Rings', 'Bracelets', 'Watches'] as const
export type ProductSort = 'featured' | 'price-low' | 'price-high' | 'size-small'

function isJewellery(product: Product): boolean {
  return product.type !== 'garment'
}

function categoryForProduct(product: Product): string | null {
  if (product.type === 'stud') return 'Studs'
  if (product.type === 'necklace') return 'Necklaces'
  if (product.type === 'single') return 'Drops'
  if (product.type === 'ring') return 'Rings'
  if (product.type === 'bracelet') return 'Bracelets'
  if (product.type === 'watch') return 'Watches'
  return String(product.type) === 'stack' ? 'Stacks' : null
}

export function getAvailableCategories(products: Product[], categories: readonly string[] = COLLECTION_CATEGORIES): string[] {
  const jewellery = products.filter(isJewellery)
  return categories.filter(
    (category) =>
      category === 'All' || jewellery.some((product) => categoryForProduct(product) === category),
  )
}

export function filterProducts(products: Product[], category: string): Product[] {
  const jewellery = products.filter(isJewellery)
  if (category.toLowerCase() === 'all') return jewellery

  const normalized = category.toLowerCase()
  const requestedCategory = normalized === 'earrings' || normalized === 'teardrops' ? 'drops' : normalized
  return jewellery.filter((product) => {
    const productCategory = categoryForProduct(product)?.toLowerCase()
    return productCategory === requestedCategory
  })
}

function productSize(product: Product): number {
  if (product.type === 'necklace') return product.lengthCm
  if (product.type === 'single' || product.type === 'stud') return product.heightCm
  if (product.type === 'ring' || product.type === 'bracelet') return product.diameterMm / 10
  if (product.type === 'watch') return product.caseMm / 10
  return Number.POSITIVE_INFINITY
}

export function sortProducts(products: Product[], sort: ProductSort): Product[] {
  if (sort === 'featured') return products

  return [...products].sort((a, b) => {
    if (sort === 'price-low') return a.priceUsd - b.priceUsd
    if (sort === 'price-high') return b.priceUsd - a.priceUsd
    return productSize(a) - productSize(b)
  })
}

export interface ProductGridProps {
  initialProducts?: Product[]
  className?: string
  categories?: readonly string[]
  showHeader?: boolean
  showFilters?: boolean
  showSort?: boolean
  heading?: React.ReactNode
  /** Drop the top padding when the page already spaces the grid, as the collection header does. */
  flushTop?: boolean
}

type RevealState = 'idle' | 'armed' | 'shown'

const FADE_OUT_MS = 150
const RISE_MS = 300
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function ProductGrid({
  initialProducts,
  className = '',
  categories = GRID_CATEGORIES,
  showHeader = true,
  showFilters = true,
  showSort = false,
  heading = 'All pieces',
  flushTop = false,
}: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts || [])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [sort, setSort] = useState<ProductSort>('featured')
  const [loading, setLoading] = useState<boolean>(!initialProducts || initialProducts.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [reveal, setReveal] = useState<RevealState>('idle')

  const gridRef = useRef<HTMLDivElement>(null)
  const fadeRef = useRef<Animation | null>(null)
  const pendingRiseRef = useRef(false)
  // Set by user-driven changes only, so deep links and hash changes swap the grid instantly.
  const animateNextChangeRef = useRef(false)
  const revealDoneRef = useRef(false)

  // Deep link from the hero windows: /collection?category=rings
  useEffect(() => {
    if (!showFilters) return
    const requested = new URLSearchParams(window.location.search).get('category')
    const match = requested && categories.find((c) => c.toLowerCase() === requested.toLowerCase())
    if (match) setActiveCategory(match)
  }, [showFilters, categories])

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

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleCategoryEvent = (event: Event) => {
      const category = (event as CustomEvent<string>).detail
      if (category) setActiveCategory(category === 'earrings' ? 'Drops' : category)
    }

    const handleHash = () => {
      const hash = window.location.hash.toLowerCase()
      if (hash.includes('stud')) setActiveCategory('Studs')
      else if (hash.includes('drop') || hash.includes('earring')) setActiveCategory('Drops')
      else if (hash.includes('necklace')) setActiveCategory('Necklaces')
      else if (hash.includes('stack')) setActiveCategory('Stacks')
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

  const availableCategories = useMemo(
    () => getAvailableCategories(products, categories),
    [categories, products],
  )

  useEffect(() => {
    if (!availableCategories.includes(activeCategory)) setActiveCategory('All')
  }, [activeCategory, availableCategories])

  const filteredProducts = useMemo(
    () => sortProducts(filterProducts(products, activeCategory), sort),
    [activeCategory, products, sort],
  )

  // The grid shows `shownProducts`, which trails `filteredProducts` through the fade-out. The tabs update at once.
  const [shownProducts, setShownProducts] = useState<Product[]>(filteredProducts)

  // Filter change: the grid fades out over 150 ms, then the new list rises in over 300 ms.
  // A newer change during the fade only reschedules the swap, so the latest choice always wins.
  useEffect(() => {
    if (shownProducts === filteredProducts) return undefined

    const grid = gridRef.current
    const canFade =
      animateNextChangeRef.current &&
      Boolean(grid) &&
      typeof grid?.animate === 'function' &&
      shownProducts.length > 0 &&
      !prefersReducedMotion()

    if (!grid || !canFade) {
      setShownProducts(filteredProducts)
      return undefined
    }

    if (!fadeRef.current) {
      fadeRef.current = grid.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_OUT_MS,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
        fill: 'forwards',
      })
    }

    const timer = window.setTimeout(() => {
      pendingRiseRef.current = true
      setShownProducts(filteredProducts)
    }, FADE_OUT_MS)

    return () => window.clearTimeout(timer)
  }, [filteredProducts, shownProducts])

  // Once the new list is in the DOM, end the fade and rise the grid in before the browser paints.
  useIsomorphicLayoutEffect(() => {
    fadeRef.current?.cancel()
    fadeRef.current = null
    animateNextChangeRef.current = false

    if (!pendingRiseRef.current) return
    pendingRiseRef.current = false

    const grid = gridRef.current
    if (!grid || typeof grid.animate !== 'function') return
    grid.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: RISE_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }, [shownProducts])

  const selectCategory = (category: string) => {
    if (category === activeCategory) return
    animateNextChangeRef.current = true
    setActiveCategory(category)
  }

  const changeSort = (value: ProductSort) => {
    if (value === sort) return
    animateNextChangeRef.current = true
    setSort(value)
  }

  const counts = useMemo(
    () => Object.fromEntries(availableCategories.map((category) => [category, filterProducts(products, category).length])),
    [availableCategories, products],
  )

  const hasGrid = !loading && !error && shownProducts.length > 0

  // Cards rise in once, in a stagger, the first time the grid is in view. Reduced motion skips this.
  useIsomorphicLayoutEffect(() => {
    const grid = gridRef.current
    if (!hasGrid || !grid || revealDoneRef.current) return undefined

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      revealDoneRef.current = true
      return undefined
    }

    setReveal('armed')
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        revealDoneRef.current = true
        setReveal('shown')
        observer.disconnect()
      },
      { threshold: 0.12 },
    )
    observer.observe(grid)

    return () => observer.disconnect()
  }, [hasGrid])

  const showToolbar = showFilters || showSort

  return (
    <div
      className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${flushTop ? 'pb-16 md:pb-24' : 'py-16 md:py-24'} ${className}`}
    >
      {(showHeader || showToolbar) && (
        <div className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between md:gap-10">
          {showHeader && (
            <h2 className="font-display text-[clamp(36px,4.2vw,56px)] text-[var(--ink)]">{heading}</h2>
          )}

          {showToolbar && (
            <div className="flex min-w-0 flex-1 flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-10">
              {showFilters && (
                <CategoryChips
                  categories={availableCategories}
                  activeCategory={activeCategory}
                  onSelectCategory={selectCategory}
                  counts={counts}
                />
              )}
              {showSort && (
                <label className="flex items-center gap-3 text-[15px] text-[var(--ink-2)] md:ml-auto">
                  <span>Sort</span>
                  <select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(event) => changeSort(event.target.value as ProductSort)}
                    className="h-11 rounded-none border border-[var(--line)] bg-[var(--bg)] px-3 text-[16px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-low">Price low-high</option>
                    <option value="price-high">Price high-low</option>
                    <option value="size-small">Size small-large</option>
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="aspect-square" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="py-20">
          <p className="mb-4 text-[17px] text-[var(--ink-2)]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="link-draw text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
          >
            Reload catalogue
          </button>
        </div>
      )}

      {!loading && !error && shownProducts.length === 0 && (
        <div role="status" aria-live="polite" className="py-20">
          <p className="mb-4 text-[17px] text-[var(--ink-2)]">No pieces in this category.</p>
          <button
            type="button"
            onClick={() => selectCategory('All')}
            className="link-draw text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
          >
            View all pieces
          </button>
        </div>
      )}

      {hasGrid && (
        <div
          id="product-grid-items"
          ref={gridRef}
          data-reveal={reveal}
          className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4"
        >
          {shownProducts.map((product, index) => (
            <div key={product.id} className="product-reveal h-full" style={{ transitionDelay: `${index * 60}ms` }}>
              <ProductCard product={product} priority={index < 4} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
