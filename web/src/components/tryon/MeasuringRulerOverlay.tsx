'use client'

import React from 'react'
import { MeasuringRulerOverlayProps } from './types'

export function MeasuringRulerOverlay({
  box,
  caliperDrawn,
  displayedCm,
  naturalWidth = 1104,
  naturalHeight = 1472,
}: MeasuringRulerOverlayProps) {
  // If no bounding box available, provide a fallback estimate around the earlobe
  const safeBox = box || {
    x: 360,
    y: 648,
    w: 28,
    h: 95,
    pixels: 1820,
  }

  // Position ruler 16px to the right of the detected jewellery box
  const rulerX = safeBox.x + safeBox.w + 16
  const topY = safeBox.y
  const bottomY = safeBox.y + safeBox.h
  const centerY = safeBox.y + safeBox.h / 2

  return (
    <svg
      viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>

      <g filter="url(#goldGlow)">
        {/* Top tick line */}
        <line
          x1={rulerX - 8}
          y1={topY}
          x2={rulerX + 8}
          y2={topY}
          stroke="var(--gold)"
          strokeWidth="2"
          className="transition-opacity duration-300"
          style={{ opacity: caliperDrawn ? 1 : 0 }}
        />

        {/* Vertical ruler line */}
        <line
          x1={rulerX}
          y1={topY}
          x2={rulerX}
          y2={bottomY}
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeDasharray={`${safeBox.h} ${safeBox.h}`}
          className="transition-[stroke-dashoffset] duration-400 ease-out"
          style={{
            strokeDashoffset: caliperDrawn ? 0 : safeBox.h,
          }}
        />

        {/* Bottom tick line */}
        <line
          x1={rulerX - 8}
          y1={bottomY}
          x2={rulerX + 8}
          y2={bottomY}
          stroke="var(--gold)"
          strokeWidth="2"
          className="transition-opacity duration-300"
          style={{ opacity: caliperDrawn ? 1 : 0 }}
        />

        {/* Minor sub-ticks at 25%, 50%, 75% */}
        <line
          x1={rulerX - 4}
          y1={topY + safeBox.h * 0.25}
          x2={rulerX + 4}
          y2={topY + safeBox.h * 0.25}
          stroke="var(--gold)"
          strokeWidth="1"
          style={{ opacity: caliperDrawn ? 0.7 : 0 }}
        />
        <line
          x1={rulerX - 4}
          y1={topY + safeBox.h * 0.75}
          x2={rulerX + 4}
          y2={topY + safeBox.h * 0.75}
          stroke="var(--gold)"
          strokeWidth="1"
          style={{ opacity: caliperDrawn ? 0.7 : 0 }}
        />
      </g>

      {/* Floating Centimeter Measurement Pill */}
      {caliperDrawn && (
        <foreignObject
          x={rulerX + 12}
          y={centerY - 16}
          width="130"
          height="32"
          className="overflow-visible"
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ink)]/95 text-white border border-[var(--gold)]/70 shadow-lg text-[10px] ui-label tabular-nums tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
            <span>{displayedCm.toFixed(1)} CM</span>
          </div>
        </foreignObject>
      )}
    </svg>
  )
}
