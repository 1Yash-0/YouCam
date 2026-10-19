'use client'

import React, { useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { MeasuringRulerOverlay } from './MeasuringRulerOverlay'
import { SplitSliderProps } from './types'

export function SplitSlider({
  beforeImageUrl,
  afterImageUrl,
  measurement,
  targetSizeCm,
  showRuler,
  sliderPosition,
  onSliderPositionChange,
  caliperDrawn,
  displayedCm,
}: SplitSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const updatePositionFromClientX = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const rawPos = ((clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(100, Math.max(0, rawPos))
      onSliderPositionChange(Number(clamped.toFixed(1)))
    },
    [onSliderPositionChange]
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    updatePositionFromClientX(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    e.preventDefault()
    updatePositionFromClientX(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
      } catch {}
      setIsDragging(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let next = sliderPosition
    if (e.key === 'ArrowLeft') {
      next = Math.max(0, sliderPosition - 5)
    } else if (e.key === 'ArrowRight') {
      next = Math.min(100, sliderPosition + 5)
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = 100
    } else {
      return
    }
    e.preventDefault()
    onSliderPositionChange(next)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-full aspect-[4/5] bg-[var(--paper)] overflow-hidden select-none touch-none rounded-t-xl"
    >
      {/* LAYER 0: BEFORE IMAGE (Original photo or bare ear) */}
      <div className="absolute inset-0">
        <Image
          src={beforeImageUrl}
          alt="Before virtual try-on"
          fill
          sizes="(max-width: 768px) 100vw, 560px"
          priority
          className="object-cover"
        />
        {/* Subtle 'BEFORE' label */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <span className="ui-label text-[9px] px-2 py-0.5 rounded-full bg-black/40 text-white/90 backdrop-blur-xs">
            BEFORE
          </span>
        </div>
      </div>

      {/* LAYER 1: AFTER IMAGE & RULER (Inside CSS Clip-Path Mask Only) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          clipPath: `inset(0 calc(100% - ${sliderPosition}%) 0 0)`,
        }}
      >
        <Image
          src={afterImageUrl}
          alt="After virtual try-on with true-scale jewellery"
          fill
          sizes="(max-width: 768px) 100vw, 560px"
          priority
          className="object-cover"
        />

        {/* 'AFTER' label */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <span className="ui-label text-[9px] px-2 py-0.5 rounded-full bg-[var(--ink)]/70 text-white backdrop-blur-xs">
            AFTER
          </span>
        </div>

        {/* MEASURING LINE, TICKS & SIZE BADGE LIVE STRICTLY INSIDE AFTER LAYER */}
        {showRuler && (
          <MeasuringRulerOverlay
            box={measurement?.box || { x: 360, y: 648, w: 28, h: 95, pixels: 1820 }}
            renderedCm={measurement?.renderedCm ?? targetSizeCm}
            targetSizeCm={targetSizeCm}
            caliperDrawn={caliperDrawn}
            displayedCm={displayedCm}
          />
        )}
      </div>

      {/* LAYER 2: DIVIDER LINE & ACCESSIBLE HANDLE */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-20"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Vertical Gold Hairline */}
        <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-[var(--gold)] shadow-[0_0_10px_rgba(176,138,62,0.6)]" />

        {/* Draggable Pill Handle */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Before and after try-on split"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          onKeyDown={handleKeyDown}
          className="
            absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto
            w-9 h-9 rounded-full bg-[var(--ink)] text-white border-2 border-[var(--gold)]
            shadow-xl flex items-center justify-center cursor-ew-resize
            hover:scale-105 active:scale-95 transition-transform
            focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2
          "
        >
          <svg className="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l-3 3 3 3m8-6l3 3-3 3" />
          </svg>
        </div>
      </div>
    </div>
  )
}
