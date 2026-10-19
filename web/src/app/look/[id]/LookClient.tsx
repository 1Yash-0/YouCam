'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { PillButton } from '@/components/PillButton'
import { MacroTilt } from '@/components/MacroTilt'
import { Glint } from '@/components/Glint'
import { TryOnDrawer } from '@/components/tryon'
import { useToast } from '@/components/Toast'
import { Product } from '@/lib/products'

interface LookRecord {
  id: string
  createdAt?: string
  flow?: string
  productId: string
  sizeCm?: number
  stack?: string[]
  options?: {
    lipstick?: {
      id?: string
      name?: string
      hex: string
      texture?: 'matte' | 'satin' | 'gloss' | 'shimmer'
      intensity?: number
    }
    hairUp?: {
      templateId: string
      title?: string
    }
    outfit?: {
      productId: string
      title?: string
    }
    metal?: 'gold' | 'silver' | 'rose gold'
    [key: string]: any
  }
}

interface LookClientProps {
  lookId: string
}

export function LookClient({ lookId }: LookClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const [look, setLook] = useState<LookRecord | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Fetch look data from GET /api/looks/[id]
  useEffect(() => {
    let isMounted = true

    async function loadLook() {
      setLoading(true)
      setNotFound(false)
      try {
        const res = await fetch(`/api/looks/${encodeURIComponent(lookId)}`)
        if (res.status === 404 || !res.ok) {
          if (isMounted) {
            setNotFound(true)
            setLoading(false)
          }
          return
        }
        const data: LookRecord = await res.json()
        if (!isMounted) return
        setLook(data)

        // Fetch products to resolve product details
        const prodRes = await fetch('/api/products')
        if (prodRes.ok) {
          const prods: Product[] = await prodRes.json()
          const matched = prods.find((p) => p.id === data.productId)
          if (matched && isMounted) {
            setProduct(matched)
          }
        }
      } catch (err) {
        console.error('Error fetching look:', err)
        if (isMounted) setNotFound(true)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadLook()
    return () => {
      isMounted = false
    }
  }, [lookId])

  // Sync drawer state with URL search param ?tryon=1
  useEffect(() => {
    if (searchParams.get('tryon') === '1') {
      setIsDrawerOpen(true)
    }
  }, [searchParams])

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tryon', '1')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tryon')
    params.delete('step')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const handleShareLook = async () => {
    const fullUrl = typeof window !== 'undefined' ? window.location.href : `/look/${lookId}`
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl)
        showToast({
          message: 'Permalink copied to clipboard!',
          variant: 'gold',
        })
      } else {
        showToast({
          message: `Share URL: ${fullUrl}`,
          variant: 'default',
        })
      }
    } catch {
      showToast({
        message: 'Could not copy link automatically.',
        variant: 'warn',
      })
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <span className="ui-label text-xs text-[var(--gold)] block mb-2">HYDRATING PRESETS</span>
        <p className="text-sm text-[var(--ink-2)]">Loading curated styling configuration…</p>
      </div>
    )
  }

  if (notFound || !look) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 md:p-12 text-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)]">
        <span className="ui-label text-[10px] text-[var(--gold)] block mb-2">ARCHIVED PRESET</span>
        <h2 className="text-3xl font-light text-[var(--ink)] mb-3">
          Look <span className="font-serif-italic">Not Found</span>
        </h2>
        <p className="text-sm text-[var(--ink-2)] leading-relaxed mb-8">
          This curated look (#{lookId}) is no longer available or the link has expired. Explore our core jewellery collection to create your own signature try-on.
        </p>
        <PillButton href="/" variant="primary">
          EXPLORE THE COLLECTION
        </PillButton>
      </div>
    )
  }

  // Fallback product info if catalogue lookup not finished
  const displayTitle = product?.name || look.productId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const displayBrand = product?.brand || 'Kaari Studio'
  const displayPrice = product?.priceInr ? `₹${product.priceInr.toLocaleString('en-IN')}` : '₹1,499'
  const displayImage = product?.imagePath || '/products/gilded-teardrop.png'
  const displaySizeCm = look.sizeCm || ('heightCm' in (product || {}) ? (product as any).heightCm : 3.0)

  // Styling presets from look
  const lipstick = look.options?.lipstick
  const hairUp = look.options?.hairUp
  const outfit = look.options?.outfit
  const metal = look.options?.metal
  const stack = look.stack

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left Column: Product Photo & Visual Signature */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <MacroTilt maxTiltDeg={7} className="w-full max-w-md">
            <div className="relative aspect-[4/5] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] overflow-hidden shadow-sm flex items-center justify-center p-8 group">
              <Image
                src={displayImage}
                alt={displayTitle}
                fill
                priority
                unoptimized
                className="object-contain p-6 group-hover:scale-105 transition-transform duration-500"
              />
              <Glint triggerOnHover angleDeg={-35} durationMs={800} />

              {/* Physical Size Badge */}
              <div className="absolute top-4 left-4 bg-[var(--paper)]/90 backdrop-blur-xs border border-[var(--line)] px-2.5 py-1 rounded-full text-[10px] ui-label text-[var(--gold)] flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                <span>{displaySizeCm} CM PHYSICAL SCALE</span>
              </div>
            </div>
          </MacroTilt>

          <span className="ui-label text-[10px] text-[var(--ink-2)] mt-3">
            Calibrated to 11.7 mm iris diameter constant
          </span>
        </div>

        {/* Right Column: Look Details, Styling Options & CTAs */}
        <div className="lg:col-span-7 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="ui-label text-[10px] text-[var(--gold)] tracking-widest">
                CURATED ATELIER LOOK
              </span>
              <span className="ui-label text-[10px] text-[var(--ink-2)] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
                #{lookId}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-[var(--ink)] mb-2">
              {displayTitle}
            </h1>
            <p className="ui-label text-xs text-[var(--ink-2)] tracking-wider mb-4">
              {displayBrand} · <span className="text-[var(--ink)] font-medium">{displayPrice}</span>
            </p>
            <p className="text-sm text-[var(--ink-2)] leading-relaxed max-w-xl">
              This saved styling arrangement restores the exact physical jewellery scale and harmonious cosmetic accents calibrated for this ensemble.
            </p>
          </div>

          {/* Styling Options & Presets Grid */}
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-[var(--radius-sm)] p-6 space-y-5">
            <span className="ui-label text-[10px] text-[var(--ink-2)] uppercase tracking-wider block">
              Active Styling Presets
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Lipstick Option */}
              <div className="p-3.5 rounded bg-white/40 dark:bg-black/20 border border-[var(--line)] flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border border-black/10 shrink-0 shadow-xs"
                  style={{ backgroundColor: lipstick?.hex || '#9B1B30' }}
                  title={lipstick?.name || 'Curated Lipstick'}
                />
                <div>
                  <span className="ui-label text-[9px] text-[var(--ink-2)] block">
                    LIPSTICK HARMONY
                  </span>
                  <div className="text-xs font-medium text-[var(--ink)] capitalize">
                    {lipstick?.name || 'Berry / Zari Red'}
                  </div>
                  <span className="text-[10px] text-[var(--ink-2)] uppercase font-mono">
                    {lipstick?.texture || 'satin'} · {lipstick?.hex || '#9B1B30'}
                  </span>
                </div>
              </div>

              {/* Precious Metal */}
              <div className="p-3.5 rounded bg-white/40 dark:bg-black/20 border border-[var(--line)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#FFDF73] via-[#D4AF37] to-[#AA771C] border border-[#D4AF37]/40 shrink-0 shadow-xs" />
                <div>
                  <span className="ui-label text-[9px] text-[var(--ink-2)] block">
                    RECOMMENDED METAL
                  </span>
                  <div className="text-xs font-medium text-[var(--ink)] capitalize">
                    {metal ? `${metal} tone` : '18k Yellow Gold'}
                  </div>
                  <span className="text-[10px] text-[var(--ink-2)]">Warm tone harmony</span>
                </div>
              </div>

              {/* Hair Updo */}
              <div className="p-3.5 rounded bg-white/40 dark:bg-black/20 border border-[var(--line)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 border border-[var(--line)] flex items-center justify-center text-xs font-serif shrink-0">
                  ✦
                </div>
                <div>
                  <span className="ui-label text-[9px] text-[var(--ink-2)] block">
                    HAIR STYLING
                  </span>
                  <div className="text-xs font-medium text-[var(--ink)]">
                    {hairUp?.title || 'Two Braids Updo'}
                  </div>
                  <span className="text-[10px] text-[var(--ink-2)]">Ear visible template</span>
                </div>
              </div>

              {/* Outfit / Earring Stack */}
              <div className="p-3.5 rounded bg-white/40 dark:bg-black/20 border border-[var(--line)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 border border-[var(--line)] flex items-center justify-center text-xs font-serif shrink-0">
                  {stack && stack.length > 0 ? '◈' : '👗'}
                </div>
                <div>
                  <span className="ui-label text-[9px] text-[var(--ink-2)] block">
                    {stack && stack.length > 0 ? 'EAR STACK' : 'ATTIRE ENSEMBLE'}
                  </span>
                  <div className="text-xs font-medium text-[var(--ink)]">
                    {stack && stack.length > 0
                      ? `${stack[0]} Stack Accent`
                      : outfit?.title || 'Emerald Silk Blouse'}
                  </div>
                  <span className="text-[10px] text-[var(--ink-2)]">Coordinated palette</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-4">
              <PillButton
                onClick={handleOpenDrawer}
                variant="primary"
                className="cursor-pointer"
              >
                TRY THIS LOOK ON ME
              </PillButton>

              <PillButton
                onClick={handleShareLook}
                variant="secondary"
                className="cursor-pointer"
              >
                SHARE LOOK
              </PillButton>

              {product && (
                <Link
                  href={`/p/${product.id}`}
                  className="ui-label text-xs text-[var(--ink-2)] hover:text-[var(--gold)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] transition-colors ml-auto"
                >
                  VIEW PRODUCT DETAILS →
                </Link>
              )}
            </div>

            <p className="text-[11px] text-[var(--ink-2)] leading-relaxed">
              Tapping &quot;TRY THIS LOOK ON ME&quot; loads this exact {displaySizeCm} cm piece and styling presets onto your portrait with iris calibration.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded Try-On Drawer */}
      {product && (
        <TryOnDrawer
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          product={product}
          initialSizeCm={displaySizeCm}
        />
      )}
    </>
  )
}
