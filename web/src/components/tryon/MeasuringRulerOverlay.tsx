'use client'

import React from 'react'
import { MeasuringRulerOverlayProps } from './types'

/**
 * Gold measuring overlay drawn in the photo's own pixel space (viewBox = natural size, "meet" = the
 * same fit as object-contain), so every mark lands exactly on the rendered piece.
 * Shows the measured length beside the piece and a "where it ends" line across the photo at its lowest point.
 */
export function MeasuringRulerOverlay({
  box,
  renderedCm,
  caliperDrawn,
  naturalWidth = 1104,
  naturalHeight = 1472,
}: MeasuringRulerOverlayProps) {
  const rulerX = box.x + box.w + 16
  const topY = box.y
  const bottomY = box.y + box.h
  const centerY = box.y + box.h / 2
  const labelWidth = 150
  const labelHeight = 52
  // Keep the label on the ear-facing side of the measured box so it cannot collide with the split handle.
  const labelX = Math.max(8, box.x - labelWidth - 20)
  const labelY = centerY - labelHeight / 2
  const endsLabelW = 168
  const endsLabelX = naturalWidth - endsLabelW - 12

  return (
    <svg
      viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
      className="absolute inset-0 z-10 h-full w-full pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* Where it ends: a gold line across the whole photo at the piece's lowest point */}
      {caliperDrawn && (
        <g data-ends-here="">
          <line x1={0} y1={bottomY} x2={naturalWidth} y2={bottomY} stroke="var(--gold)" strokeWidth="4" strokeDasharray="16 12" />
          <rect x={endsLabelX} y={bottomY - 26} width={endsLabelW} height={52} fill="var(--bg)" />
          <text x={endsLabelX + endsLabelW / 2} y={bottomY + 11} textAnchor="middle" fill="var(--ink)" fontFamily="var(--font-sans), Helvetica, Arial, sans-serif" fontSize="30">
            ends here
          </text>
        </g>
      )}

      <g style={{ opacity: caliperDrawn ? 1 : 0 }}>
        <line x1={rulerX - 12} y1={topY} x2={rulerX + 12} y2={topY} stroke="var(--gold)" strokeWidth="6" />
        <line
          x1={rulerX}
          y1={topY}
          x2={rulerX}
          y2={bottomY}
          stroke="var(--gold)"
          strokeWidth="6"
          strokeDasharray={`${box.h} ${box.h}`}
          className="transition-[stroke-dashoffset] duration-400 ease-out"
          style={{ strokeDashoffset: caliperDrawn ? 0 : box.h }}
        />
        <line x1={rulerX - 12} y1={bottomY} x2={rulerX + 12} y2={bottomY} stroke="var(--gold)" strokeWidth="6" />
        <line x1={rulerX - 7} y1={topY + box.h * 0.25} x2={rulerX + 7} y2={topY + box.h * 0.25} stroke="var(--gold)" strokeWidth="4" />
        <line x1={rulerX - 7} y1={topY + box.h * 0.75} x2={rulerX + 7} y2={topY + box.h * 0.75} stroke="var(--gold)" strokeWidth="4" />
      </g>

      {/* Native SVG text avoids foreignObject scaling the label down to unreadable pixels. */}
      {caliperDrawn && (
        <g>
          <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} fill="var(--ink)" />
          <text
            x={labelX + labelWidth / 2}
            y={centerY + 12}
            textAnchor="middle"
            fill="white"
            fontFamily="var(--font-display), Georgia, serif"
            fontSize="36"
          >
            {renderedCm.toFixed(1)} cm
          </text>
        </g>
      )}
    </svg>
  )
}
