'use client'

import React from 'react'

export interface FloatingCursorProps {
  x: number
  y: number
  visible: boolean
  label?: string
}

export function FloatingCursor({ x, y, visible, label = 'TRY ON' }: FloatingCursorProps) {
  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-[opacity,transform] duration-75 ease-out"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="bg-[var(--ink)] text-white px-3.5 py-1.5 rounded-full ui-label text-sm tracking-widest flex items-center gap-1.5 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
        <span>{label}</span>
      </div>
    </div>
  )
}
