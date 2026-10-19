'use client'

import React from 'react'

export interface CategoryItem {
  id: string
  label: string
  sublabel: string
  silhouette: 'all' | 'earrings' | 'studs' | 'drops' | 'necklaces' | 'sets'
}

export const CATEGORIES: CategoryItem[] = [
  { id: 'all', label: 'ALL JEWELLERY', sublabel: 'Curated Collection', silhouette: 'all' },
  { id: 'drops', label: 'DROPS', sublabel: 'Elongated Teardrops', silhouette: 'drops' },
  { id: 'studs', label: 'STUDS', sublabel: 'Solitary Gems', silhouette: 'studs' },
  { id: 'earrings', label: 'EARRINGS', sublabel: 'Hoops & Chandeliers', silhouette: 'earrings' },
  { id: 'necklaces', label: 'NECKLACES', sublabel: 'Chains & Collars', silhouette: 'necklaces' },
  { id: 'sets', label: 'BRIDAL SETS', sublabel: 'Coordinated Looks', silhouette: 'sets' },
]

export function CategorySilhouette({
  type,
}: {
  type: 'all' | 'earrings' | 'studs' | 'drops' | 'necklaces' | 'sets'
}) {
  switch (type) {
    case 'all':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-7 h-7">
          <polygon points="16,3 27,11 22,28 10,28 5,11" />
          <polyline points="5,11 16,16 27,11" />
          <line x1="16" y1="16" x2="16" y2="28" />
          <line x1="10" y1="28" x2="16" y2="16" />
          <line x1="22" y1="28" x2="16" y2="16" />
        </svg>
      )
    case 'earrings':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-7 h-7">
          <circle cx="16" cy="18" r="9" strokeDasharray="42 12" />
          <path d="M16 9V4" />
          <circle cx="16" cy="4" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'studs':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-7 h-7">
          <polygon points="16,6 26,16 16,26 6,16" />
          <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          <line x1="6" y1="6" x2="10" y2="10" strokeWidth="1" />
          <line x1="26" y1="6" x2="22" y2="10" strokeWidth="1" />
        </svg>
      )
    case 'drops':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-7 h-7">
          <path d="M16 6 C12 14 8 18 8 23 A8 8 0 0 0 24 23 C24 18 20 14 16 6 Z" />
          <circle cx="16" cy="4" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'necklaces':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-7 h-7">
          <path d="M5 8 C8 20 24 20 27 8" />
          <line x1="16" y1="17" x2="16" y2="22" />
          <circle cx="16" cy="24" r="2.5" fill="currentColor" />
        </svg>
      )
    case 'sets':
      return (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="w-7 h-7">
          <path d="M11 12 C9 17 6 19 6 22 A5 5 0 0 0 16 22 C16 19 13 17 11 12 Z" />
          <circle cx="23" cy="14" r="3" fill="none" />
          <circle cx="23" cy="14" r="1" fill="currentColor" />
        </svg>
      )
    default:
      return null
  }
}

export interface CategoryRailProps {
  activeCategory?: string
  onCategorySelect?: (categoryId: string) => void
  targetAnchor?: string
  className?: string
}

export function CategoryRail({
  activeCategory = 'all',
  onCategorySelect,
  targetAnchor = '#collection',
  className = '',
}: CategoryRailProps) {
  const handleClick = (e: React.MouseEvent, catId: string) => {
    e.preventDefault()
    if (onCategorySelect) {
      onCategorySelect(catId)
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('darpan:category', { detail: catId }))
      const target = document.querySelector(targetAnchor)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        window.history.replaceState(null, '', `${targetAnchor}?cat=${catId}`)
      }
    }
  }

  return (
    <nav
      aria-label="Jewellery Categories"
      className={`w-full py-8 md:py-12 border-y border-[var(--line)] bg-white ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-start md:justify-center gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <a
                key={cat.id}
                href={`${targetAnchor}?cat=${cat.id}`}
                onClick={(e) => handleClick(e, cat.id)}
                className={`
                  snap-center group shrink-0 flex flex-col items-center p-3 md:p-4 rounded-xl transition-all duration-200
                  focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-2
                  ${
                    isActive
                      ? 'bg-[var(--paper)] text-[var(--gold)] shadow-xs border-b border-[var(--gold)]'
                      : 'text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--paper)]/60 border-b border-transparent'
                  }
                `}
              >
                <div
                  className={`p-2.5 rounded-full mb-2 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-[var(--gold)]' : 'text-[var(--ink-2)] group-hover:text-[var(--gold)]'
                  }`}
                >
                  <CategorySilhouette type={cat.silhouette} />
                </div>
                <span className="ui-label text-[11px] font-bold tracking-wider mb-0.5">
                  {cat.label}
                </span>
                <span className="text-[10px] text-[var(--ink-2)]/80 font-normal">
                  {cat.sublabel}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
