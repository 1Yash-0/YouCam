'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ProductCategory = 'All' | 'Studs' | 'Drops' | 'Stacks' | 'Necklaces' | 'Rings' | 'Bracelets' | 'Watches'

export interface CategoryChipsProps {
  categories: string[]
  activeCategory: string
  onSelectCategory: (category: string) => void
  counts?: Record<string, number>
  className?: string
}

type Indicator = {
  x: number
  y: number
  width: number
  /** False for the first measurement, so the indicator does not slide in on load. */
  animate: boolean
}

const NO_COUNTS: Record<string, number> = {}
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// The indicator is a 1px-wide bar stretched with scaleX, so the slide and the width change are both transforms.
function indicatorStyle(indicator: Indicator | null): React.CSSProperties {
  if (!indicator) return { transform: 'scaleX(0)', transition: 'none' }
  return {
    transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0) scaleX(${indicator.width})`,
    transition: indicator.animate ? 'transform 400ms var(--ease-expo)' : 'none',
  }
}

export function CategoryChips({
  categories,
  activeCategory,
  onSelectCategory,
  counts = NO_COUNTS,
  className = '',
}: CategoryChipsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const measuredOnce = useRef(false)
  const [indicator, setIndicator] = useState<Indicator | null>(null)

  const measure = useCallback(() => {
    const tab = tabRefs.current.get(activeCategory)
    if (!tab || !Number.isFinite(tab.offsetLeft)) return

    const animate = measuredOnce.current
    measuredOnce.current = true
    setIndicator({
      x: tab.offsetLeft,
      // Sit on the bottom edge of the active tab, which also works when the tabs wrap.
      y: tab.offsetTop + tab.offsetHeight - 2,
      width: tab.offsetWidth,
      animate,
    })
  }, [activeCategory])

  useIsomorphicLayoutEffect(() => {
    measure()
  }, [measure, categories, counts])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    window.addEventListener('resize', measure)
    // Web fonts change tab widths once they load, so measure again afterwards.
    void document.fonts?.ready?.then(() => measure())
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return (
    <div role="group" aria-label="Filter collection" className={`min-w-0 ${className}`}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Categories"
        className="relative flex flex-wrap items-end gap-x-7 gap-y-1"
      >
        {categories.map((cat) => {
          const isActive = activeCategory.toLowerCase() === cat.toLowerCase()
          const count = counts[cat] ?? counts[cat.toLowerCase()]

          return (
            <button
              key={cat}
              ref={(node) => {
                if (node) tabRefs.current.set(cat, node)
                else tabRefs.current.delete(cat)
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="product-grid-items"
              onClick={() => onSelectCategory(cat)}
              className={`inline-flex min-h-11 items-center gap-2 pb-2 pt-2.5 text-[15px] transition-colors duration-[180ms] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] ${
                isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
              }`}
            >
              <span>{cat}</span>
              {count !== undefined && <span className="tabular-nums text-[var(--ink-2)]">{count}</span>}
            </button>
          )
        })}

        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 block h-[2px] w-px origin-left bg-[var(--gold)]"
          style={indicatorStyle(indicator)}
        />
      </div>
    </div>
  )
}
