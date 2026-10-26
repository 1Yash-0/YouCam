'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Product } from '@/lib/products'
import { formatPrice } from '@/lib/format'
import { getProductDisplayImageUrl, isFullBleedPhoto } from '@/lib/product-capabilities'

export const WORN_IMAGE_MAP: Record<string, string> = {
  'gilded-teardrop': '/samples/single-teardrop-3cm.png',
  'dot-stud': '/samples/dot-stud-0.6cm.png',
  // real ear-flow renders on the sample face at true size (scripts/catalogue/render-earrings.mjs): 5.96 / 4.00 cm measured
  'met-gold-earring': '/products/worn/met-gold-earring.jpg',
  'met-gold-pendant': '/products/worn/met-gold-pendant-upright.jpg',
  'orb-chain': '/samples/necklace.png',
  'emerald-blouse': '/api/sample/outfit/image',
  // Hand pieces: real renders on the demo wrist via the production fit (scripts/catalogue/render-watches.mjs)
  'atlantic-classic': '/products/worn/atlantic-classic.jpg',
  'marshal-petite': '/products/worn/marshal-petite.jpg',
  // scripts/catalogue/render-hand.mjs (API auto-fit on the demo hand/wrist)
  'met-snake-bracelet': '/products/worn/met-snake-bracelet.jpg',
  'met-carnelian-bracelet': '/products/worn/met-carnelian-bracelet.jpg',
  'met-open-cuff': '/products/worn/met-open-cuff.jpg',
  'met-bead-ring': '/products/worn/met-bead-ring.jpg',
  'met-carnelian-ring': '/products/worn/met-carnelian-ring.jpg',
  'met-plasma-ring': '/products/worn/met-plasma-ring.jpg',
}

export function getWornImageUrl(product: { id: string }): string | undefined {
  return WORN_IMAGE_MAP[product.id]
}

export interface ProductCardProps {
  product: Product
  className?: string
  /** Load the cut-out eagerly with high fetch priority. Set it for the first row, which sits above the fold. */
  priority?: boolean
}

export function getProductMeta(product: Product): string {
  if (product.type === 'necklace') return `about ${product.lengthCm} cm`
  if (product.type === 'single' || product.type === 'stud') {
    return `${product.metal} · ${product.heightCm.toFixed(1)} cm`
  }
  if (product.type === 'watch') return `${product.sizeEstimated ? 'about ' : ''}${product.caseMm} mm case`
  if (product.type === 'ring') return product.stoneMm ? `${product.metal} · ${product.sizeEstimated ? 'about ' : ''}${product.stoneMm} mm stone` : `${product.metal} · ${product.diameterMm} mm across`
  if (product.type === 'bracelet') return `${product.metal} · ${product.diameterMm} mm across`
  return ''
}

export function getProductSourceCredit(product: Product): string {
  if (product.source.includes('metmuseum.org')) return 'Met Heritage, public domain'
  if (product.source.startsWith('Generated with YouCam AI Image Generator')) return ''
  const photographer = product.source.match(/\(photo: ([^)]+)\)/)
  if (photographer) return `Photo: ${photographer[1]}, ${product.licence}`
  return product.source
}

export function getProductBadgeLabel(product: Product): string {
  if (product.type === 'single' || product.type === 'stud') return `${product.heightCm.toFixed(1)} CM`
  if (product.type === 'necklace') return `ABOUT ${product.lengthCm} CM`
  if (product.type === 'watch') return `${product.sizeEstimated ? 'ABOUT ' : ''}${product.caseMm} MM`
  if (product.type === 'ring') return product.stoneMm ? `${product.sizeEstimated ? 'ABOUT ' : ''}${product.stoneMm} MM STONE` : `${product.diameterMm} MM`
  if (product.type === 'bracelet') return `${product.diameterMm} MM`
  return 'TRUE FIT'
}

// The grid is two columns on phones and four on desktop.
const CARD_IMAGE_SIZES = '(max-width: 1023px) 50vw, 25vw'

type CardView = 'cutout' | 'worn'

/**
 * A shop card: a square paper stage, the name and price, the size, and one
 * "Try it on" action. The whole card links to the product page.
 */
