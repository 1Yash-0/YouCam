'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Product } from '@/lib/products'
import { PillButton } from '@/components/PillButton'
import { MacroTilt } from '@/components/MacroTilt'
import { Glint } from '@/components/Glint'
import { TryOnDrawer } from '@/components/tryon'
import { useCart } from '@/hooks/useCart'

interface ProductDetailClientProps {
  product: Product
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const availableSizes: number[] =
    ('sizes' in product && product.sizes)
      ? product.sizes
      : ('heightCm' in product ? [2.0, 3.0, 4.5, 6.0] : [0.4, 0.6, 0.8])

  const defaultSize =
    'heightCm' in product
      ? product.heightCm
      : availableSizes[0] || 3.0

  const [selectedSizeCm, setSelectedSizeCm] = useState<number>(defaultSize)
  const [activeThumb, setActiveThumb] = useState<'main' | 'worn'>('main')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [openAccordion, setOpenAccordion] = useState<string | null>('materials')

  const { addItem, openCart } = useCart()

  // Initialize drawer open state from URL query param ?tryon=1
  useEffect(() => {
    if (searchParams.get('tryon') === '1') {
      setIsDrawerOpen(true)
    }
  }, [searchParams])

  const openDrawer = () => {
    setIsDrawerOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tryon', '1')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tryon')
    params.delete('step')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const handleAddToBag = () => {
    addItem({
      productId: product.id,
      title: product.name,
      brand: product.brand,
      sizeCm: selectedSizeCm,
      priceInr: product.priceInr,
      productImageUrl: product.imagePath,
      triedOnAtCm: selectedSizeCm,
    })
    openCart()
  }

