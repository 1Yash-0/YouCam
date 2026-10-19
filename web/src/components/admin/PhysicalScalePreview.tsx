'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { ReferenceStandard } from './types'

interface PhysicalScalePreviewProps {
  heightCm: number
  widthCm: number
  imagePreviewUrl?: string | null
  productName?: string
}

// 35 px per cm provides comfortable desktop view inside 320x360 preview canvas
const PX_PER_CM = 35

export function PhysicalScalePreview({
  heightCm,
  widthCm,
  imagePreviewUrl,
  productName = 'Product',
}: PhysicalScalePreviewProps) {
  const [reference, setReference] = useState<ReferenceStandard>('coin')

  const validDimensions = heightCm > 0 && widthCm > 0
  const itemHeightPx = Math.max(10, Math.round(heightCm * PX_PER_CM))
  const itemWidthPx = Math.max(10, Math.round(widthCm * PX_PER_CM))

  // Reference dimensions in cm and px
  const coinDiameterCm = 2.2 // Indian 1-Rupee Coin
  const coinPx = Math.round(coinDiameterCm * PX_PER_CM) // ~77px

  const cardWidthCm = 8.56 // ISO ID-1 Standard Payment Card
  const cardHeightCm = 5.40
  const cardWidthPx = Math.round(cardWidthCm * PX_PER_CM) // ~300px
  const cardHeightPx = Math.round(cardHeightCm * PX_PER_CM) // ~189px

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-[var(--radius-sm)] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <span className="ui-label text-[10px] text-[var(--gold)] block">Scale Calibration</span>
          <h3 className="text-sm font-medium text-[var(--ink)]">Physical Size Preview</h3>
        </div>

        {/* Reference Standard Toggle */}
        <div
          role="radiogroup"
          aria-label="Reference standard comparison"
          className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-full text-[11px]"
        >
          <button
            type="button"
            role="radio"
            aria-checked={reference === 'coin'}
            onClick={() => setReference('coin')}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              reference === 'coin'
                ? 'bg-[var(--gold)] text-white font-medium shadow-xs'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            ₹1 Coin
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={reference === 'card'}
            onClick={() => setReference('card')}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              reference === 'card'
                ? 'bg-[var(--gold)] text-white font-medium shadow-xs'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            Payment Card
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={reference === 'grid'}
            onClick={() => setReference('grid')}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              reference === 'grid'
                ? 'bg-[var(--gold)] text-white font-medium shadow-xs'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            Metric Grid
          </button>
        </div>
      </div>

      {/* Live Stage */}
      <div className="relative min-h-[280px] bg-white/60 dark:bg-black/20 rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] flex items-center justify-center p-6 overflow-hidden">
        {/* Metric Grid Background (if grid selected or faint background) */}
        {reference === 'grid' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(212,175,55,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,175,55,0.25) 1px, transparent 1px)`,
              backgroundSize: `${PX_PER_CM}px ${PX_PER_CM}px`,
            }}
            aria-hidden="true"
          />
        )}

        {!validDimensions ? (
          <div className="text-center p-6 text-[var(--ink-2)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border border-dashed border-[var(--gold)] flex items-center justify-center text-[var(--gold)] font-serif-italic">
              cm
            </div>
            <p className="text-xs">Enter height and width to view true-scale preview</p>
          </div>
        ) : (
          <div className="relative z-10 flex items-center justify-center gap-8 w-full">
            {/* Jewellery item scale render */}
            <div className="flex flex-col items-center">
              <div
                className="relative flex items-center justify-center transition-all duration-200"
                style={{
                  height: `${itemHeightPx}px`,
                  width: `${itemWidthPx}px`,
                }}
              >
                {imagePreviewUrl ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={imagePreviewUrl}
                      alt={productName}
                      fill
                      unoptimized
                      className="object-contain filter drop-shadow-md"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-md border-2 border-[var(--gold)] bg-[var(--gold)]/10 flex items-center justify-center text-[10px] text-[var(--gold)] font-medium text-center p-1">
                    {widthCm} × {heightCm}
                  </div>
                )}

                {/* Caliper overlay on right side */}
                <div
                  className="absolute -right-7 top-0 bottom-0 flex flex-col items-center justify-between pointer-events-none"
                  aria-hidden="true"
                >
                  <div className="w-3 h-[1px] bg-[var(--gold)]" />
                  <div className="w-[1px] h-full bg-[var(--gold)]/70 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 ui-label text-[9px] text-[var(--gold)] tabular-nums whitespace-nowrap bg-[var(--paper)] px-1 rounded border border-[var(--line)]">
                      {heightCm} cm
                    </span>
                  </div>
                  <div className="w-3 h-[1px] bg-[var(--gold)]" />
                </div>
              </div>

              <span className="ui-label text-[9px] text-[var(--ink-2)] mt-3 tabular-nums">
                {productName} ({widthCm} × {heightCm} cm)
              </span>
            </div>

            {/* Reference Object */}
            {reference === 'coin' && (
              <div className="flex flex-col items-center">
                <div
                  className="rounded-full border-2 border-[#B8860B] bg-linear-to-br from-[#FFD700]/30 via-[#DAA520]/40 to-[#B8860B]/50 flex flex-col items-center justify-center shadow-inner relative transition-all duration-200"
                  style={{
                    width: `${coinPx}px`,
                    height: `${coinPx}px`,
                  }}
                  title="₹1 Coin (2.2 cm diameter)"
                >
                  <span className="text-xs font-bold text-[#8B6508]">₹1</span>
                  <span className="text-[7px] text-[#8B6508]/80 font-mono">INDIA</span>
                </div>
                <span className="ui-label text-[9px] text-[var(--ink-2)] mt-3">
                  ₹1 Coin (2.2 cm ⌀)
                </span>
              </div>
            )}

            {reference === 'card' && (
              <div className="flex flex-col items-center">
                <div
                  className="rounded-lg border border-neutral-400 bg-linear-to-tr from-neutral-800 via-neutral-700 to-neutral-900 p-2 flex flex-col justify-between shadow-md text-white transition-all duration-200"
                  style={{
                    width: `${Math.min(cardWidthPx, 180)}px`,
                    height: `${Math.min(cardHeightPx, 114)}px`,
                  }}
                  title="ISO Payment Card (8.56 × 5.40 cm)"
                >
                  <div className="flex justify-between items-center">
                    <div className="w-4 h-3 rounded bg-amber-400/80" />
                    <span className="text-[8px] font-mono tracking-wider opacity-70">KAARI</span>
                  </div>
                  <div className="text-[7px] font-mono tracking-widest opacity-80">
                    •••• 8820
                  </div>
                </div>
                <span className="ui-label text-[9px] text-[var(--ink-2)] mt-3">
                  Payment Card (8.56 × 5.40 cm)
                </span>
              </div>
            )}

            {reference === 'grid' && (
              <div className="flex flex-col items-start bg-[var(--paper)]/90 p-2 rounded border border-[var(--line)] text-[10px] text-[var(--ink-2)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 bg-[var(--gold)] rounded-xs" />
                  <span className="font-mono">1 Grid Cell = 1.0 cm</span>
                </div>
                <div className="font-mono text-[9px] text-[var(--ink-2)]">
                  Scale: {PX_PER_CM} px/cm
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--ink-2)]">
        <span>Iris Baseline: 11.7 mm reference</span>
        <span>Resolution: ~35 px/cm calibrated</span>
      </div>
    </div>
  )
}
