'use client'

import React from 'react'
import Image from 'next/image'

interface PhysicalScalePreviewProps {
  heightCm: number
  widthCm: number
  imagePreviewUrl?: string | null
  productName?: string
}

const MAX_PREVIEW_WIDTH = 190
const MAX_PREVIEW_HEIGHT = 220

export function PhysicalScalePreview({
  heightCm,
  widthCm,
  imagePreviewUrl,
  productName = 'Product',
}: PhysicalScalePreviewProps) {
  const validDimensions = Number.isFinite(heightCm) && Number.isFinite(widthCm) && heightCm > 0 && widthCm > 0
  const fitScale = validDimensions
    ? Math.min(MAX_PREVIEW_WIDTH / widthCm, MAX_PREVIEW_HEIGHT / heightCm)
    : 1
  const sketchWidth = widthCm * fitScale
  const sketchHeight = heightCm * fitScale

  return (
    <section className="flex flex-col gap-4 border border-[var(--line)] bg-[var(--paper)] p-5" aria-label="Product dimension sketch">
      <div className="border-b border-[var(--line)] pb-3">
        <span className="ui-label block text-[10px] text-[var(--gold)]">DIMENSIONS</span>
        <h3 className="text-sm font-medium text-[var(--ink)]">Product sketch</h3>
      </div>

      <div className="flex min-h-[280px] items-center justify-center bg-white/60 p-6">
        {!validDimensions ? (
          <p className="max-w-48 text-center text-sm leading-relaxed text-[var(--ink-2)]">Enter the product’s measured height and width to see a proportional sketch.</p>
        ) : (
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <div
                className="relative flex max-w-full items-center justify-center border border-dashed border-[var(--gold)]/70 bg-[var(--gold)]/5"
                style={{ width: `${sketchWidth}px`, height: `${sketchHeight}px` }}
              >
                {imagePreviewUrl ? (
                  <Image src={imagePreviewUrl} alt={productName} fill unoptimized className="object-contain" />
                ) : (
                  <span className="px-2 text-center text-xs tabular-nums text-[var(--ink-2)]">{widthCm} × {heightCm} cm</span>
                )}
              </div>
              <span className="mt-3 max-w-48 text-center text-xs text-[var(--ink-2)]">{productName}</span>
            </div>
            <dl className="space-y-3 text-sm tabular-nums text-[var(--ink)]">
              <div><dt className="text-xs text-[var(--ink-2)]">Width</dt><dd>{widthCm} cm</dd></div>
              <div><dt className="text-xs text-[var(--ink-2)]">Height</dt><dd>{heightCm} cm</dd></div>
            </dl>
          </div>
        )}
      </div>
      <p className="text-xs leading-relaxed text-[var(--ink-2)]">The sketch follows the entered proportions. Its on-screen size is not physically calibrated and is not a try-on result.</p>
    </section>
  )
}
