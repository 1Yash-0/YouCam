'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { MeasuringRulerOverlay } from './MeasuringRulerOverlay'
import { SplitSliderProps } from './types'

const NATURAL_IMAGE_WIDTH = 1104
const NATURAL_IMAGE_HEIGHT = 1472

interface ContainedImageRect {
  left: number
  top: number
  width: number
  height: number
  containerWidth: number
}

function getContainedImageRect(width: number, height: number, naturalWidth: number, naturalHeight: number): ContainedImageRect {
  const scale = Math.min(width / naturalWidth, height / naturalHeight)
  const renderedWidth = naturalWidth * scale
  const renderedHeight = naturalHeight * scale
  return {
    left: (width - renderedWidth) / 2,
    top: (height - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight,
    containerWidth: width,
  }
}

export function SplitSlider({
  beforeImageUrl,
  afterImageUrl,
  measurement,
  targetSizeCm,
  showRuler,
  sliderPosition,
  onSliderPositionChange,
  caliperDrawn,
  className = '',
}: SplitSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imageRect, setImageRect] = useState<ContainedImageRect | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: NATURAL_IMAGE_WIDTH, height: NATURAL_IMAGE_HEIGHT })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateImageRect = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width > 0 && height > 0) {
        setImageRect(getContainedImageRect(width, height, naturalSize.width, naturalSize.height))
      }
    }

    updateImageRect()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateImageRect)
    observer.observe(element)
    return () => observer.disconnect()
  }, [naturalSize.width, naturalSize.height])

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

  const sliderX = imageRect ? (sliderPosition / 100) * imageRect.containerWidth : 0
  const sliderWithinImage =
    !imageRect || (sliderX >= imageRect.left && sliderX <= imageRect.left + imageRect.width)

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`relative w-full aspect-[4/5] bg-[var(--paper)] overflow-hidden select-none touch-none rounded-t-xl ${className}`}
    >
      {/* LAYER 0: BEFORE IMAGE (Original photo or bare ear) */}
      <div className="absolute inset-0">
        <Image
          src={beforeImageUrl}
          alt="Original photo before the try-on"
          onLoad={event => { const image = event.currentTarget; if (image.naturalWidth && image.naturalHeight) setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight }) }}
          fill
          sizes="(max-width: 768px) 100vw, 560px"
          priority
          className="object-contain bg-[var(--paper)]"
        />
        {/* Subtle 'BEFORE' label */}
        <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <span className="text-[15px] px-2 py-1 bg-[var(--bg)] text-[var(--ink)]">
            Without
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
          alt="Virtual try-on result"
          fill
          sizes="(max-width: 768px) 100vw, 560px"
          priority
          className="object-contain bg-[var(--paper)]"
        />

        {/* 'AFTER' label */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <span className="text-[15px] px-2 py-1 bg-[var(--bg)] text-[var(--ink)]">
            With
          </span>
        </div>
      </div>

      {/* The ruler is intentionally outside the clipped image so its scale cue stays visible next to the jewellery. */}
      {showRuler && measurement && (
        <MeasuringRulerOverlay
          box={measurement.box}
          renderedCm={measurement.renderedCm}
          targetSizeCm={targetSizeCm}
          caliperDrawn={caliperDrawn}
          naturalWidth={measurement.naturalWidth || naturalSize.width}
          naturalHeight={measurement.naturalHeight || naturalSize.height}
        />
      )}

      {/* LAYER 2: DIVIDER LINE & ACCESSIBLE HANDLE */}
      <div
        className="absolute pointer-events-none z-20"
        style={{
          left: `${sliderPosition}%`,
          top: imageRect ? `${imageRect.top}px` : 0,
          height: imageRect ? `${imageRect.height}px` : '100%',
        }}
      >
        {/* Vertical Gold Hairline, clipped to the object-contain image rect. */}
        <div
          className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-[var(--gold)]"
          style={{ visibility: sliderWithinImage ? 'visible' : 'hidden' }}
        />

        {/* Draggable Pill Handle */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Compare original photo and try-on result"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          onKeyDown={handleKeyDown}
          className="
            absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-auto
            w-9 h-9 rounded-full bg-[var(--ink)] text-white border-2 border-[var(--gold)]
            flex items-center justify-center cursor-ew-resize
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
