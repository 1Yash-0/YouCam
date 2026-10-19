'use client'

import React, { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { PillButton } from '@/components/PillButton'
import { remap, easeOutCubic } from '@/hooks/useScrollProgress'

export interface IrisNarrativeProps {
  id?: string
  className?: string
}

export function IrisNarrative({ id = 'how-it-works', className = '' }: IrisNarrativeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pinnedProgress, setPinnedProgress] = useState(0)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [manualStep, setManualStep] = useState(0)

  // Listen to prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Calculate active pinned progress
  useEffect(() => {
    if (isReducedMotion || typeof window === 'undefined') return

    const handleScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const winH = window.innerHeight
      const distance = rect.height - winH
      if (distance <= 0) return

      if (rect.top > 0) {
        setPinnedProgress(0)
      } else if (rect.top < -distance) {
        setPinnedProgress(1)
      } else {
        const p = -rect.top / distance
        setPinnedProgress(Math.min(Math.max(p, 0), 1))
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isReducedMotion])

  // Active step calculation
  const tau = isReducedMotion ? manualStep / 2 : pinnedProgress
  let activeStep = 0
  if (tau >= 0.32 && tau < 0.68) activeStep = 1
  else if (tau >= 0.68) activeStep = 2

  // Transform scale & origin
  // Max zoom clamped strictly to 2.2x
  let scale = 1.0
  let originX = 50
  let originY = 50

  if (activeStep === 0) {
    if (tau < 0.15) {
      scale = 1.0
    } else {
      const t = remap(tau, 0.15, 0.32, 0, 1)
      scale = 1.0 + (2.2 - 1.0) * easeOutCubic(t)
    }
    originX = 56.48
    originY = 33.15
  } else if (activeStep === 1) {
    scale = 2.2
    originX = 56.48
    originY = 33.15
  } else {
    const t = remap(tau, 0.68, 0.85, 0, 1)
    scale = 2.2 - (2.2 - 1.15) * easeOutCubic(t)
    originX = 56.48 - (56.48 - 40.0) * easeOutCubic(t)
    originY = 33.15 + (42.0 - 33.15) * easeOutCubic(t)
  }

  // Live pixel calculation: scrubs 16px to 37px
  let irisPx = 37
  if (activeStep === 1) {
    if (tau < 0.52) {
      irisPx = Math.round(remap(tau, 0.32, 0.52, 16, 37))
    } else {
      irisPx = 37
    }
  } else if (activeStep === 0) {
    irisPx = 16
  }

  const pxPerCm = (irisPx / 1.17).toFixed(1)
  // Drop render at physical scale: 3.0cm * (37px / 1.17cm) = 94.87px => 95px
  const earringPx = Math.round(3.0 * (irisPx / 1.17))

  return (
    <section
      id={id}
      ref={containerRef}
      className={`relative ${isReducedMotion ? 'min-h-screen py-24' : 'h-[300vh]'} bg-[var(--paper)] ${className}`}
      aria-label="How iris calibration works"
    >
      <div className={`${isReducedMotion ? 'relative' : 'sticky top-0'} h-screen w-full flex flex-col justify-between overflow-hidden px-6 md:px-12 lg:px-20 py-12 md:py-16`}>
        {/* Section Top Header & Step Indicators */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[var(--line)] pb-6">
          <div>
            <span className="ui-label text-[var(--gold)] block mb-1">
              PROPRIETARY OPTICAL CALIBRATION
            </span>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight text-[var(--ink)]">
              How Darpan <span className="font-serif-italic">measures</span> reality.
            </h2>
          </div>

          {/* Interactive Phase Indicator & Reduced Motion Tabs */}
          <div className="flex items-center gap-2">
            {[
              { idx: 0, label: '01 CAPTURE' },
              { idx: 1, label: '02 CALIBRATE' },
              { idx: 2, label: '03 RENDER' },
            ].map((s) => {
              const active = activeStep === s.idx
              return (
                <button
                  key={s.idx}
                  type="button"
                  onClick={() => isReducedMotion && setManualStep(s.idx)}
                  className={`px-3 py-1.5 rounded-full ui-label text-[11px] transition-all ${
                    active
                      ? 'bg-[var(--ink)] text-white shadow-xs font-bold'
                      : 'bg-white/80 text-[var(--ink-2)] hover:text-[var(--ink)] border border-[var(--line)]'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Center Stage: Split Narrative Columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center my-6">
          {/* Left Column: Narrative Copy & Editorial Explanations */}
          <div className="lg:col-span-5 flex flex-col justify-center gap-6">
            <div className="min-h-[220px] flex flex-col justify-center">
              {activeStep === 0 && (
                <div className="animate-fade-in">
                  <span className="ui-label text-[var(--gold)] block mb-2">01 / CAPTURE</span>
                  <h3 className="text-2xl md:text-3xl font-normal text-[var(--ink)] mb-3">
                    Portrait Landmark Alignment
                  </h3>
                  <p className="text-sm md:text-base text-[var(--ink-2)] leading-relaxed mb-6 font-normal">
                    Upload your own portrait or use our studio sample face. Facial geometry identifies anatomical landmarks, precisely locating corneal boundaries and earlobe positions without perspective distortion.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[var(--line)] text-xs text-[var(--ink-2)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--ink-2)]" />
                    <span>RAW PORTRAIT · 1104 × 1472 PX</span>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="animate-fade-in">
                  <span className="ui-label text-[var(--gold)] block mb-2">02 / CALIBRATE</span>
                  <h3 className="text-2xl md:text-3xl font-normal text-[var(--ink)] mb-3">
                    The 11.7 mm Anatomical Constant
                  </h3>
                  <p className="text-sm md:text-base text-[var(--ink-2)] leading-relaxed mb-6 font-normal">
                    Human corneas measure a near-universal 11.7 mm horizontally across all adult populations. By calibrating the 37 px iris against this anatomical constant using the scale formula (11.7 mm / iris px), Darpan calculates an exact conversion ratio of 31.6 pixels per centimeter.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[var(--gold)]/60 text-xs text-[var(--ink)] shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
                    <span className="font-semibold tabular-nums">{irisPx} px = 11.7 mm</span>
                    <span className="text-[var(--ink-2)]">({pxPerCm} px/cm)</span>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="animate-fade-in">
                  <span className="ui-label text-[var(--gold)] block mb-2">03 / RENDER</span>
                  <h3 className="text-2xl md:text-3xl font-normal text-[var(--ink)] mb-3">
                    Sub-Millimeter Physical Accuracy
                  </h3>
                  <p className="text-sm md:text-base text-[var(--ink-2)] leading-relaxed mb-6 font-normal">
                    A 3.0 cm drop hangs precisely 95 pixels down from the earlobe. No oversized renders, no guesswork—what you see on screen is mathematically verified within ±10% tolerance against physical reality.
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <PillButton href="/p/gilded-teardrop?tryon=1" variant="primary">
                      TRY ON SAMPLE FACE
                    </PillButton>
                    <span className="ui-label text-[11px] text-[var(--ok)] bg-[var(--ok)]/10 px-3 py-1.5 rounded-full border border-[var(--ok)]/30">
                      TOLERANCE VERIFIED ✓
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visual Stage with Eye Zoom and Calipers */}
          <div className="lg:col-span-7 h-full flex items-center justify-center">
            <div className="relative w-full max-w-[520px] aspect-[4/5] bg-white rounded-2xl overflow-hidden border border-[var(--line)] shadow-xl">
              {/* Scaled Portrait Canvas */}
              <div
                className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: `${originX}% ${originY}%`,
                }}
              >
                <Image
                  src="/sample-face.png"
                  alt="Iris Calibration Reference"
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover"
                  priority
                />

                {/* Earring Overlay in Phase 3 */}
                {activeStep === 2 && (
                  <div
                    className="absolute"
                    style={{
                      left: '34.8%',
                      top: '42.1%',
                      width: '41px',
                      height: '95px',
                    }}
                  >
                    <Image
                      src="/products/teardrop-gold.png"
                      alt="3.0cm Gilded Teardrop rendered at 95px physical scale"
                      fill
                      className="object-contain drop-shadow-md animate-fade-in"
                    />
                  </div>
                )}
              </div>

              {/* Phase 2: Gold Caliper Overlay */}
              {activeStep === 1 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative flex flex-col items-center">
                    {/* Live Metric Pill */}
                    <div className="mb-4 bg-[var(--ink)]/90 backdrop-blur-md text-white border border-[var(--gold)]/60 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-ping" />
                      <span className="ui-label text-[11px] tabular-nums tracking-wide">
                        {irisPx} px · 11.7 mm
                      </span>
                      <span className="text-white/40 text-[10px]">|</span>
                      <span className="text-[10px] text-white/90 tabular-nums">
                        {pxPerCm} px/cm
                      </span>
                    </div>

                    {/* Caliper Bar Graphics */}
                    <div
                      className="relative h-12 flex items-center transition-all duration-75"
                      style={{ width: `${irisPx * 2.8}px` }}
                    >
                      {/* Left Caliper Line */}
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--gold)] shadow-xs">
                        <div className="absolute -top-1 -left-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                        <div className="absolute -bottom-1 -left-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                      </div>

                      {/* Connecting Dashed Line */}
                      <div className="w-full border-t border-dashed border-[var(--gold)]" />

                      {/* Right Caliper Line */}
                      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-[var(--gold)] shadow-xs">
                        <div className="absolute -top-1 -right-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                        <div className="absolute -bottom-1 -right-[3px] w-2 h-2 rotate-45 bg-[var(--gold)]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 3: Physical Scale Ruler Overlay */}
              {activeStep === 2 && (
                <div className="absolute bottom-6 right-6 bg-[var(--ink)]/90 backdrop-blur-md text-white p-3 rounded-xl border border-[var(--gold)]/50 shadow-xl pointer-events-none">
                  <span className="ui-label text-[10px] text-[var(--gold)] block mb-1">
                    PHYSICAL DROP
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-medium tabular-nums">3.0 cm</span>
                    <span className="text-xs text-white/60 tabular-nums">({earringPx} px)</span>
                  </div>
                  <span className="text-[10px] text-[var(--ok)] block mt-1">
                    Tolerance Error: 0.0% ✓
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Scroll Progress Bar */}
        <div className="w-full bg-[var(--line)] h-[2px] rounded-full overflow-hidden">
          <div
            className="bg-[var(--gold)] h-full transition-all duration-75 ease-out"
            style={{ width: `${Math.round(tau * 100)}%` }}
          />
        </div>
      </div>
    </section>
  )
}