  const toggleAccordion = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id))
  }

  // Visual proportion scale hairline height
  const scaleHairlineHeightPx = Math.round(selectedSizeCm * 35)

  return (
    <>
      <div id="page-root" className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-all duration-300">
      <style>{`
        .page-under-drawer {
          transform: scale(0.98);
          opacity: 0.4;
          filter: blur(0.5px);
          transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms cubic-bezier(0.22, 1, 0.36, 1);
          transform-origin: center right;
        }
      `}</style>
      <main className="pt-32 pb-32 px-6 sm:px-10 max-w-7xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 ui-label text-[11px] text-[var(--ink-2)]">
            <li>
              <Link href="/" className="hover:text-[var(--ink)] transition-colors">
                ATELIER
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--line)]">/</li>
            <li>
              <Link
                href={product.type === 'necklace' ? '/#necklaces' : '/'}
                className="hover:text-[var(--ink)] transition-colors"
              >
                {product.type.toUpperCase()}
              </Link>
            </li>
            <li aria-hidden="true" className="text-[var(--line)]">/</li>
            <li className="text-[var(--ink)] font-bold">{product.name}</li>
          </ol>
        </nav>

        {/* 2-Column Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Editorial Gallery (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Main Interactive Stage with Tilt & Glint */}
            <MacroTilt maxTiltDeg={5} className="w-full">
              <Glint className="w-full rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--paper)]">
                <div className="relative aspect-[4/5] w-full flex items-center justify-center p-8 sm:p-12">
                  {/* Top-left Physical Scale Cue Badge */}
                  <div className="absolute top-5 left-5 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-full border border-[var(--line)] shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                    <span className="ui-label text-[10px] text-[var(--gold)] tracking-wider tabular-nums">
                      PHYSICAL SCALE: {selectedSizeCm.toFixed(1)} CM
                    </span>
                  </div>

                  {/* Visual 1:1 Scale Hairline Cue (On side of gallery card) */}
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none">
                    <div
                      className="w-[1.5px] bg-[var(--gold)] shadow-[0_0_6px_rgba(176,138,62,0.5)] transition-[height] duration-300 ease-out"
                      style={{ height: `${Math.min(220, Math.max(60, scaleHairlineHeightPx))}px` }}
                    />
                    <span className="text-[9px] ui-label text-[var(--gold)] tabular-nums">
                      {selectedSizeCm.toFixed(1)} CM
                    </span>
                  </div>

                  {/* Active Visual Render */}
                  <div className="relative w-full h-full">
                    {activeThumb === 'main' ? (
                      <Image
                        src={product.imagePath}
                        alt={`${product.name} physical render at ${selectedSizeCm} cm`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        priority
                        className="object-contain drop-shadow-2xl"
                      />
                    ) : (
                      <Image
                        src="/sample-face.png"
                        alt={`Worn preview of ${product.name}`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="object-cover rounded-xl"
                      />
                    )}
                  </div>
                </div>
              </Glint>
            </MacroTilt>

            {/* Thumbnail Strip */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveThumb('main')}
                aria-label="View product cutout"
                className={`
                  relative w-20 h-20 rounded-xl overflow-hidden border p-2 bg-[var(--paper)] transition-all
                  focus-visible:outline-2 focus-visible:outline-[var(--gold)]
                  ${
                    activeThumb === 'main'
                      ? 'border-[var(--gold)] shadow-xs ring-1 ring-[var(--gold)]'
                      : 'border-[var(--line)] hover:border-[var(--ink-2)]'
                  }
                `}
              >
                <Image
                  src={product.imagePath}
                  alt="Product view"
                  fill
                  sizes="80px"
                  className="object-contain p-1"
                />
              </button>

              <button
                type="button"
                onClick={() => setActiveThumb('worn')}
                aria-label="View on model preview"
                className={`
                  relative w-20 h-20 rounded-xl overflow-hidden border transition-all
                  focus-visible:outline-2 focus-visible:outline-[var(--gold)]
                  ${
                    activeThumb === 'worn'
                      ? 'border-[var(--gold)] shadow-xs ring-1 ring-[var(--gold)]'
                      : 'border-[var(--line)] hover:border-[var(--ink-2)]'
                  }
                `}
              >
                <Image
                  src="/sample-face.png"
                  alt="Worn view"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
                <span className="absolute bottom-1 right-1 ui-label text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                  WORN
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Editorial Details & Actions (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Title & Brand */}
            <div>
              <span className="ui-label text-xs text-[var(--gold)] tracking-widest block mb-1">
                {product.brand}
              </span>
              <h1 className="text-3xl sm:text-4xl font-serif-italic text-[var(--ink)] tracking-tight">
                {product.name}
              </h1>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-2xl font-light text-[var(--ink)] tabular-nums">
                  ₹{product.priceInr.toLocaleString('en-IN')}
                </span>
                <span className="ui-label text-[10px] text-[var(--ink-2)]">
                  INCLUSIVE OF ALL TAXES
                </span>
              </div>
            </div>

            {/* Physical Size Selector Chips with Gliding Indicator */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="ui-label text-xs text-[var(--ink)]">
                  SELECT PHYSICAL SIZE:
                </span>
                <span className="ui-label text-xs text-[var(--gold)] tabular-nums">
                  {selectedSizeCm.toFixed(1)} CM HEIGHT
                </span>
              </div>

              <div
                className="flex items-center gap-2 p-1.5 rounded-full bg-[var(--paper)] border border-[var(--line)]"
                role="radiogroup"
                aria-label="Physical jewellery size"
              >
                {availableSizes.map((size: number) => {
                  const active = Math.abs(selectedSizeCm - size) < 0.05
                  return (
                    <button
                      key={size}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedSizeCm(size)}
                      className="relative flex-1 py-2 text-xs ui-label rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer"
                    >
                      {active && (
                        <motion.div
                          layoutId="pdpActiveSizePill"
                          className="absolute inset-0 bg-[var(--ink)] rounded-full -z-10 shadow-sm"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className={active ? 'text-white' : 'text-[var(--ink)]'}>
                        {size.toFixed(1)} CM
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <PillButton
                variant="primary"
                onClick={openDrawer}
                className="flex-1 justify-center !py-3.5 text-xs tracking-wider"
              >
                TRY ON ME
              </PillButton>

              <PillButton
                variant="secondary"
                onClick={handleAddToBag}
                className="flex-1 justify-center !py-3.5 text-xs tracking-wider"
              >
                ADD TO BAG
              </PillButton>
            </div>

            {/* Editorial Notice */}
            <div className="p-3.5 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs text-[var(--ink-2)] flex items-start gap-2.5">
              <span className="text-[var(--gold)] text-sm">✦</span>
              <p className="leading-relaxed">
                Styling extras (curated lipsticks, hairstyles, and jewellery stacks) are unlocked in the try-on mirror.
              </p>
            </div>

            {/* Accordions */}
            <div className="flex flex-col border-t border-[var(--line)]">
              {/* Accordion 1: Materials */}
              <div className="border-b border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => toggleAccordion('materials')}
                  aria-expanded={openAccordion === 'materials'}
                  className="w-full py-4 flex items-center justify-between text-left ui-label text-xs hover:text-[var(--gold)] transition-colors"
                >
                  <span>MATERIALS & ATELIER CRAFT</span>
                  <span className="text-base font-light">
                    {openAccordion === 'materials' ? '−' : '+'}
                  </span>
                </button>
                {openAccordion === 'materials' && (
                  <div className="pb-4 text-xs text-[var(--ink-2)] leading-relaxed">
                    Crafted in 18k yellow gold vermeil over recycled 925 sterling silver. Hand-buffed high-mirror finish. Nickel-safe, hypoallergenic, and treated with an invisible anti-tarnish microscopic shield.
                  </div>
                )}
              </div>

              {/* Accordion 2: Scale Guarantee */}
              <div className="border-b border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => toggleAccordion('precision')}
                  aria-expanded={openAccordion === 'precision'}
                  className="w-full py-4 flex items-center justify-between text-left ui-label text-xs hover:text-[var(--gold)] transition-colors"
                >
                  <span>TRUE-SCALE PRECISION GUARANTEE</span>
                  <span className="text-base font-light">
                    {openAccordion === 'precision' ? '−' : '+'}
                  </span>
                </button>
                {openAccordion === 'precision' && (
                  <div className="pb-4 text-xs text-[var(--ink-2)] leading-relaxed">
                    Calibrated to the 11.7 mm anatomical human iris diameter. Every virtual try-on render undergoes diff-box component verification to ensure ±10% physical scale tolerance before being presented on your photo.
                  </div>
                )}
              </div>

              {/* Accordion 3: Dimensions */}
              <div className="border-b border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => toggleAccordion('dimensions')}
                  aria-expanded={openAccordion === 'dimensions'}
                  className="w-full py-4 flex items-center justify-between text-left ui-label text-xs hover:text-[var(--gold)] transition-colors"
                >
                  <span>DIMENSIONS & WEIGHT</span>
                  <span className="text-base font-light">
                    {openAccordion === 'dimensions' ? '−' : '+'}
                  </span>
                </button>
                {openAccordion === 'dimensions' && (
                  <div className="pb-4 text-xs text-[var(--ink-2)] leading-relaxed space-y-1">
                    <p>Height: <strong className="text-[var(--ink)]">{selectedSizeCm.toFixed(1)} cm</strong></p>
                    <p>Width: <strong className="text-[var(--ink)]">{'widthCm' in product ? product.widthCm : 1.3} cm</strong></p>
                    <p>Estimated weight: <strong className="text-[var(--ink)]">~4.2g per piece</strong></p>
                  </div>
                )}
              </div>

              {/* Accordion 4: Shipping & Exchanges */}
              <div className="border-b border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => toggleAccordion('shipping')}
                  aria-expanded={openAccordion === 'shipping'}
                  className="w-full py-4 flex items-center justify-between text-left ui-label text-xs hover:text-[var(--gold)] transition-colors"
                >
                  <span>CARE, SHIPPING & EXCHANGES</span>
                  <span className="text-base font-light">
                    {openAccordion === 'shipping' ? '−' : '+'}
                  </span>
                </button>
                {openAccordion === 'shipping' && (
                  <div className="pb-4 text-xs text-[var(--ink-2)] leading-relaxed">
                    Free express insured delivery across India in our signature jewellery gift box. Complimentary 14-day exchange if the physical size does not match your in-person expectation.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Bar (< 768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--paper)]/95 backdrop-blur-md border-t border-[var(--line)] px-6 py-3.5 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-lg font-light text-[var(--ink)] tabular-nums block">
            ₹{product.priceInr.toLocaleString('en-IN')}
          </span>
          <span className="ui-label text-[10px] text-[var(--gold)] tabular-nums">
            {selectedSizeCm.toFixed(1)} CM
          </span>
        </div>

        <PillButton
          variant="primary"
          onClick={openDrawer}
          className="!py-2.5 !px-5 text-xs tracking-wider"
        >
          TRY ON ME
        </PillButton>
      </div>
      </div>

      {/* Slide-over Try-On Drawer */}
      <TryOnDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        product={product}
        initialSizeCm={selectedSizeCm}
      />
    </>
  )
}
