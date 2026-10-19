'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { PillButton } from '@/components/PillButton'
import { useCart } from '@/hooks/useCart'
import { CartDrawer } from '@/components/tryon/CartDrawer'

export function Header() {
  const pathname = usePathname()
  const scrollProgress = useScrollProgress()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { totalCount, isCartOpen, openCart, closeCart } = useCart()

  // Handle Escape key to close mobile menu & lock body scroll
  React.useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const navLinks = [
    { label: 'EARRINGS', href: '/' },
    { label: 'NECKLACES', href: '/#necklaces' },
    { label: 'SAMPLE LOOKS', href: '/#samples' },
    { label: 'STYLIST', href: '/stylist' },
    { label: 'ABOUT', href: '/about' },
    { label: 'ADMIN', href: '/admin' },
  ]

  const isActive = (href: string) => {
    if (href === '/' && (pathname === '/' || pathname.startsWith('/p/'))) return true
    if (href === '/#samples' && pathname.startsWith('/look')) return true
    if (href !== '/' && !href.startsWith('/#') && pathname.startsWith(href)) return true
    return false
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 pointer-events-none text-white transition-opacity duration-180"
        style={{
          mixBlendMode: 'difference',
          padding: '1.5rem 2rem',
        }}
      >
        <div className="w-full flex items-start justify-between">
          {/* Left: DARPAN wordmark frame (130x56) */}
          <div className="w-[130px] h-[56px] flex items-center shrink-0 pointer-events-auto">
            <Link
              href="/"
              className="text-lg font-bold uppercase tracking-[0.32em] leading-none select-none hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
              aria-label="Darpan Home"
            >
              DARPAN
            </Link>
          </div>

          {/* Middle-left: Tagline (desktop only >= 700px) */}
          <div className="hidden min-[700px]:block max-w-[21rem] pointer-events-auto px-4">
            <p className="ui-label text-[11px] leading-relaxed text-white/90">
              TRUE-SIZE JEWELLERY, ON YOU, BEFORE YOU BUY
            </p>
          </div>

          {/* Centre: Vertical menu links (desktop only >= 700px) */}
          <nav
            aria-label="Main Navigation"
            className="hidden min-[700px]:flex flex-col gap-1 items-start pointer-events-auto"
          >
            {navLinks.map((link) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center ui-label text-[11px] hover:text-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] mr-2 shrink-0"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-transparent mr-2 shrink-0 group-hover:bg-[var(--gold)]/40 transition-colors"
                    />
                  )}
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right: BAG (0) & TRY ON ME pill button */}
          <div className="flex items-center gap-4 shrink-0 pointer-events-auto">
            {/* Bag button (desktop only) */}
            <button
              type="button"
              onClick={openCart}
              aria-label={`View shopping bag with ${totalCount} items`}
              className="hidden min-[700px]:inline-block ui-label text-[11px] hover:text-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] cursor-pointer"
            >
              BAG ({totalCount})
            </button>

            {/* Mobile menu toggle (< 700px) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-[700px]:hidden ui-label text-[11px] px-3 py-2 border border-white/40 rounded-full focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? 'CLOSE' : 'MENU'}
            </button>

            {/* TRY ON ME Pill */}
            <PillButton
              href="/p/gilded-teardrop?tryon=1"
              variant="primary"
              ariaLabel="Try jewellery on me"
              className="!border-white/50 text-white !py-2 !px-4"
            >
              TRY ON ME
            </PillButton>
          </div>
        </div>

        {/* 1px progress hairline under header */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/20 pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="h-full bg-[var(--gold)] transition-[width] duration-75 ease-out"
            style={{ width: `${Math.min(Math.max(scrollProgress * 100, 0), 100)}%` }}
          />
        </div>
      </header>

      {/* Mobile Menu Overlay (< 700px) */}
      {mobileMenuOpen && (
        <div
          className="min-[700px]:hidden fixed inset-0 z-30 bg-[var(--paper)] text-[var(--ink)] pt-24 px-8 pb-12 flex flex-col justify-between"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <nav className="flex flex-col gap-6 mt-6">
            {navLinks.map((link, idx) => {
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 text-2xl font-serif-italic hover:text-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
                >
                  <span className="ui-label text-xs text-[var(--ink-2)] tabular-nums">
                    0{idx + 1}
                  </span>
                  <span>{link.label}</span>
                  {active && (
                    <span className="w-2 h-2 rounded-full bg-[var(--gold)] ml-2" />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="pt-8 border-t border-[var(--line)] flex justify-between items-center ui-label text-xs">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                openCart()
              }}
              className="hover:text-[var(--gold)] text-left cursor-pointer"
            >
              BAG ({totalCount})
            </button>
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[var(--gold)]"
            >
              ADMIN
            </Link>
          </div>
        </div>
      )}

      {/* Slide-over cart sheet accessible globally */}
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
    </>
  )
}
