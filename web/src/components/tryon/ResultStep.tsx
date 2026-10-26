'use client'

import React, { useState } from 'react'
import { PillButton } from '@/components/PillButton'
import { useToast } from '@/components/Toast'
import { SplitSlider } from './SplitSlider'
import { CompleteTheLook } from './CompleteTheLook'
import { SizeRuler } from './SizeRuler'
import studio from './Studio.module.css'
import { ResultStepProps } from './types'
import type { Product } from '@/lib/products'
import { getProductCapabilities } from '@/lib/product-capabilities'

export function getResultAddToBagLabel(product: Pick<Product, 'type'>, sizeCm: number): string {
  void product
  void sizeCm
  return 'Save this choice'
}

export function ResultStep({
  state,
  product,
  onToggleRuler,
  onSetCompareMode,
  onSliderPositionChange,
  onApplyStyling,
  onClearStyling,
  hairTemplates,
  isLoadingHairTemplates,
  onRequestHairTemplates,
  onAddToCart,
  onRecalibrate,
  sizeComparisons = [],
  onCompareSize,
  isComparingSize = false,
}: ResultStepProps) {
  const [showCompleteTheLook, setShowCompleteTheLook] = useState(false)
  const { showToast } = useToast()

  const hasMeasurement = Boolean(state.measurement && Number.isFinite(state.measurement.renderedCm) && state.measurement.renderedCm > 0)
  const targetCm = state.measurement?.renderedCm ?? state.sizeCm
  const requestedCm = state.sizeCm
  const withinTolerance = state.measurement?.withinTolerance

  if (!state.resultImageUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center" role="alert">
        <div className="w-12 h-12 rounded-full border border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--warn)] flex items-center justify-center">
          <span className="text-xl" aria-hidden="true">!</span>
        </div>
        <div>
          <h2 className="text-lg font-medium text-[var(--ink)]">We couldn’t create the try-on</h2>
          <p className="mt-2 text-base text-[var(--ink-2)]">
            {state.error?.userMessage || 'The rendered image is unavailable. Please try again.'}
          </p>
        </div>
        <PillButton variant="primary" onClick={onRecalibrate}>
          TRY AGAIN
        </PillButton>
      </div>
    )
  }

  // Determine before image URL based on compareMode
  const hasExtras =
    Boolean(state.extras.lipstick) ||
    Boolean(state.extras.hairUp) ||
    Boolean(state.extras.outfit) ||
    Boolean(state.extras.stack && state.extras.stack.length > 0)

  const beforeImageUrl = state.photoUrl || '/sample-face.png'

  const afterImageUrl = state.compareMode === 'earring-only' && state.baseResultImageUrl
    ? state.baseResultImageUrl
    : state.resultImageUrl
  const hasFaceCalibration = product.type === 'single' || product.type === 'stud'
  const canStyle = !state.isSampleFace && (hasFaceCalibration || product.type === 'necklace')
  const capabilities = getProductCapabilities(product)

  const handleShareSave = async () => {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${product.id}` : ''
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({ title: product.name, text: `View ${product.name} on Darpan`, url: shareUrl })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        showToast({ message: 'Product link copied to clipboard.', variant: 'gold' })
      } else {
        showToast({ message: 'Product link ready.', variant: 'default' })
      }
    } catch {
      showToast({ message: 'Could not share this product yet.', variant: 'warn' })
    }
  }

  const downloadName = `darpan-tryon-${product.id}.png`

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,62fr)_minmax(320px,38fr)]">
      {/* Before / After Split Slider Stage */}
      <div className="relative flex min-h-[320px] flex-col lg:min-h-[min(calc(100svh_-_var(--header-h)_-_220px),900px)]">
        <SplitSlider
          beforeImageUrl={beforeImageUrl}
          afterImageUrl={afterImageUrl}
          measurement={state.measurement}
          targetSizeCm={state.sizeCm}
          showRuler={state.showRuler && hasMeasurement}
          sliderPosition={state.splitPosition}
          onSliderPositionChange={onSliderPositionChange}
          caliperDrawn={true}
          className="min-h-[320px] flex-1 aspect-auto rounded-none"
        />
        {/* While another size renders, a light bar sweeps the photo (static under reduced motion) */}
        {(isComparingSize || state.isPresetRendering) && <div className={studio.shimmer} aria-hidden="true"><span /></div>}

        {/* Controls under the image: plain text toggles, gold bar marks the active one */}
        <div className="flex shrink-0 items-center justify-between gap-5 bg-[var(--paper)] px-4 py-3 text-[15px]">
          {/* Ruler Toggle */}
          {hasFaceCalibration && hasMeasurement && <button
            type="button"
            onClick={onToggleRuler}
            aria-pressed={state.showRuler}
            className={`flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${state.showRuler ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}
          >
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true"><path d="M1 9h16M2 9V3M6 9V5M10 9V3M14 9V5" stroke={state.showRuler ? 'var(--gold)' : 'currentColor'} strokeWidth="1.6" fill="none" /></svg>
            <span>Ruler</span>
          </button>}

          {/* Compare Mode Toggle (Shown when styling extras are active) */}
          {hasExtras && (
            <div className="flex items-center gap-5" role="group" aria-label="Compare styling">
              <button
                type="button"
                onClick={() => onSetCompareMode('original')}
                aria-pressed={state.compareMode === 'original'}
                className={`link-draw ${state.compareMode === 'original' ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}
              >
                Styled preview
              </button>
              <button
                type="button"
                onClick={() => onSetCompareMode('earring-only')}
                aria-pressed={state.compareMode === 'earring-only'}
                className={`link-draw ${state.compareMode === 'earring-only' ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]'}`}
              >
                Without styling
              </button>
            </div>
          )}

          {/* Download button */}
          <a
            href={state.resultImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={downloadName}
            aria-label="Download try-on image"
            className="ml-auto flex h-9 w-9 items-center justify-center text-[var(--ink-2)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>

      {/* Main Content: Tolerance Verdict & Styling Row */}
      <div className="flex min-w-0 flex-col gap-5 bg-[var(--bg)] p-6 lg:max-h-full lg:overflow-y-auto">
        {/* Measured result: a gold tick when the render is within tolerance */}
        {hasMeasurement && (
          <div className="flex items-baseline justify-between gap-4 text-[16px]">
            <span className="tabular-nums text-[var(--ink)]">
              Asked {requestedCm.toFixed(1)} cm · shown {targetCm.toFixed(1)} cm
            </span>
            <span className={`flex items-center gap-2 ${withinTolerance === false ? 'text-[var(--warn)]' : 'text-[var(--ink-2)]'}`}>
              {withinTolerance === true && <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7.5 5.5 11 12 3" stroke="var(--gold)" strokeWidth="2" fill="none" /></svg>}
              {withinTolerance === true
                ? 'Within tolerance'
                : withinTolerance === false
                  ? `Outside ${state.measurement?.tolerancePct ?? state.tolerancePct}% tolerance`
                  : 'Tolerance status unavailable'}
            </span>
          </div>
        )}

        {capabilities.calibration && capabilities.sizes?.length && onCompareSize && (
          <fieldset className="flex flex-col gap-3" aria-busy={isComparingSize}>
            <legend className="font-display text-2xl text-[var(--ink)]">Drop length</legend>
            <SizeRuler
              sizes={capabilities.sizes}
              value={state.sizeCm}
              label="Compare drop lengths"
              disabled={isComparingSize}
              isAvailable={(sizeCm) => !state.isSampleFace || sizeComparisons.some((item) => item.sizeCm === sizeCm)}
              unavailableHint="Upload your photo to try this size."
              onChange={(sizeCm) => onCompareSize(sizeCm)}
            />
          </fieldset>
        )}

        {/* Primary decision (sticky at the bottom on phones) */}
        <div className={`flex flex-col gap-3 pt-2 ${studio.decision}`}>
          <button
            type="button"
            onClick={onAddToCart}
            data-press=""
            className="w-full cursor-pointer bg-[var(--ink)] px-5 h-[52px] text-center text-[16px] text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
          >
            Save this choice
          </button>

          {/* Secondary actions stay quiet beneath the decision. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[16px] text-[var(--ink)]">
            <button type="button" onClick={onRecalibrate} className="link-draw">
              {state.isSampleFace ? 'Use my own photo' : hasFaceCalibration || product.type === 'ring' ? 'Change sizing details' : 'Review photo details'}
            </button>
            {canStyle && <button
              type="button"
              onClick={() => setShowCompleteTheLook((open) => !open)}
              aria-expanded={showCompleteTheLook}
              className="link-draw"
            >
              Style it
            </button>}
            <button type="button" onClick={handleShareSave} className="link-draw">
              Share product
            </button>
          </div>
        </div>

        {state.error && <p role="alert" className="text-[16px] text-[var(--warn)]">{state.error.userMessage}</p>}
        {canStyle && (
          <CompleteTheLook
            hidden={!showCompleteTheLook}
            photoId={state.isSampleFace ? null : state.photoId}
            extras={state.extras}
            isRendering={state.isPresetRendering || isComparingSize}
            cachedPresets={state.cachedPresets}
            hairTemplates={hairTemplates}
            isLoadingHairTemplates={isLoadingHairTemplates}
            onRequestHairTemplates={onRequestHairTemplates}
            onApplyStyling={onApplyStyling}
            onClearStyling={onClearStyling}
          />
        )}

        {/* One line of context; the rest of the honesty notes sit behind "How we measure". */}
        <p className="text-[16px] text-[var(--ink-2)] tabular-nums">
          {state.isSampleFace && (hasFaceCalibration || product.type === 'necklace')
            ? 'Use your own photo to try every size and styling.'
            : capabilities.calibration ? `${state.sizeCm} cm drop` : capabilities.dimensionLabel}
        </p>
        <details className="text-[15px] text-[var(--ink-2)]">
          <summary className="cursor-pointer text-[16px] text-[var(--ink)]">How we measure</summary>
          <div className="mt-3 flex flex-col gap-2">
            <p className="tabular-nums">{capabilities.calibration ? `${state.sizeCm} cm drop` : capabilities.dimensionLabel}{state.isSampleFace ? ' · Sample result: pre-recorded YouCam demo' : ''}</p>
            <p>{capabilities.assumption}</p>
            {!hasMeasurement && hasFaceCalibration && <p>Size estimate unavailable for this render.</p>}
          </div>
        </details>
      </div>
    </div>
  )
}
