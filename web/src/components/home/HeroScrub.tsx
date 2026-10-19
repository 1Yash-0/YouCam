'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { PillButton } from '@/components/PillButton'
import { remap, easeOutCubic } from '@/hooks/useScrollProgress'

export interface HeroFrame {
  sizeCm: number
  imageUrl: string
  box: { x: number; y: number; w: number; h: number }
}

export const HERO_FRAMES: HeroFrame[] = [
  { sizeCm: 2.0, imageUrl: '/hero/size-2.webp', box: { x: 364, y: 656, w: 28, h: 68 } },
  { sizeCm: 3.0, imageUrl: '/hero/size-3.webp', box: { x: 357, y: 656, w: 42, h: 102 } },
  { sizeCm: 4.5, imageUrl: '/hero/size-4_5.webp', box: { x: 347, y: 656, w: 63, h: 153 } },
  { sizeCm: 6.0, imageUrl: '/hero/size-6.webp', box: { x: 336, y: 656, w: 84, h: 205 } },
]

export function HeroScrub() {
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [currentSize, setCurrentSize] = useState(2.0)
  const [snappedSize, setSnappedSize] = useState(2.0)
  const [isSnapped, setIsSnapped] = useState(true)
  const [viewport, setViewport] = useState({ width: 1104, height: 1472 })
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const loadedImagesRef = useRef<HTMLImageElement[]>([])
  const curSizeRef = useRef(2.0)

  // Listen to prefers-reduced-motion and load images
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handleRm = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handleRm)

    const updateSize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    let loadedCount = 0
    const images: HTMLImageElement[] = []

    HERO_FRAMES.forEach((frame, idx) => {
      const img = new Image()
      img.src = frame.imageUrl
      img.onload = () => {
        loadedCount++
        if (loadedCount === HERO_FRAMES.length) {
          loadedImagesRef.current = images
          setImagesLoaded(true)
        }
      }
      img.onerror = () => {
        // Fallback to sample-face
        img.src = '/sample-face.png'
        loadedCount++
        if (loadedCount === HERO_FRAMES.length) {
          loadedImagesRef.current = images
          setImagesLoaded(true)
        }
      }
      images[idx] = img
    })

    return () => {
      mq.removeEventListener('change', handleRm)
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  // Passive scroll progress tracking
  useEffect(() => {
    if (prefersReducedMotion || typeof window === 'undefined') return

    const handleScroll = () => {
      if (!spacerRef.current) return
      const rect = spacerRef.current.getBoundingClientRect()
      const winH = window.innerHeight
      const totalScrollable = rect.height - winH
      const progress = totalScrollable > 0 ? Math.min(Math.max(-rect.top / totalScrollable, 0), 1) : 0
      setScrollProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [prefersReducedMotion])

  // Canvas drawing & damping loop
  useEffect(() => {
    if (!imagesLoaded || prefersReducedMotion) return

    let animId: number
    const targetSize = remap(scrollProgress, 0.18, 0.88, 2.0, 6.0)

    const render = () => {
      curSizeRef.current += (targetSize - curSizeRef.current) * 0.15
      const size = curSizeRef.current
      setCurrentSize(size)

      // Snap check
      const snapPoints = [2.0, 3.0, 4.5, 6.0]
      const nearest = snapPoints.reduce((prev, curr) =>
        Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
      )
      const nearThreshold = Math.abs(nearest - size) < 0.12
      setIsSnapped(nearThreshold)
      if (nearThreshold && snappedSize !== nearest) {
        setSnappedSize(nearest)
      }

      // Draw canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const rect = canvas.getBoundingClientRect()
          if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
            canvas.width = Math.floor(rect.width * dpr)
            canvas.height = Math.floor(rect.height * dpr)
          }

          ctx.save()
          ctx.scale(dpr, dpr)
          ctx.clearRect(0, 0, rect.width, rect.height)

          // object-fit: cover transform
          const scale = Math.max(rect.width / 1104, rect.height / 1472)
          const dw = 1104 * scale
          const dh = 1472 * scale
          const ox = (rect.width - dw) / 2
          const oy = (rect.height - dh) / 2

          // Find adjacent frame indices
          let i = 0
          if (size >= 4.5) i = 2
          else if (size >= 3.0) i = 1
          else i = 0

          const f1 = HERO_FRAMES[i]
          const f2 = HERO_FRAMES[i + 1] || f1
          const alpha = f1 === f2 ? 1 : Math.min(Math.max((size - f1.sizeCm) / (f2.sizeCm - f1.sizeCm), 0), 1)

          const img1 = loadedImagesRef.current[i]
          const img2 = loadedImagesRef.current[i + 1] || img1

          if (img1 && img1.complete) {
            ctx.globalAlpha = 1 - alpha
            ctx.drawImage(img1, ox, oy, dw, dh)
          }
          if (img2 && img2.complete && alpha > 0) {
            ctx.globalAlpha = alpha
            ctx.drawImage(img2, ox, oy, dw, dh)
          }

          ctx.restore()
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [imagesLoaded, scrollProgress, prefersReducedMotion, snappedSize])

  // Interpolated bounding box in 1104x1472 coordinate space
  const currentBox = useMemo(() => {
    let i = 0
    if (currentSize >= 4.5) i = 2
    else if (currentSize >= 3.0) i = 1
    else i = 0

    const f1 = HERO_FRAMES[i]
    const f2 = HERO_FRAMES[i + 1] || f1
    const alpha = f1 === f2 ? 1 : (currentSize - f1.sizeCm) / (f2.sizeCm - f1.sizeCm)

    return {
      x: f1.box.x + alpha * (f2.box.x - f1.box.x),
      y: 656,
      w: f1.box.w + alpha * (f2.box.w - f1.box.w),
      h: f1.box.h + alpha * (f2.box.h - f1.box.h),
    }
  }, [currentSize])

  // Phase progressions
  const phaseAProgress = remap(scrollProgress, 0.0, 0.18, 0.0, 1.0)
  const productCardProgress = remap(scrollProgress, 0.18, 0.36, 0.0, 1.0)
  const cardScale = remap(scrollProgress, 0.36, 0.88, 1.0, 1.6)
  const phaseCProgress = remap(scrollProgress, 0.88, 1.0, 0.0, 1.0)

  // Cover transform calculation for SVG overlay
  const coverScale = Math.max(viewport.width / 1104, viewport.height / 1472)
  const coverOx = (viewport.width - 1104 * coverScale) / 2
  const coverOy = (viewport.height - 1472 * coverScale) / 2

  // Reduced motion static view
  if (prefersReducedMotion) {
    return (
      <section className="relative min-h-[85vh] pt-32 pb-16 px-8 max-w-7xl mx-auto flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-light tracking-tight text-center mb-6">
          See it at <span className="font-serif-italic">actual</span> size.
        </h1>
        <div className="relative w-full max-w-md aspect-[3/4] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--paper)] mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/hero/size-${snappedSize === 4.5 ? '4_5' : snappedSize}.webp`}
            alt="Gilded Teardrop rendered at true physical size"
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/sample-face.png'
            }}
          />
        </div>
        {/* 4-chip static size switcher */}
        <div className="flex gap-3 mb-8">
          {[2.0, 3.0, 4.5, 6.0].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setSnappedSize(size)}
              className={`px-4 py-2 rounded-full ui-label text-xs transition-colors ${
                snappedSize === size
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--gold)]'
              }`}
            >
              {size.toFixed(1)} CM
            </button>
          ))}
        </div>
        <PillButton href={`/p/gilded-teardrop?tryon=1&size=${snappedSize}`} variant="primary">
          TRY ON AT {snappedSize.toFixed(1)} CM
        </PillButton>
      </section>
    )
  }

  return (
    <div ref={spacerRef} className="relative h-[240vh] w-full" aria-hidden="false">
      {/* Pinned Sticky Viewport */}
      <section
        className="sticky top-0 h-screen w-full overflow-hidden bg-[var(--paper)] z-10"
        aria-label="Interactive physical size scrub"
      >
        {/* Screen reader live announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {isSnapped ? `Showing Gilded Teardrop at ${snappedSize.toFixed(1)} centimetres` : ''}
        </div>
        <span className="sr-only">
          The same photo with the Gilded Teardrop earring shown at 2, 3, 4.5 and 6 centimetres.
        </span>

        {/* HTML5 Canvas Background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: `translateY(${30 * (1 - easeOutCubic(phaseAProgress))}vh)`,
          }}
        />

        {/* SVG Measurement Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
          style={{
            opacity: phaseAProgress >= 0.8 ? 1 : 0,
            transition: 'opacity 300ms ease-out',
          }}
        >
          <defs>
            <filter id="heroGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Coordinate group matching cover transform */}
          <g filter="url(#heroGoldGlow)" transform={`translate(${coverOx}, ${coverOy}) scale(${coverScale})`}>
            {/* Top tick */}
            <line
              x1={currentBox.x + currentBox.w + 8}
              y1={currentBox.y}
              x2={currentBox.x + currentBox.w + 24}
              y2={currentBox.y}
              stroke="var(--gold)"
              strokeWidth="2"
            />

            {/* Vertical ruler line */}
            <line
              x1={currentBox.x + currentBox.w + 16}
              y1={currentBox.y}
              x2={currentBox.x + currentBox.w + 16}
              y2={currentBox.y + currentBox.h}
              stroke="var(--gold)"
              strokeWidth="1.5"
            />

            {/* Bottom tick */}
            <line
              x1={currentBox.x + currentBox.w + 8}
              y1={currentBox.y + currentBox.h}
              x2={currentBox.x + currentBox.w + 24}
              y2={currentBox.y + currentBox.h}
              stroke="var(--gold)"
              strokeWidth="2"
            />

            {/* Floating CM Pill */}
            <foreignObject
              x={currentBox.x + currentBox.w + 28}
              y={currentBox.y + currentBox.h / 2 - 14}
              width="140"
              height="36"
              className="overflow-visible"
            >
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--ink)]/95 text-white border border-[var(--gold)]/80 shadow-lg text-[11px] ui-label tabular-nums tracking-wide transition-transform duration-120 ${
                  isSnapped ? 'scale-105 border-[var(--gold)]' : 'scale-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                <span>{currentSize.toFixed(1)} CM</span>
              </div>
            </foreignObject>
          </g>
        </svg>

        {/* Phase A: Title & CTA Overlay */}
        <div
          className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-8 md:p-16"
          style={{
            opacity: 1 - phaseAProgress,
            transform: `translateY(${-32 * phaseAProgress}px)`,
            filter: `blur(${12 * phaseAProgress}px)`,
            pointerEvents: phaseAProgress > 0.95 ? 'none' : 'auto',
          }}
        >
          <div className="max-w-2xl mt-24">
            <span className="ui-label text-[var(--gold)] block mb-3">
              Kaari Studio · Powered by Darpan
            </span>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight text-white drop-shadow-md">
              See it at <span className="font-serif-italic">actual</span> size.
            </h1>
          </div>

          <div className="max-w-md self-end text-right">
            <p className="ui-label text-xs text-white/90 mb-4 leading-relaxed tracking-wider drop-shadow">
              EVERY PIECE IS SHOWN AT ITS REAL SIZE, MEASURED AGAINST YOUR OWN EYE.
            </p>
            <PillButton href="/p/gilded-teardrop?tryon=1" variant="primary">
              TRY ON ME
            </PillButton>
          </div>
        </div>

        {/* Phase B: Product Card Overlay (bottom-left) */}
        <div
          className="absolute bottom-8 left-8 md:bottom-12 md:left-12 z-30 flex items-end gap-4"
          style={{
            opacity: productCardProgress,
            filter: `blur(${12 * (1 - productCardProgress)}px)`,
            pointerEvents: productCardProgress > 0.5 ? 'auto' : 'none',
          }}
        >
          <div className="bg-[var(--bg)]/90 backdrop-blur-md border border-[var(--line)] p-4 rounded-xl shadow-xl flex items-center gap-4">
            {/* Thumbnail scaled */}
            <div
              className="w-14 h-14 bg-[var(--paper)] rounded-lg overflow-hidden border border-[var(--line)] flex items-center justify-center transition-transform duration-180"
              style={{
                transform: `scale(${cardScale})`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/products/teardrop-gold.png"
                alt="Gilded Teardrop"
                className="w-10 h-10 object-contain"
              />
            </div>

            <div>
              <span className="ui-label text-[9px] text-[var(--gold)] block">
                {snappedSize.toFixed(1)} CM SCALE
              </span>
              <h2 className="text-sm font-medium text-[var(--ink)]">Gilded Teardrop</h2>
              <span className="text-xs font-normal tabular-nums text-[var(--ink-2)]">
                ₹1,499
              </span>
            </div>

            {/* Circular '+' button triggering try-on */}
            <Link
              href={`/p/gilded-teardrop?tryon=1&size=${snappedSize}`}
              aria-label="Try Gilded Teardrop on me"
              className="w-10 h-10 rounded-full bg-[var(--ink)] hover:bg-[var(--gold)] text-white flex items-center justify-center text-lg transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
            >
              +
            </Link>
          </div>
        </div>

        {/* Phase C: Collection Scroll Caption */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none text-center transition-opacity duration-300"
          style={{
            opacity: phaseCProgress,
          }}
        >
          <span className="ui-label text-[10px] tracking-[0.25em] text-[var(--ink-2)] bg-[var(--bg)]/80 px-4 py-1.5 rounded-full border border-[var(--line)] shadow-xs">
            SCROLL TO EXPLORE THE COLLECTION ↓
          </span>
        </div>
      </section>
    </div>
  )
}
