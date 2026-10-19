'use client'

import React, { useState, useEffect } from 'react'
import { PillButton } from '@/components/PillButton'
import { SplitSlider } from './SplitSlider'
import { CompleteTheLook } from './CompleteTheLook'
import { ResultStepProps } from './types'

export function ResultStep({
  state,
  product,
  onToggleRuler,
  onSetCompareMode,
  onSliderPositionChange,
  onToggleLipstick,
  onToggleHairUp,
  onToggleOutfit,
  onToggleStack,
  onSelectLipstickShade,
  onAddToCart,
  onRecalibrate,
}: ResultStepProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [wipePercent, setWipePercent] = useState(50)
  const [caliperDrawn, setCaliperDrawn] = useState(false)
  const [displayedCm, setDisplayedCm] = useState(0)
  const [verdictVisible, setVerdictVisible] = useState(false)

  const targetCm = state.measurement?.renderedCm ?? state.sizeCm
  const requestedCm = state.sizeCm
  const withinTolerance = state.measurement?.withinTolerance ?? true

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // 4-Phase Sequential Reveal Choreography (Feature 9 / M6)
  useEffect(() => {
    if (prefersReducedMotion) {
      setWipePercent(50)
      setCaliperDrawn(true)
      setDisplayedCm(targetCm)
      setVerdictVisible(true)
      onSliderPositionChange(50)
      return
    }

    // Phase 1: Curtain wipe (0ms – 700ms)
    setWipePercent(0)
    setCaliperDrawn(false)
    setDisplayedCm(0)
    setVerdictVisible(false)

    let animationFrameId: number
    const startTime = performance.now()
    const wipeDuration = 700

    const stepWipe = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / wipeDuration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentWipe = Number((eased * 50).toFixed(1))

      setWipePercent(currentWipe)
      onSliderPositionChange(currentWipe)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(stepWipe)
      } else {
        // Phase 2: Caliper draw (700ms – 1000ms)
        setCaliperDrawn(true)

        // Phase 3: Tabular cm counter (1000ms – 1400ms)
        const counterStart = performance.now()
        const counterDuration = 450

        const stepCounter = (cNow: number) => {
          const cElapsed = cNow - counterStart
          const cProgress = Math.min(cElapsed / counterDuration, 1)
          const cEased = 1 - Math.pow(1 - cProgress, 2)
          const currentVal = Number((cEased * targetCm).toFixed(2))

          setDisplayedCm(currentVal)

          if (cProgress < 1) {
            animationFrameId = requestAnimationFrame(stepCounter)
          } else {
            // Phase 4: Tolerance verdict chip (1400ms – 1800ms)
            setDisplayedCm(targetCm)
            setVerdictVisible(true)
          }
        }

        animationFrameId = requestAnimationFrame(stepCounter)
      }
    }

    animationFrameId = requestAnimationFrame(stepWipe)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [prefersReducedMotion, targetCm, onSliderPositionChange])

  // Determine before image URL based on compareMode
  const hasExtras =
    Boolean(state.extras.lipstick) ||
    Boolean(state.extras.hairUp) ||
    Boolean(state.extras.outfit) ||
    Boolean(state.extras.stack && state.extras.stack.length > 0)

  const beforeImageUrl =
    state.compareMode === 'earring-only' && state.baseResultImageUrl
      ? state.baseResultImageUrl
      : state.photoUrl || '/sample-face.png'

  const afterImageUrl = state.resultImageUrl || '/sample-face.png'

  // High-res composite download
  const handleDownload = () => {
    if (!state.resultImageUrl) return
    const link = document.createElement('a')
    link.href = state.resultImageUrl
    link.download = `darpan-tryon-${product.id}-${state.sizeCm}cm.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col justify-between">
      {/* Before / After Split Slider Stage */}
      <div className="relative flex flex-col">
        <SplitSlider
          beforeImageUrl={beforeImageUrl}
          afterImageUrl={afterImageUrl}
          measurement={state.measurement}
          targetSizeCm={state.sizeCm}
          showRuler={state.showRuler}
          sliderPosition={wipePercent}
          onSliderPositionChange={(pos) => {
            setWipePercent(pos)
            onSliderPositionChange(pos)
          }}
          caliperDrawn={caliperDrawn}
          displayedCm={displayedCm}
        />

        {/* HUD Controls Bar (Under image) */}
        <div className="px-4 py-2 bg-[var(--paper)] border-b border-[var(--line)] flex items-center justify-between gap-2">
          {/* Ruler Toggle */}
          <button
            type="button"
            onClick={onToggleRuler}
            aria-pressed={state.showRuler}
            className={`
              px-2.5 py-1 rounded-full text-[10px] ui-label border transition-all flex items-center gap-1.5
              focus-visible:outline-2 focus-visible:outline-[var(--gold)]
              ${
                state.showRuler
                  ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--ink)] font-bold'
                  : 'border-[var(--line)] bg-white text-[var(--ink-2)]'
              }
            `}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
            <span>RULER {state.showRuler ? 'ON' : 'OFF'}</span>
          </button>

          {/* Compare Mode Toggle (Shown when styling extras are active) */}
          {hasExtras && (
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-full border border-[var(--line)]">
              <button
                type="button"
                onClick={() => onSetCompareMode('original')}
                className={`
                  px-2 py-0.5 rounded-full text-[9px] ui-label transition-colors
                  ${
                    state.compareMode === 'original'
                      ? 'bg-[var(--ink)] text-white font-bold'
                      : 'text-[var(--ink-2)]'
                  }
                `}
              >
                BARE FACE
              </button>
              <button
                type="button"
                onClick={() => onSetCompareMode('earring-only')}
                className={`
                  px-2 py-0.5 rounded-full text-[9px] ui-label transition-colors
                  ${
                    state.compareMode === 'earring-only'
                      ? 'bg-[var(--ink)] text-white font-bold'
                      : 'text-[var(--ink-2)]'
                  }
                `}
              >
                EARRING ONLY
              </button>
            </div>
          )}

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download try-on portrait"
            className="w-7 h-7 rounded-full bg-white border border-[var(--line)] hover:border-[var(--gold)] flex items-center justify-center text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] ml-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content: Tolerance Verdict & Styling Row */}
      <div className="p-5 bg-white flex flex-col gap-4">
        {/* Phase 4: Tolerance Verdict Chip */}
        {verdictVisible && (
          <div
            className={`
              p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all duration-300
              ${
                withinTolerance
                  ? 'bg-[var(--ok)]/10 text-[var(--ok)] border-[var(--ok)]/30'
                  : 'bg-[var(--warn)]/10 text-[var(--warn)] border-[var(--warn)]/30'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-current shrink-0" />
              <span className="ui-label text-[10px] tracking-wide">
                REQUESTED {requestedCm.toFixed(1)} CM · RENDERED {targetCm.toFixed(1)} CM
              </span>
            </div>
            <span className="ui-label text-[10px] font-bold">
              {withinTolerance ? '✓ WITHIN 10%' : '±12% MARGIN'}
            </span>
          </div>
        )}

        {/* Complete the Look Row */}
        <CompleteTheLook
          extras={state.extras}
          onToggleLipstick={onToggleLipstick}
          onToggleHairUp={onToggleHairUp}
          onToggleOutfit={onToggleOutfit}
          onToggleStack={onToggleStack}
          isRendering={state.isPresetRendering}
          cachedPresets={state.cachedPresets}
          onSelectLipstickShade={onSelectLipstickShade}
        />

        {/* Actions: Add to Bag & Recalibrate */}
        <div className="flex flex-col gap-2 pt-2">
          <PillButton
            variant="primary"
            onClick={onAddToCart}
            className="w-full justify-center !py-3 text-xs"
          >
            ADD TO BAG · ₹{product.priceInr.toLocaleString('en-IN')}
          </PillButton>

          <div className="flex items-center justify-between text-[11px] text-[var(--ink-2)] px-1">
            <button
              type="button"
              onClick={onRecalibrate}
              className="hover:text-[var(--gold)] underline underline-offset-4 focus-visible:outline-1 focus-visible:outline-[var(--gold)]"
            >
              Re-calibrate iris
            </button>
            <span className="tabular-nums">
              Scale calibrated against 11.7 mm iris
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
