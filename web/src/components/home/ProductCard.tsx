'use client'

import React, { useState, useRef, useEffect, MouseEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Product } from '@/lib/products'
import { PillButton } from '@/components/PillButton'
import { MacroTilt } from '@/components/MacroTilt'
import { Glint } from '@/components/Glint'
import { FloatingCursor } from './FloatingCursor'

export const WORN_IMAGE_MAP: Record<string, string> = {
  'gilded-teardrop': '/api/sample/single-teardrop-3cm/image',
  'met-gold-earring': '/api/sample/earring-6cm/image',
  'met-gold-pendant': '/api/sample/single-teardrop-3cm/image',
  'orb-chain': '/api/sample/necklace/image',
  'dot-stud': '/api/sample/stud-drop-stack/image',
  'emerald-blouse': '/api/sample/outfit/image',
}

export function getWornImageUrl(product: { id: string }): string {
  return WORN_IMAGE_MAP[product.id] || '/sample-face.png'
}

export function formatInr(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price)
}

export interface ProductCardProps {
  product: Product
  className?: string
}

export function ProductCard({ product, className = '' }: ProductCardProps) {
  const [touchView, setTouchView] = useState<'cutout' | 'worn'>('cutout')
  const [isFinePointer, setIsFinePointer] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [cursorLabel, setCursorLabel] = useState('EXPLORE')
  const imageContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fineQuery = window.matchMedia('(pointer: fine)')
    setIsFinePointer(fineQuery.matches)
    const handleFine = (e: MediaQueryListEvent) => setIsFinePointer(e.matches)
    fineQuery.addEventListener('change', handleFine)

    const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(rmQuery.matches)
    const handleRm = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    rmQuery.addEventListener('change', handleRm)

    return () => {
      fineQuery.removeEventListener('change', handleFine)
      rmQuery.removeEventListener('change', handleRm)
    }
  }, [])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isFinePointer || prefersReducedMotion || !imageContainerRef.current) return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCursorPos({ x, y })
    // If hovering top 70%, show "TRY ON", else "EXPLORE"
    setCursorLabel(y < rect.height * 0.7 ? 'TRY ON' : 'EXPLORE')
  }

  const handleMouseEnter = () => {
    if (isFinePointer && !prefersReducedMotion) {
      setIsHovered(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  const sizeLabel =
    product.type === 'single' || product.type === 'stud'
      ? `${product.heightCm.toFixed(1)} CM`
      : product.type === 'necklace'
      ? `${(product as any).lengthCm} CM`
      : 'TRUE FIT'

  const wornUrl = getWornImageUrl(product)

  return (
    <MacroTilt maxTiltDeg={4} className={`h-full ${className}`}>
      <article
        aria-label={`${product.name} product card`}
        className="group relative flex flex-col h-full bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4 sm:p-5 transition-shadow hover:shadow-xl"
      >
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--paper)] text-[var(--gold)] border border-[var(--gold)]/30 ui-label text-[10px] font-bold tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
            <span>{sizeLabel}</span>
          </span>

          <span className="ui-label text-[10px] text-[var(--ink-2)] tracking-wider">
            {product.brand.toUpperCase()}
          </span>
        </div>

        {/* Glint Wrapped Interactive Image Stage */}
        <div
          ref={imageContainerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-[var(--paper)] border border-[var(--line)] mb-4 select-none cursor-pointer"
        >
          <Link
            href={`/p/${product.id}?tryon=1`}
            aria-label={`Try on ${product.name}`}
            className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            <Glint className="w-full h-full">
              {/* Layer 0: Studio Cutout Image */}
              <div
                className={`
                  absolute inset-0 flex items-center justify-center p-8 transition-all duration-500 ease-out
                  ${
                    touchView === 'worn'
                      ? 'opacity-0 scale-95'
                      : 'opacity-100 group-hover:opacity-0 group-hover:scale-105'
                  }
                `}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={product.imagePath}
                    alt={`${product.name} studio cutout`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-contain drop-shadow-md"
                    priority={false}
                  />
                </div>
              </div>

              {/* Layer 1: Model-Worn Photo Preview */}
              <div
                className={`
                  absolute inset-0 transition-all duration-500 ease-out
                  ${
                    touchView === 'worn'
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-102 group-hover:opacity-100 group-hover:scale-100'
                  }
                `}
              >
                <Image
                  src={wornUrl}
                  alt={`Worn preview of ${product.name} on model`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                  priority={false}
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[var(--ink)]/80 backdrop-blur-xs text-white text-[9px] ui-label">
                  WORN SCALE
                </div>
              </div>
            </Glint>
          </Link>

          {/* Touch View Toggle (Visible on coarse touch pointers) */}
          {!isFinePointer && (
            <div className="absolute bottom-2 left-2 z-20 flex bg-white/90 backdrop-blur-xs rounded-full border border-[var(--line)] p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setTouchView('cutout')}
                className={`px-2 py-1 rounded-full text-[9px] ui-label ${
                  touchView === 'cutout'
                    ? 'bg-[var(--ink)] text-white'
                    : 'text-[var(--ink-2)]'
                }`}
              >
                CUTOUT
              </button>
              <button
                type="button"
                onClick={() => setTouchView('worn')}
                className={`px-2 py-1 rounded-full text-[9px] ui-label ${
                  touchView === 'worn'
                    ? 'bg-[var(--ink)] text-white'
                    : 'text-[var(--ink-2)]'
                }`}
              >
                WORN
              </button>
            </div>
          )}

          {/* Floating Cursor Pill */}
          {isFinePointer && !prefersReducedMotion && (
            <FloatingCursor
              x={cursorPos.x}
              y={cursorPos.y}
              visible={isHovered}
              label={cursorLabel}
            />
          )}
        </div>

        {/* Product Details & Pricing */}
        <div className="flex flex-col flex-1 justify-between gap-3">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-normal text-[var(--ink)] group-hover:text-[var(--gold)] transition-colors">
                <Link
                  href={`/p/${product.id}`}
                  className="focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2 rounded-xs"
                >
                  {product.name}
                </Link>
              </h3>
              <span
                aria-label={`Price: ${product.priceInr} Indian Rupees`}
                className="tabular-nums font-medium text-[var(--ink)] text-base tracking-tight"
              >
                {formatInr(product.priceInr)}
              </span>
            </div>

            <p className="text-xs text-[var(--ink-2)] mt-0.5 font-normal">
              {'metal' in product ? `${product.metal} · ` : ''}
              {sizeLabel} True Size
            </p>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]/60">
            <div className="flex-1">
              <PillButton
                href={`/p/${product.id}?tryon=1`}
                variant="primary"
                className="w-full text-center text-xs justify-center py-2"
              >
                TRY ON ME
              </PillButton>
            </div>
            <Link
              href={`/p/${product.id}`}
              className="px-3 py-2 rounded-full border border-[var(--line)] text-xs ui-label text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2"
            >
              DETAILS
            </Link>
          </div>
        </div>
      </article>
    </MacroTilt>
  )
}
