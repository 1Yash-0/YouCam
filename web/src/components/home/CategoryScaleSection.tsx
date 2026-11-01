'use client'

import React, { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export type ScaleCategory = 'necklace' | 'watch' | 'ring'

interface SizeOption {
  id: string
  label: string
  metricLabel: string
  detail: string
  measureValue: number
}

interface CategoryConfig {
  id: string
  category: ScaleCategory
  anchorNavId: string
  title: string
  subtitle: string
  badge: string
  description: string
  imageSrc: string
  imageAlt: string
  tryOnHref: string
  tryOnLabel: string
  options: SizeOption[]
}

const CATEGORY_CONFIGS: Record<ScaleCategory, CategoryConfig> = {
  necklace: {
    id: 'necklace',
    category: 'necklace',
    anchorNavId: 'necklace-method',
    title: 'Necklaces & Chains',
    subtitle: 'Sternal Notch Anchor & Catenary Drape Calibration',
    badge: '40 cm Drape Benchmark',
    description:
      'Chain length dictates physical resting curvature. Using the sternal notch landmark and clavicle width, Darpan calculates true catenary curves across standardized drape lengths.',
    imageSrc: '/samples/necklace.png',
    imageAlt: 'Photographic neckline reference for 40 cm to 50 cm chain drape',
    tryOnHref: '/try-on/orb-chain?sample=1',
    tryOnLabel: 'Try Orb Chain (40 cm)',
    options: [
      { id: '40', label: '40 cm', metricLabel: '40.0 cm Collar Drape', detail: 'Hollow of throat; clears high necklines', measureValue: 40 },
      { id: '45', label: '45 cm', metricLabel: '45.0 cm Princess Drape', detail: 'Mid-clavicle classic drop', measureValue: 45 },
      { id: '50', label: '50 cm', metricLabel: '50.0 cm Matinee Drop', detail: 'Plunges gracefully past collarbone', measureValue: 50 },
    ],
  },
  watch: {
    id: 'watch',
    category: 'watch',
    anchorNavId: 'watch-method',
    title: 'Watches & Timepieces',
    subtitle: '60 mm Anatomical Wrist Width Anchor',
    badge: '60 mm Biological Benchmark',
    description:
      'Just as earrings anchor to the 11.7 mm iris, timepiece cases scale against the universal 60 mm average adult wrist width (styloid-to-styloid process) ensuring authentic lug-to-lug proportions.',
    imageSrc: '/products/worn/atlantic-classic.jpg',
    imageAlt: 'Photographic wrist reference for 36 mm to 42 mm watch cases',
    tryOnHref: '/try-on/watch-atlantic?sample=1',
    tryOnLabel: 'Try Atlantic Watch (36 mm)',
    options: [
      { id: '36', label: '36 mm', metricLabel: '⌀ 36.0 mm Petite Case', detail: 'Ideal for slender wrists (14–16 cm)', measureValue: 36 },
      { id: '40', label: '40 mm', metricLabel: '⌀ 40.0 mm Classic Case', detail: 'Universal contemporary proportion', measureValue: 40 },
      { id: '42', label: '42 mm', metricLabel: '⌀ 42.0 mm Statement Case', detail: 'Full lug-to-lug wrist span', measureValue: 42 },
    ],
  },
  ring: {
    id: 'ring',
    category: 'ring',
    anchorNavId: 'ring-method',
    title: 'Rings & Bracelets',
    subtitle: 'Standard US Ring Gauge & 64 mm Bangle Contour',
    badge: '0.1 mm Caliper Precision',
    description:
      'Finger ring fittings utilize standard ISO/US inner diameters calibrated to the proximal phalanx, while cuff bracelets scale to an anatomical 64 mm elliptical wrist curvature.',
    imageSrc: '/products/worn/met-bead-ring.jpg',
    imageAlt: 'Photographic hand reference for US ring sizes and bracelet contours',
    tryOnHref: '/try-on/met-bead-ring?sample=1',
    tryOnLabel: 'Try Roman Ring (US 7)',
    options: [
      { id: 'us5', label: 'US 5', metricLabel: '⌀ 15.7 mm Inner ⌀', detail: '49.3 mm inner circumference', measureValue: 15.7 },
      { id: 'us6', label: 'US 6', metricLabel: '⌀ 16.5 mm Inner ⌀', detail: '51.9 mm inner circumference', measureValue: 16.5 },
      { id: 'us7', label: 'US 7', metricLabel: '⌀ 17.3 mm Inner ⌀', detail: '54.4 mm standard medium fit', measureValue: 17.3 },
      { id: 'us8', label: 'US 8', metricLabel: '⌀ 18.2 mm Inner ⌀', detail: '57.2 mm statement index fit', measureValue: 18.2 },
      { id: 'bangle', label: '64 mm Bangle', metricLabel: '⌀ 64.0 mm Cuff Contour', detail: 'Elliptical wrist contour fit', measureValue: 64 },
    ],
  },
}

export function CategoryScaleSection({ category }: { category: ScaleCategory }) {
  const config = CATEGORY_CONFIGS[category]
  const [selectedOption, setSelectedOption] = useState<SizeOption>(config.options[0])
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>(null)
  const imageContainerRef = useRef<HTMLDivElement | null>(null)

  const isExpanded = isHovered || isPinned

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    setProbePos({ x: Math.round(x), y: Math.round(y) })
  }, [])

  const handleMouseLeaveImage = useCallback(() => {
    setProbePos(null)
  }, [])

  return (
    <section
      id={config.anchorNavId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative scroll-mt-[calc(var(--header-h)+2rem)] rounded-2xl border transition-all duration-500 ease-out p-6 sm:p-8 lg:p-10 ${
        isExpanded
          ? 'border-[var(--gold)] bg-[var(--paper)] shadow-[0_24px_60px_-15px_rgba(176,138,62,0.18),0_0_0_1px_rgba(176,138,62,0.4)]'
          : 'border-[var(--line)] bg-[var(--paper)]/50 hover:border-[var(--gold)]/60 hover:bg-[var(--paper)]'
      }`}
    >
      {/* Top Gold Shimmer Beam on Hover */}
      <div
        className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent transition-opacity duration-500 ${
          isExpanded ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-0.5 text-xs font-semibold tracking-wider text-[var(--gold)] uppercase">
              {config.badge}
            </span>
            <span className="text-xs text-[var(--ink-2)] tracking-wide">
              {isExpanded ? 'Interactive True-Scale Studio Active' : 'Hover to inspect true-scale studio'}
            </span>
          </div>

          <h2 className="mt-3 font-display text-3xl font-normal tracking-tight text-[var(--ink)] sm:text-4xl">
            {config.title}
          </h2>
          <p className="mt-1 font-display text-base text-[var(--gold)] sm:text-lg">
            {config.subtitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)] sm:text-base">
            {config.description}
          </p>
        </div>

        {/* Pin / Lock Toggle & Action */}
        <div className="flex shrink-0 items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            aria-pressed={isPinned}
            aria-label={isPinned ? 'Unpin scale studio' : 'Pin scale studio open'}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              isPinned
                ? 'border-[var(--gold)] bg-[var(--gold)] text-white shadow-xs'
                : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink-2)] hover:border-[var(--gold)] hover:text-[var(--ink)]'
            }`}
          >
            <span>{isPinned ? 'Pinned open' : 'Keep open'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Size Chips */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--line)]/80 pt-5">
        <span className="mr-2 text-xs font-semibold text-[var(--ink-2)] uppercase tracking-wider">
          Scale options:
        </span>
        {config.options.map((opt) => {
          const isSelected = selectedOption.id === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedOption(opt)}
              onMouseEnter={() => setSelectedOption(opt)}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--gold)] bg-[var(--gold)] text-white shadow-sm ring-1 ring-[var(--gold)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink-2)] hover:border-[var(--gold)]/80 hover:text-[var(--ink)]'
              }`}
            >
              <span>{opt.label}</span>
              {isSelected && <span className="text-[10px] opacity-80">✓</span>}
            </button>
          )
        })}
        <span className="ml-auto text-xs text-[var(--gold)] italic font-serif">
          {selectedOption.detail}
        </span>
      </div>

      {/* Collapsible / Expandable Photographic Scale Studio */}
      <div
        className={`grid transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
          isExpanded ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
        }`}
      >
        <div className="min-h-0">
          <div className="grid gap-6 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:p-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8 shadow-inner">
            {/* Left: Photographic Viewport with SVG Caliper Overlays */}
            <div
              ref={imageContainerRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeaveImage}
              className="relative mx-auto aspect-[3/4] w-full max-w-[420px] overflow-hidden rounded-xl bg-[#EFECE6] border border-[var(--line)] select-none cursor-crosshair group/stage shadow-xs"
            >
              <Image
                src={config.imageSrc}
                alt={config.imageAlt}
                fill
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover object-center transition-transform duration-700 ease-out group-hover/stage:scale-[1.015]"
                priority={false}
              />

              {/* Dynamic SVG Calipers per Category */}
              <svg
                className="absolute inset-0 h-full w-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {/* 1. NECKLACE CALIPERS */}
                {config.category === 'necklace' && (
                  <>
                    {/* Clavicle Reference Baseline */}
                    <line x1="18" y1="61.2" x2="80" y2="61.2" stroke="#B08A3E" strokeWidth="0.8" strokeDasharray="2,2" strokeOpacity="0.85" />
                    <text x="20" y="59.5" fill="#B08A3E" fontSize="2.8" fontWeight="bold" letterSpacing="0.05em">CLAVICLE BASELINE</text>

                    {/* Sternal Notch Crosshair Anchor */}
                    <circle cx="48.7" cy="59.2" r="2.2" fill="none" stroke="#B08A3E" strokeWidth="1.2" />
                    <circle cx="48.7" cy="59.2" r="0.7" fill="#B08A3E" />
                    <text x="52" y="58.5" fill="#0B0B0A" fontSize="2.8" fontWeight="600">Sternal Notch</text>

                    {/* Dynamic Drape Curve */}
                    {selectedOption.id === '40' && (
                      <path d="M 38 55 Q 48.7 65.8 60 55" fill="none" stroke="#B08A3E" strokeWidth="2" strokeLinecap="round" />
                    )}
                    {selectedOption.id === '45' && (
                      <path d="M 37 55 Q 48.7 72.5 61 55" fill="none" stroke="#B08A3E" strokeWidth="2" strokeLinecap="round" />
                    )}
                    {selectedOption.id === '50' && (
                      <path d="M 36 55 Q 48.7 79.5 62 55" fill="none" stroke="#B08A3E" strokeWidth="2" strokeLinecap="round" />
                    )}

                    {/* Drop Ruler Guide Line */}
                    {(() => {
                      const apexY = selectedOption.id === '40' ? 65.8 : selectedOption.id === '45' ? 72.5 : 79.5
                      return (
                        <>
                          <line x1="48.7" y1="59.2" x2="48.7" y2={apexY} stroke="#B08A3E" strokeWidth="1" strokeDasharray="1.5,1.5" />
                          <circle cx="48.7" cy={apexY} r="2.2" fill="#B08A3E" stroke="white" strokeWidth="0.8" />
                          <text x="52" y={apexY + 0.8} fill="#B08A3E" fontSize="2.8" fontWeight="bold">
                            {selectedOption.metricLabel}
                          </text>
                        </>
                      )
                    })()}
                  </>
                )}

                {/* 2. WATCH CALIPERS */}
                {config.category === 'watch' && (
                  <>
                    {/* 60 mm Wrist Caliper Span across the wrist */}
                    <line x1="33" y1="78.3" x2="67" y2="78.3" stroke="#B08A3E" strokeWidth="1" strokeDasharray="2,2" strokeOpacity="0.8" />
                    <line x1="33" y1="74" x2="33" y2="82.6" stroke="#B08A3E" strokeWidth="1.5" />
                    <line x1="67" y1="74" x2="67" y2="82.6" stroke="#B08A3E" strokeWidth="1.5" />
                    <text x="50" y="72" textAnchor="middle" fill="#B08A3E" fontSize="2.8" fontWeight="bold">60.0 mm ANATOMICAL WRIST ANCHOR</text>

                    {/* Dynamic Case Diameter Overlay on Watch Dial */}
                    {selectedOption.id === '36' && (
                      <>
                        <circle cx="51.5" cy="78.3" r="5.8" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="1.6" />
                        <circle cx="51.5" cy="78.3" r="1.2" fill="#B08A3E" />
                        <line x1="51.5" y1="70" x2="51.5" y2="86.6" stroke="#B08A3E" strokeWidth="0.8" strokeDasharray="1,1" strokeOpacity="0.6" />
                      </>
                    )}
                    {selectedOption.id === '40' && (
                      <>
                        <circle cx="51.5" cy="78.3" r="6.8" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="1.8" />
                        <circle cx="51.5" cy="78.3" r="1.2" fill="#B08A3E" />
                        <line x1="51.5" y1="69" x2="51.5" y2="87.6" stroke="#B08A3E" strokeWidth="0.8" strokeDasharray="1,1" strokeOpacity="0.6" />
                      </>
                    )}
                    {selectedOption.id === '42' && (
                      <>
                        <circle cx="51.5" cy="78.3" r="7.4" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="2" />
                        <circle cx="51.5" cy="78.3" r="1.2" fill="#B08A3E" />
                        <line x1="51.5" y1="68" x2="51.5" y2="88.6" stroke="#B08A3E" strokeWidth="0.8" strokeDasharray="1,1" strokeOpacity="0.6" />
                      </>
                    )}
                    <text x="51.5" y="89.5" textAnchor="middle" fill="#B08A3E" fontSize="3" fontWeight="bold">
                      {selectedOption.metricLabel}
                    </text>
                  </>
                )}

                {/* 3. RING & BRACELET CALIPERS */}
                {config.category === 'ring' && (
                  <>
                    {selectedOption.id === 'bangle' ? (
                      <>
                        {/* 64 mm Bangle Contour at wrist base */}
                        <ellipse cx="49" cy="86" rx="25" ry="8.5" fill="#B08A3E" fillOpacity="0.1" stroke="#B08A3E" strokeWidth="2" strokeDasharray="4,2" />
                        <line x1="24" y1="86" x2="74" y2="86" stroke="#B08A3E" strokeWidth="1" strokeDasharray="2,2" />
                        <text x="49" y="83" textAnchor="middle" fill="#B08A3E" fontSize="2.8" fontWeight="bold">⌀ 64.0 mm BANGLE INNER CONTOUR</text>
                      </>
                    ) : (
                      <>
                        {/* Precision Ring Gauge placed exactly over worn ring on ring finger */}
                        {selectedOption.id === 'us5' && (
                          <circle cx="65.7" cy="41.7" r="4.2" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="1.6" />
                        )}
                        {selectedOption.id === 'us6' && (
                          <circle cx="65.7" cy="41.7" r="4.6" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="1.7" />
                        )}
                        {selectedOption.id === 'us7' && (
                          <circle cx="65.7" cy="41.7" r="5.0" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="1.8" />
                        )}
                        {selectedOption.id === 'us8' && (
                          <circle cx="65.7" cy="41.7" r="5.5" fill="#B08A3E" fillOpacity="0.15" stroke="#B08A3E" strokeWidth="1.9" />
                        )}
                        <line x1="58.5" y1="41.7" x2="72.5" y2="41.7" stroke="#B08A3E" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                        <circle cx="65.7" cy="41.7" r="1.0" fill="#B08A3E" />
                        <text x="65.7" y="34.5" textAnchor="middle" fill="#B08A3E" fontSize="3" fontWeight="bold">
                          {selectedOption.metricLabel}
                        </text>
                      </>
                    )}
                  </>
                )}
              </svg>

              {/* Cursor Scale Inspection Reticle */}
              {probePos && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                  style={{ left: `${probePos.x}%`, top: `${probePos.y}%` }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full border border-[var(--gold)]/90 animate-ping opacity-60" />
                    <div className="absolute h-3 w-3 rounded-full border border-white bg-[var(--gold)] shadow-xs" />
                    <div className="absolute left-5 top-0 whitespace-nowrap rounded-md bg-black/85 px-2 py-1 text-[11px] font-mono text-white shadow-md backdrop-blur-xs">
                      <span className="text-[var(--gold)] font-bold">1:1 Physical Probe:</span> {probePos.x}%, {probePos.y}% (±0.2mm)
                    </div>
                  </div>
                </div>
              )}

              {/* Live Scale Badge Overlay */}
              <div className="absolute bottom-3 left-3 z-10 rounded-md bg-black/80 px-2.5 py-1.5 text-xs text-white backdrop-blur-xs shadow-sm">
                <span className="text-[var(--gold)] font-bold">Active Gauge:</span> {selectedOption.metricLabel}
              </div>
            </div>

            {/* Right: Technical Explanation & Precision Specifications */}
            <div className="flex flex-col justify-between space-y-5">
              <div>
                <h3 className="font-display text-xl text-[var(--ink)]">
                  {selectedOption.metricLabel}
                </h3>
                <p className="mt-1 text-sm text-[var(--gold)] font-serif italic">
                  {selectedOption.detail}
                </p>

                <div className="mt-5 space-y-3.5 border-t border-[var(--line)] pt-4 text-xs sm:text-sm text-[var(--ink-2)]">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[var(--gold)] font-bold">1.</span>
                    <p>
                      <strong className="text-[var(--ink)]">Photogrammetric Calibration:</strong> Scaled strictly to biological bodily landmarks (11.7 mm iris for face, 60 mm wrist width, standard phalanx diameter) with zero arbitrary stretching.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[var(--gold)] font-bold">2.</span>
                    <p>
                      <strong className="text-[var(--ink)]">Closed-Loop Precision:</strong> Validated against manufacturer specifications within strict ±10% physical tolerance limits.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-[var(--gold)] font-bold">3.</span>
                    <p>
                      <strong className="text-[var(--ink)]">Real-World Confidence:</strong> Try before buying to eliminate size returns, silhouette mismatch, and drape uncertainty.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[var(--line)]">
                <Link
                  href={config.tryOnHref}
                  className="inline-flex min-h-[44px] items-center rounded-sm bg-[var(--ink)] px-5 text-sm font-medium text-[var(--paper)] transition-all hover:bg-[var(--gold)] hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                >
                  {config.tryOnLabel} →
                </Link>
                <span className="text-xs text-[var(--ink-2)]">0 units spent · instant try-on</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
