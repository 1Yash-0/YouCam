'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MacroTilt } from '@/components/MacroTilt'
import { getProductCapabilities } from '@/lib/product-capabilities'
import { useToast } from '@/components/Toast'
import { Product } from '@/lib/products'
import { formatPrice } from '@/lib/format'

// Shared classes for this page. Body copy is 17px ink in one measure; buttons are solid ink, square, 52px tall.
const bodyClass = 'text-[17px] leading-[1.6] text-[var(--ink)]'
const captionClass = 'text-[16px] leading-[1.5] text-[var(--ink-2)]'
const solidButtonClass =
  'inline-flex h-[52px] cursor-pointer items-center bg-[var(--ink)] px-7 text-[16px] text-[var(--paper)] transition-opacity duration-[180ms] ease-[var(--ease-out)] hover:opacity-[0.86]'

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
  imageUrl?: string
}

interface LookClientProps {
  lookId: string
}

export function LookClient({ lookId }: LookClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const [look, setLook] = useState<LookRecord | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const isDrawerOpen = searchParams.get('tryon') === '1'
  useEffect(() => {
    if (isDrawerOpen && product) router.replace(product.type === 'garment' ? '/collection' : `/try-on/${product.id}${look?.sizeCm ? `?size=${look.sizeCm}` : ''}`)
  }, [isDrawerOpen, product, look?.sizeCm, router])

  // Fetch look data from GET /api/looks/[id]
  useEffect(() => {
    let isMounted = true

    async function loadLook() {
      setLoading(true)
      setNotFound(false)
      try {
        const res = await fetch(`/api/looks/${encodeURIComponent(lookId)}`)
        let data: LookRecord

        if (res.ok) {
          data = await res.json()
        } else {
          // The Looks index uses the same cached sample manifest. Resolve those
          // IDs here so every sample card has a working detail route.
          const samplesRes = await fetch('/api/sample')
          const samples = samplesRes.ok ? await samplesRes.json() : []
          const sample = samples.find((entry: LookRecord) => entry.id === lookId)
          if (!sample) {
            if (isMounted) {
              setNotFound(true)
              setLoading(false)
            }
            return
          }
          data = sample
        }

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

  const handleOpenDrawer = () => {
    if (product) router.push(product.type === 'garment' ? '/collection' : `/try-on/${product.id}${look?.sizeCm ? `?size=${look.sizeCm}` : ''}`)
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
      <div className="py-24">
        <p className={captionClass}>Loading curated styling configuration…</p>
      </div>
    )
  }

  if (notFound || !look) {
    return (
      <div className="max-w-xl py-12">
        <h1 className="font-display text-4xl text-[var(--ink)]">Look not found</h1>
        <p className={`mt-4 max-w-[62ch] ${bodyClass}`}>
          This curated look (#{lookId}) is no longer available or the link has expired. Explore our core jewellery collection to create your own signature try-on.
        </p>
        <Link href="/" className={`mt-8 ${solidButtonClass}`}>
          Explore the collection
        </Link>
      </div>
    )
  }

  // Fallback product info if catalogue lookup not finished
  const displayTitle = product?.name || look.productId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const displayBrand = product?.brand || 'Darpan'
  const displayPrice = product?.priceUsd ? formatPrice(product.priceUsd) : formatPrice(89)
  const displayImage = look.imageUrl || product?.imagePath || '/products/teardrop-gold.png'
  const displaySizeCm = look.sizeCm || ('heightCm' in (product || {}) ? (product as any).heightCm : 3.0)

  // Styling presets from look
  const lipstick = look.options?.lipstick
  const hairUp = look.options?.hairUp
  const outfit = look.options?.outfit
  const metal = look.options?.metal
  const stack = look.stack

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
      {/* Left column: the product photo, with its size note beneath */}
      <div className="flex flex-col lg:col-span-5">
        <MacroTilt className="w-full max-w-md">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--paper)]">
            <Image
              src={displayImage}
              alt={displayTitle}
              fill
              priority
              unoptimized
              className="bg-[var(--paper)] object-contain p-6"
            />
          </div>
        </MacroTilt>

        <p className="mt-4 text-[16px] leading-[1.5] text-[var(--ink)]">
          {product && getProductCapabilities(product).calibration ? `${displaySizeCm} cm drop estimate` : product ? getProductCapabilities(product).dimensionLabel : 'Saved preview'}
        </p>
        <p className={captionClass}>Calibrated to 11.7 mm iris diameter constant</p>
      </div>

      {/* Right column: the look, its presets and the actions */}
      <div className="space-y-10 lg:col-span-7">
        <div>
          <h1 className="font-display text-4xl text-[var(--ink)] md:text-5xl">{displayTitle}</h1>
          <p className={`mt-3 ${captionClass}`}>
            {displayBrand} · <span className="text-[var(--ink)]">{displayPrice}</span> · #{lookId}
          </p>
          <p className={`mt-5 max-w-[62ch] ${bodyClass}`}>
            This saved styling arrangement restores the physical jewellery scale and harmonious cosmetic accents calibrated for this ensemble.
          </p>
        </div>

        <div className="space-y-6">
          <h2 className="font-display text-2xl text-[var(--ink)]">Active styling presets</h2>

          <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
            {/* Lipstick */}
            <div className="flex items-start gap-4">
              <div
                className="mt-1 h-8 w-8 shrink-0"
                style={{ backgroundColor: lipstick?.hex || '#9B1B30' }}
                title={lipstick?.name || 'Curated Lipstick'}
              />
              <div>
                <p className={captionClass}>Lipstick harmony</p>
                <p className={`capitalize ${bodyClass}`}>{lipstick?.name || 'Berry / Zari Red'}</p>
                <p className={captionClass}>
                  {lipstick?.texture || 'satin'} · {lipstick?.hex || '#9B1B30'}
                </p>
              </div>
            </div>

            {/* Precious metal */}
            <div className="flex items-start gap-4">
              <div className="mt-1 h-8 w-8 shrink-0 bg-[var(--gold)]" />
              <div>
                <p className={captionClass}>Recommended metal</p>
                <p className={`capitalize ${bodyClass}`}>{metal ? `${metal} tone` : '18k Yellow Gold'}</p>
                <p className={captionClass}>Warm tone harmony</p>
              </div>
            </div>

            {/* Hair updo */}
            <div className="pl-12">
              <p className={captionClass}>Hair styling</p>
              <p className={bodyClass}>{hairUp?.title || 'Two Braids Updo'}</p>
              <p className={captionClass}>Ear visible template</p>
            </div>

            {/* Outfit or earring stack */}
            <div className="pl-12">
              <p className={captionClass}>{stack && stack.length > 0 ? 'Ear stack' : 'Attire ensemble'}</p>
              <p className={bodyClass}>
                {stack && stack.length > 0
                  ? `${stack[0]} Stack Accent`
                  : outfit?.title || 'Emerald Silk Blouse'}
              </p>
              <p className={captionClass}>Coordinated palette</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <button type="button" onClick={handleOpenDrawer} className={solidButtonClass}>
              Try this look on me
            </button>

            <button
              type="button"
              onClick={handleShareLook}
              className="link-draw min-h-[44px] cursor-pointer bg-transparent p-0 text-[17px] text-[var(--ink)]"
            >
              Share look
            </button>

            {product && (
              <Link href={`/p/${product.id}`} className="link-draw text-[17px] text-[var(--ink)]">
                View product details →
              </Link>
            )}
          </div>

          <p className={`max-w-[62ch] ${bodyClass}`}>
            Open this piece in the studio to use a compatible photo. Portrait styling is optional; the saved look above is a pre-rendered example.
          </p>
        </div>
      </div>
    </div>
  )
}
