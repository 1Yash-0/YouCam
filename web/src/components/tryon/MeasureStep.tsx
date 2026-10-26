'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { PillButton } from '@/components/PillButton'
import { MeasureStepProps } from './types'

export function MeasureStep({
  photoUrl,
  isSampleFace,
  irisPx,
  onIrisChange,
  onResetAverage,
  ear,
  onEarChange,
  selectedSizeCm,
  onSubmitTryOn,
  isSubmitting,
  caliperCoords,
  onCaliperCoordsChange,
}: MeasureStepProps) {
  const [naturalSize, setNaturalSize] = useState({ width: 1104, height: 1472 })
  // Default to 2.5x zoom focusing on the eye
  const [zoom, setZoom] = useState(2.5)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [activeDrag, setActiveDrag] = useState<'left' | 'right' | 'center' | 'pan' | null>(null)
  const [dragStart, setDragStart] = useState({ clientX: 0, clientY: 0, irisPx: 41, coords: caliperCoords, pan: { x: 0, y: 0 } })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Load natural dimensions of the photo
  useEffect(() => {
    if (!photoUrl) return
    const img = new window.Image()
    img.src = photoUrl
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      }
    }
  }, [photoUrl])

  // Center pan on the eye at 2.5x zoom initially
  const focusEye = useCallback(() => {
    setZoom(2.5)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  // Calculate SVG ViewBox based on zoom and pan
  const { width: W, height: H } = naturalSize
  const viewWidth = W / zoom
  const viewHeight = H / zoom

  // Base eye focus center point
  const targetCenterX = caliperCoords.x + panOffset.x
  const targetCenterY = caliperCoords.y + panOffset.y

  const minX = Math.max(0, Math.min(W - viewWidth, targetCenterX - viewWidth / 2))
  const minY = Math.max(0, Math.min(H - viewHeight, targetCenterY - viewHeight / 2))
  const viewBox = `${minX} ${minY} ${viewWidth} ${viewHeight}`

  // Caliper coordinates in natural image space
  const halfIris = irisPx / 2
  const leftX = caliperCoords.x - halfIris
  const rightX = caliperCoords.x + halfIris
  const caliperY = caliperCoords.y

  // Convert client pointer coordinate to natural SVG coordinates
  const screenToSvgCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 }
      const pt = svgRef.current.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svgRef.current.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const inverted = pt.matrixTransform(ctm.inverse())
      return {
        x: Math.max(0, Math.min(W, inverted.x)),
        y: Math.max(0, Math.min(H, inverted.y)),
      }
    },
    [W, H]
  )

  // Pointer drag handling
  const handlePointerDown = (mode: 'left' | 'right' | 'center' | 'pan', e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setActiveDrag(mode)
    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      irisPx,
      coords: { ...caliperCoords },
      pan: { ...panOffset },
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag) return
    e.preventDefault()

    if (activeDrag === 'left') {
      const current = screenToSvgCoords(e.clientX, e.clientY)
      // Dragging left handle moves left edge relative to right edge
      const newWidth = Math.max(12, Math.round(rightX - current.x))
      onIrisChange(newWidth)
      onCaliperCoordsChange({
        x: rightX - newWidth / 2,
        y: caliperCoords.y,
      })
    } else if (activeDrag === 'right') {
      const current = screenToSvgCoords(e.clientX, e.clientY)
      // Dragging right handle moves right edge relative to left edge
      const newWidth = Math.max(12, Math.round(current.x - leftX))
      onIrisChange(newWidth)
      onCaliperCoordsChange({
        x: leftX + newWidth / 2,
        y: caliperCoords.y,
      })
    } else if (activeDrag === 'center') {
      const current = screenToSvgCoords(e.clientX, e.clientY)
      const start = screenToSvgCoords(dragStart.clientX, dragStart.clientY)
      const dx = current.x - start.x
      const dy = current.y - start.y
      onCaliperCoordsChange({
        x: Math.max(halfIris, Math.min(W - halfIris, dragStart.coords.x + dx)),
        y: Math.max(30, Math.min(H - 30, dragStart.coords.y + dy)),
      })
    } else if (activeDrag === 'pan') {
      // Pan viewport
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = ((e.clientX - dragStart.clientX) / rect.width) * viewWidth
      const dy = ((e.clientY - dragStart.clientY) / rect.height) * viewHeight
      setPanOffset({
        x: dragStart.pan.x - dx,
        y: dragStart.pan.y - dy,
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDrag) {
      try {
        ;(e.target as Element).releasePointerCapture(e.pointerId)
      } catch {}
      setActiveDrag(null)
    }
  }

  // Keyboard accessibility for calipers
  const handleLeftKey = (e: React.KeyboardEvent) => {
    const delta = e.shiftKey ? 5 : 1
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onIrisChange(Math.min(100, irisPx + delta))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onIrisChange(Math.max(12, irisPx - delta))
    }
  }

  const handleRightKey = (e: React.KeyboardEvent) => {
    const delta = e.shiftKey ? 5 : 1
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onIrisChange(Math.min(100, irisPx + delta))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onIrisChange(Math.max(12, irisPx - delta))
    }
  }

  const pxPerCm = irisPx / 1.17

  return (
    <div className="calibration-layout">
      {/* Canvas Viewport Stage */}
      <div
        ref={containerRef}
        className="relative w-full min-h-[360px] h-[min(70vh,760px)] bg-[var(--paper)] overflow-hidden select-none touch-none border-b border-[var(--line)]"
        onPointerDown={(e) => handlePointerDown('pan', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* SVG Display & Caliper Overlay */}
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full h-full cursor-grab active:cursor-grabbing pointer-events-auto"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Photo background */}
          <image
            href={photoUrl}
            x="0"
            y="0"
            width={W}
            height={H}
            preserveAspectRatio="none"
          />

          {/* Caliper Graphics Group */}
          <g className="pointer-events-auto">
            {/* Horizontal connecting hairline */}
            <line
              x1={leftX}
              y1={caliperY}
              x2={rightX}
              y2={caliperY}
              stroke="var(--gold)"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />

            {/* Left caliper vertical guide */}
            <line
              x1={leftX}
              y1={caliperY - 30}
              x2={leftX}
              y2={caliperY + 30}
              stroke="var(--gold)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />

            {/* Right caliper vertical guide */}
            <line
              x1={rightX}
              y1={caliperY - 30}
              x2={rightX}
              y2={caliperY + 30}
              stroke="var(--gold)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />

            {/* Center draggable grab area */}
            <rect
              x={leftX + 4}
              y={caliperY - 14}
              width={Math.max(1, irisPx - 8)}
              height="28"
              fill="transparent"
              className="cursor-move"
              onPointerDown={(e) => handlePointerDown('center', e)}
            />

            {/* Left Draggable Handle */}
            <g
              transform={`translate(${leftX}, ${caliperY})`}
              className="cursor-ew-resize focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2"
              tabIndex={0}
              role="slider"
              aria-label="Left Iris Caliper Handle"
              aria-valuemin={12}
              aria-valuemax={100}
              aria-valuenow={Math.round(irisPx)}
              onKeyDown={handleLeftKey}
              onPointerDown={(e) => handlePointerDown('left', e)}
            >
              {/* Invisible large touch target */}
              <circle r="22" fill="transparent" />
              {/* Visible Handle Diamond */}
              <circle r="7" fill="var(--gold)" stroke="#FFFFFF" strokeWidth="1.5" />
            </g>

            {/* Right Draggable Handle */}
            <g
              transform={`translate(${rightX}, ${caliperY})`}
              className="cursor-ew-resize focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2"
              tabIndex={0}
              role="slider"
              aria-label="Right Iris Caliper Handle"
              aria-valuemin={12}
              aria-valuemax={100}
              aria-valuenow={Math.round(irisPx)}
              onKeyDown={handleRightKey}
              onPointerDown={(e) => handlePointerDown('right', e)}
            >
              {/* Invisible large touch target */}
              <circle r="22" fill="transparent" />
              {/* Visible Handle Diamond */}
              <circle r="7" fill="var(--gold)" stroke="#FFFFFF" strokeWidth="1.5" />
            </g>
          </g>
        </svg>

        {/* Floating Live Measurement Pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="bg-[var(--ink)]/90 backdrop-blur-md text-white border border-[var(--gold)]/50 px-3.5 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
            <span className="ui-label text-[14px] tabular-nums tracking-wide">
              {irisPx} PX · 11.7 MM
            </span>
            <span className="text-white/40 text-[14px]">|</span>
            <span className="text-[14px] text-white/80 tabular-nums">
              {pxPerCm.toFixed(1)} pixels per centimetre
            </span>
          </div>
        </div>

        {/* Floating Zoom & Focus Controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-[var(--paper)]/90 backdrop-blur-md p-1 rounded-full border border-[var(--line)] z-10">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1.0, Number((z - 0.5).toFixed(1))))}
            aria-label="Zoom out"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold hover:bg-white text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            -
          </button>
          <span className="ui-label text-[14px] px-1 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4.0, Number((z + 0.5).toFixed(1))))}
            aria-label="Zoom in"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold hover:bg-white text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            +
          </button>
          <div className="w-[1px] h-4 bg-[var(--line)] mx-0.5" />
          <button
            type="button"
            onClick={focusEye}
            aria-label="Focus eye calibration"
            className="px-2.5 py-1 rounded-full ui-label text-[14px] bg-white text-[var(--ink)] hover:text-[var(--gold)] border border-[var(--line)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            Focus on the eye
          </button>
        </div>

        {/* Sample Face Badge */}
        {isSampleFace && (
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <span className="ui-label text-[14px] bg-white/90 border border-[var(--gold)]/40 text-[var(--gold)] px-2.5 py-1 rounded-full">
              Sample is pre-calibrated
            </span>
          </div>
        )}
      </div>

      {/* Calibration Controls & Submission */}
      <div className="p-6 flex flex-col gap-5 bg-white">
        {/* Caliper adjustment tools */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="ui-label text-[14px] text-[var(--gold)] block">
              STEP 02 — IRIS CALIBRATION
            </span>
            <p className="text-base text-[var(--ink-2)] mt-0.5">
              Move the guides over one eye, then match the width of its coloured iris. The 11.7 mm reference is an average, so the result is an estimate.
            </p>
          </div>

          {/* Reset to Average Button */}
          <button
            type="button"
            onClick={onResetAverage}
            className="px-3 py-1.5 rounded-full border border-[var(--line)] hover:border-[var(--gold)] text-[14px] ui-label text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] shrink-0"
          >
            Keep this width
          </button>
        </div>

        {/* Ear Selection Segmented Control */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]/60">
          <span className="ui-label text-[14px] text-[var(--ink-2)]">Ear</span>
          <div className="flex items-center gap-1 bg-[var(--paper)] p-1 rounded-full border border-[var(--line)]" role="radiogroup" aria-label="Select ear for try-on">
            {(['auto', 'left', 'right'] as const).map((opt) => {
              const active = ear === opt
              return (
                <button
                  key={opt}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onEarChange(opt)}
                  className={`
                    px-3 py-1 rounded-full text-[14px] ui-label transition-all
                    focus-visible:outline-2 focus-visible:outline-[var(--gold)]
                    ${
                      active
                        ? 'bg-[var(--ink)] text-white font-bold'
                        : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }
                  `}
                >
                  {opt.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scale calculation note */}
        <div className="p-3 rounded-lg bg-[var(--paper)] text-base text-[var(--ink-2)] flex items-center justify-between">
          <span>Drop length</span>
          <span className="ui-label text-[var(--ink)] tabular-nums">
            {selectedSizeCm.toFixed(1)} CM (~{Math.round(selectedSizeCm * pxPerCm)} PX)
          </span>
        </div>

        {/* Submission Button */}
        <PillButton
          variant="primary"
          onClick={onSubmitTryOn}
          disabled={isSubmitting}
          className="w-full justify-center !py-3 text-[14px]"
        >
          {isSubmitting ? 'CALIBRATING SCALE…' : 'TRY ON ME'}
        </PillButton>
      </div>
    </div>
  )
}
