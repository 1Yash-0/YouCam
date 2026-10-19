'use client'

import React from 'react'

export interface MarqueeItem {
  text: string
  italic?: boolean
  accent?: boolean
  symbol?: 'star' | 'rhombus'
}

export const DEFAULT_MARQUEE_ITEMS: MarqueeItem[] = [
  { text: 'Kaari Studio · True Physical Scale', italic: false, symbol: 'star' },
  { text: 'Precision Iris Calibration', italic: true, accent: true, symbol: 'rhombus' },
  { text: 'TRUE PHYSICAL SCALE', italic: false, symbol: 'star' },
  { text: '11.7 MM IRIS CALIBRATION', italic: true, accent: true, symbol: 'rhombus' },
  { text: 'ATELIER HAND-CRAFTED', italic: false, symbol: 'star' },
  { text: 'SUB-MILLIMETER PRECISION', italic: true, accent: true, symbol: 'rhombus' },
  { text: 'ZERO-GUESS TRY-ON', italic: false, symbol: 'star' },
  { text: '18K RECYCLED GOLD & SILVER', italic: false, symbol: 'rhombus' },
  { text: 'KAARI STUDIO × DARPAN', italic: true, accent: true, symbol: 'star' },
]

export interface AtelierMarqueeProps {
  items?: MarqueeItem[]
  speedSeconds?: number
  className?: string
}

export function AtelierMarquee({
  items = DEFAULT_MARQUEE_ITEMS,
  speedSeconds = 42,
  className = '',
}: AtelierMarqueeProps) {
  const renderTrackContent = () => (
    <div className="flex items-center gap-8 md:gap-14 shrink-0">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <span
            className={`
              whitespace-nowrap text-2xl md:text-4xl lg:text-5xl font-light tracking-wide select-none
              ${item.italic ? 'font-serif-italic' : 'font-serif'}
              ${item.accent ? 'text-[var(--gold)]' : 'text-[var(--ink)]'}
            `}
          >
            {item.text}
          </span>
          <span className="text-[var(--gold)] shrink-0 select-none text-base md:text-xl">
            {item.symbol === 'rhombus' ? '◆' : '✦'}
          </span>
        </React.Fragment>
      ))}
    </div>
  )

  return (
    <div
      aria-label="Atelier Signatures Marquee"
      className={`group relative w-full overflow-hidden py-6 md:py-9 bg-[var(--paper)]/50 border-y border-[var(--line)] ${className}`}
    >
      <div
        className="flex w-max items-center will-change-transform group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] [animation:atelierMarquee_42s_linear_infinite] motion-reduce:[animation:none]"
        style={{
          animationDuration: `${speedSeconds}s`,
        }}
      >
        {/* Track 1 */}
        {renderTrackContent()}

        {/* Track 2 (marked aria-hidden="true" for screen readers) */}
        <div aria-hidden="true" className="shrink-0 flex items-center">
          {renderTrackContent()}
        </div>
      </div>

      <style jsx>{`
        @keyframes atelierMarquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
      `}</style>
    </div>
  )
}
