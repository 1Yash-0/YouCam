'use client'

import React from 'react'
import Image from 'next/image'
import { DrawerHeaderProps, DrawerStep } from './types'

export function DrawerHeader({
  product,
  selectedSizeCm,
  onSizeChange,
  currentStep,
  onClose,
  availableSizes,
}: DrawerHeaderProps) {
  const sizes: number[] =
    availableSizes ||
    ('sizes' in product && product.sizes ? product.sizes : undefined) ||
    ('heightCm' in product ? [2.0, 3.0, 4.5, 6.0] : [0.4, 0.6, 0.8])

  const steps: { id: DrawerStep; label: string; number: string }[] = [
    { id: 'photo', label: 'PHOTO', number: '01' },
    { id: 'measure', label: 'MEASURE', number: '02' },
    { id: 'result', label: 'RESULT', number: '03' },
  ]

  const getStepStatus = (stepId: DrawerStep) => {
    if (currentStep === stepId) return 'active'
    if (stepId === 'photo' && (currentStep === 'measure' || currentStep === 'processing' || currentStep === 'result' || currentStep === 'bag')) return 'completed'
    if (stepId === 'measure' && (currentStep === 'processing' || currentStep === 'result' || currentStep === 'bag')) return 'completed'
    return 'pending'
  }

  return (
    <header className="px-5 py-4 border-b border-[var(--line)] bg-[var(--paper)] shrink-0 flex flex-col gap-3">
      {/* Top row: Product info + Close button */}
      <div className="flex items-center justify-between gap-3">
        {/* Product thumb & title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-[var(--radius-sm)] overflow-hidden bg-white border border-[var(--line)] shrink-0">
            <Image
              src={product.imagePath}
              alt={product.name}
              fill
              sizes="40px"
              className="object-contain p-1 bg-[var(--paper)]"
            />
          </div>
          <div className="min-w-0">
            <span className="ui-label text-[14px] text-[var(--gold)] block truncate">
              {product.brand}
            </span>
            <h2 id="drawer-title" className="text-sm font-medium text-[var(--ink)] truncate">
              {product.name}
            </h2>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close try-on mirror"
          className="w-9 h-9 rounded-full border border-[var(--line)] flex items-center justify-center text-[var(--ink)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] shrink-0"
        >
          <svg
            className="w-4 h-4 transition-transform duration-200 hover:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Bottom row: Size selector chips & Step pill indicator */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line)]/60">
        {/* Size chips */}
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Physical jewellery size">
          <span className="ui-label text-[14px] text-[var(--ink-2)] mr-1 hidden sm:inline">SIZE:</span>
          {sizes.map((size: number) => {
            const active = Math.abs(selectedSizeCm - size) < 0.05
            return (
              <button
                key={size}
                role="radio"
                aria-checked={active}
                onClick={() => onSizeChange(size)}
                className={`relative px-2.5 py-1 text-[14px] ui-label rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${
                  active ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                {size.toFixed(1)}
              </button>
            )
          })}
        </div>

        {/* Step indicator */}
        <nav aria-label="Try-on steps" className="flex items-center gap-1 text-[14px] ui-label">
          {steps.map((st, idx) => {
            const status = getStepStatus(st.id)
            return (
              <React.Fragment key={st.id}>
                {idx > 0 && <span className="text-[var(--line)]">·</span>}
                <div
                  className={`flex items-center gap-1 ${
                    status === 'active'
                      ? 'text-[var(--gold)] font-bold'
                      : status === 'completed'
                      ? 'text-[var(--ink)]'
                      : 'text-[var(--ink-2)] opacity-60'
                  }`}
                >
                  <span>{st.number}</span>
                  <span className="hidden sm:inline">{st.label}</span>
                  {status === 'completed' && <span className="text-[var(--gold)] text-[14px]">✓</span>}
                </div>
              </React.Fragment>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