export function ProductCard({ product, className = '', priority = false }: ProductCardProps) {
  const [isTouch, setIsTouch] = useState(false)
  const [touchView, setTouchView] = useState<CardView>('worn')

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    // Touch screens have no hover, so they show the worn render first and offer a toggle back to the cut-out.
    const touchQuery = window.matchMedia('(hover: none)')
    setIsTouch(touchQuery.matches)
    const handleChange = (event: MediaQueryListEvent) => setIsTouch(event.matches)
    touchQuery.addEventListener('change', handleChange)

    return () => {
      touchQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const wornUrl = getWornImageUrl(product)
  const hasWornImage = Boolean(wornUrl)
  const wornShownOnTouch = touchView === 'worn'

  // Fine pointers crossfade on hover or keyboard focus. Touch screens follow the toggle instead.
  let cutoutState = 'opacity-100'
  let wornState = ''
  if (hasWornImage && isTouch) {
    cutoutState = wornShownOnTouch ? 'opacity-0' : 'opacity-100'
    wornState = wornShownOnTouch ? 'opacity-100 [transform:scale(1)]' : 'opacity-0 [transform:scale(1.04)]'
  } else if (hasWornImage) {
    cutoutState = 'opacity-100 group-hover:opacity-0 group-focus-within:opacity-0'
    wornState =
      'opacity-0 [transform:scale(1.04)] group-hover:opacity-100 group-hover:[transform:scale(1)] group-focus-within:opacity-100 group-focus-within:[transform:scale(1)]'
  }

  // Full-bleed photos fill the square. Transparent cut-outs sit centred on paper with padding.
  const cutoutFit = isFullBleedPhoto(product) ? 'object-cover' : 'object-contain p-[12%]'
  const tryOnState = isTouch ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'

  return (
    <article
      aria-label={`${product.name} product card`}
      className={`group relative flex h-full flex-col ${className}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--paper)]">
        <Image
          src={getProductDisplayImageUrl(product)}
          alt={`${product.name} studio image`}
          fill
          sizes={CARD_IMAGE_SIZES}
          className={`product-cutout ${cutoutFit} ${cutoutState}`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          onError={(event) => {
            if (product.id === 'dot-stud') {
              event.currentTarget.src = '/products/dot-stud.png'
            }
          }}
        />

        {wornUrl && (
          <Image
            src={wornUrl}
            alt={`Worn preview of ${product.name} on model`}
            fill
            sizes={CARD_IMAGE_SIZES}
            className={`product-worn object-cover ${wornState}`}
          />
        )}

        {isTouch && hasWornImage && (
          <div
            role="group"
            aria-label={`${product.name} view`}
            className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-[var(--paper)] px-1 text-[15px]"
          >
            <button
              type="button"
              aria-pressed={!wornShownOnTouch}
              onClick={() => setTouchView('cutout')}
              className={`min-h-11 px-2 transition-colors duration-[180ms] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] ${
                wornShownOnTouch ? 'text-[var(--ink-2)]' : 'text-[var(--ink)] underline decoration-[var(--gold)] decoration-2 underline-offset-[6px]'
              }`}
            >
              Cut-out
            </button>
            <button
              type="button"
              aria-pressed={wornShownOnTouch}
              onClick={() => setTouchView('worn')}
              className={`min-h-11 px-2 transition-colors duration-[180ms] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] ${
                wornShownOnTouch ? 'text-[var(--ink)] underline decoration-[var(--gold)] decoration-2 underline-offset-[6px]' : 'text-[var(--ink-2)]'
              }`}
            >
              Worn
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-display text-[20px] text-[var(--ink)]">
            {/* The stretched link makes the whole card one link to the product page. */}
            <Link
              href={`/p/${product.id}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
            >
              {product.name}
            </Link>
          </h3>
          <span className="tabular-nums text-[16px] text-[var(--ink-2)]">{formatPrice(product.priceUsd)}</span>
        </div>

        <p className="mt-1 text-[15px] text-[var(--ink-2)]">{getProductMeta(product)}</p>

        <div className="mt-auto pt-4">
          <Link
            href={`/try-on/${product.id}?sample=1`}
            data-press
            className={`try-reveal link-draw relative z-20 inline-block self-start leading-none before:absolute before:-inset-3 before:content-[''] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] text-[15px] text-[var(--ink)] ${tryOnState}`}
          >
            Try it on
          </Link>
        </div>
      </div>
    </article>
  )
}
