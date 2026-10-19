'use client'

import React from 'react'

export type ProductCategory = 'All' | 'Earrings' | 'Teardrops' | 'Studs' | 'Necklaces'

export interface CategoryChipsProps {
  categories: string[]
  activeCategory: string
  onSelectCategory: (category: string) => void
  counts?: Record<string, number>
  className?: string
}

export function CategoryChips({
  categories,
  activeCategory,
  onSelectCategory,
  counts = {},
  className = '',
}: CategoryChipsProps) {
  return (
    <div
      role="group"
      aria-label="Filter collection"
      className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`}
    >
      {categories.map((cat) => {
        const isActive = activeCategory.toLowerCase() === cat.toLowerCase()
        const count = counts[cat] ?? counts[cat.toLowerCase()]

        return (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="product-grid-items"
            onClick={() => onSelectCategory(cat)}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-full ui-label text-xs tracking-wider transition-all duration-180
              focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2
              ${
                isActive
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'bg-transparent text-[var(--ink-2)] border border-[var(--line)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
              }
            `}
          >
            <span>{cat.toUpperCase()}</span>
            {count !== undefined && (
              <span
                className={`text-[10px] tabular-nums rounded-full px-1.5 py-0.2 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[var(--line)]/60 text-[var(--ink-2)]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
