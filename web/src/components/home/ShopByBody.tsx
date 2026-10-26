'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { formatPrice } from '@/lib/format'
import type { Product } from '@/lib/products'
import { RevealLines } from '../motion/Reveal'
import { WORN_IMAGE_MAP, getProductMeta } from './ProductCard'
import styles from './ShopByBody.module.css'

type ProductType = Product['type']

export interface ShopTab {
  id: string
  label: string
  products: Product[]
}

const TAB_DEFINITIONS: ReadonlyArray<{ id: string; label: string; types: readonly ProductType[] }> = [
  { id: 'earrings', label: 'Earrings', types: ['single', 'stud'] },
  { id: 'necklaces', label: 'Necklaces', types: ['necklace'] },
  { id: 'rings', label: 'Rings', types: ['ring'] },
  { id: 'bracelets', label: 'Bracelets', types: ['bracelet'] },
  { id: 'watches', label: 'Watches', types: ['watch'] },
]

/** One tab per category that has products, in display order. Garments are styling, not jewellery, so they get no tab. */
export function buildShopTabs(products: readonly Product[]): ShopTab[] {
  const jewellery = products.filter((product) => product.type !== 'garment')
  return TAB_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    products: jewellery.filter((product) => definition.types.includes(product.type)),
  })).filter((tab) => tab.products.length > 0)
}

/** Where a key press moves the selected tab: arrows wrap, Home and End jump. Returns null for any other key. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count
    case 'ArrowLeft':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Desktop only. The active row follows scroll position, and only when the list is taller than the viewport.
const DESKTOP_QUERY = '(min-width: 900px)'
const ROW_BAND = '-45% 0px -45% 0px'

export interface ShopByBodyProps {
  products: Product[]
}

export function ShopByBody({ products }: ShopByBodyProps) {
  const uid = useId()
  const headingId = `${uid}-heading`
  const panelId = `${uid}-panel`
  const tabs = buildShopTabs(products)

  const [selectedIndex, setSelectedIndex] = useState(0)
  // null means the selected tab's first product. A tab switch resets to it.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bar, setBar] = useState({ x: 0, width: 0 })
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listRef = useRef<HTMLUListElement | null>(null)

  const measureBar = useCallback(() => {
    const el = tabRefs.current[selectedIndex]
    if (el) setBar({ x: el.offsetLeft, width: el.offsetWidth })
  }, [selectedIndex])

  useIsoLayoutEffect(() => {
    measureBar()
  }, [measureBar])

  useEffect(() => {
    window.addEventListener('resize', measureBar)
    // Tab widths depend on the sans face, so measure again once the fonts have loaded.
    void document.fonts?.ready.then(measureBar)
    return () => window.removeEventListener('resize', measureBar)
  }, [measureBar])

  useEffect(() => {
    const list = listRef.current
    if (!list || typeof IntersectionObserver === 'undefined') return

    const desktop = window.matchMedia(DESKTOP_QUERY)
    let observer: IntersectionObserver | null = null

    const attach = () => {
      observer?.disconnect()
      observer = null
      if (!desktop.matches || list.offsetHeight <= window.innerHeight) return

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.getAttribute('data-row-id')
            if (entry.isIntersecting && id) setActiveId(id)
          }
        },
        { rootMargin: ROW_BAND },
      )
      list.querySelectorAll('[data-row-id]').forEach((row) => observer?.observe(row))
    }

    attach()
    window.addEventListener('resize', attach)
    return () => {
      window.removeEventListener('resize', attach)
      observer?.disconnect()
    }
  }, [selectedIndex])

  const tab = tabs[Math.min(selectedIndex, tabs.length - 1)]
  if (!tab) return null

  const activeProduct = tab.products.find((product) => product.id === activeId) ?? tab.products[0]
  // Only the selected tab's worn images are rendered, so one tab at a time is requested.
  const frameProducts = tab.products.filter((product) => WORN_IMAGE_MAP[product.id])

  const selectTab = (index: number) => {
    if (index === selectedIndex) return
    setSelectedIndex(index)
    setActiveId(null)
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = nextTabIndex(event.key, index, tabs.length)
    if (target === null) return
    event.preventDefault()
    selectTab(target)
    tabRefs.current[target]?.focus()
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setActiveId(id)
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.inner}>
        <RevealLines id={headingId} as="h2" text="Shop by where you wear it." className={styles.heading} />

        <div className={styles.grid}>
          <div className={styles.visual}>
            <div className={styles.frame}>
              <div key={tab.id} className={styles.stack}>
                {frameProducts.map((product, index) => {
                  const isActive = product.id === activeProduct.id
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={product.id}
                      src={WORN_IMAGE_MAP[product.id]}
                      alt={`Worn preview of ${product.name} on model`}
                      width={800}
                      height={1000}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      aria-hidden={isActive ? undefined : true}
                      className={isActive ? `${styles.image} ${styles.imageActive}` : styles.image}
                    />
                  )
                })}
              </div>
            </div>
            <p className={styles.caption}>
              {activeProduct.name}
              {' · '}
              <span className={styles.captionMeta}>{getProductMeta(activeProduct)}</span>
            </p>
          </div>

          <div className={styles.panel}>
            <div role="tablist" aria-label="Categories" className={styles.tabs}>
              {tabs.map((item, index) => {
                const selected = index === selectedIndex
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      tabRefs.current[index] = el
                    }}
                    id={`${uid}-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectTab(index)}
                    onKeyDown={(event) => onTabKeyDown(event, index)}
                    className={selected ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                  >
                    {item.label}
                  </button>
                )
              })}
              <span
                aria-hidden="true"
                className={styles.bar}
                style={{ transform: `translate3d(${bar.x}px, 0, 0) scaleX(${bar.width})` }}
              />
            </div>

            <div role="tabpanel" id={panelId} aria-labelledby={`${uid}-tab-${tab.id}`}>
              <ul ref={listRef} className={styles.list}>
                {tab.products.map((product) => {
                  const isActive = product.id === activeProduct.id
                  const expanderId = `${uid}-more-${product.id}`
                  return (
                    <li
                      key={product.id}
                      className={styles.item}
                      onMouseEnter={() => setActiveId(product.id)}
                      onFocus={() => setActiveId(product.id)}
                      onClick={() => setActiveId(product.id)}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isActive}
                        aria-controls={expanderId}
                        data-row-id={product.id}
                        className={isActive ? `${styles.row} ${styles.rowActive}` : styles.row}
                        onKeyDown={(event) => onRowKeyDown(event, product.id)}
                      >
                        <span className={styles.name}>{product.name}</span>
                        <span className={styles.meta}>
                          <span>{getProductMeta(product)}</span>
                          <span className={styles.price}>{formatPrice(product.priceUsd)}</span>
                        </span>
                      </div>
                      {/* Collapsed rows keep their links in the markup but make them inert, so they cannot be tabbed to. */}
                      <div
                        id={expanderId}
                        className={isActive ? `${styles.expander} ${styles.expanderOpen}` : styles.expander}
                        inert={!isActive}
                      >
                        <div className={styles.expanderInner}>
                          <div className={styles.actions}>
                            <Link href={`/try-on/${product.id}?sample=1`} data-press="" className={styles.tryOn}>
                              Try it on
                            </Link>
                            <Link href={`/p/${product.id}`} className={`link-draw ${styles.details}`}>
                              Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <Link href="/collection" className={`link-draw ${styles.more}`}>
              See all pieces
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
