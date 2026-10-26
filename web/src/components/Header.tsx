'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { CartDrawer } from '@/components/tryon/CartDrawer'
import { AnimatePresence, motion } from 'motion/react'
import { motionEase, motionTiming } from '@/lib/motion-tokens'
import { useInertBackground } from '@/hooks/useInertBackground'

type NavigationLink = {
  label: string
  href: string
}

const navigationLinks: NavigationLink[] = [
  { label: 'Shop', href: '/collection' },
  { label: 'How sizing works', href: '/how-it-works' },
  { label: 'For retailers', href: '/for-retailers' },
]

const TRY_ON_HREF = '/try-on/gilded-teardrop?sample=1'

// The bar only hides once the page has scrolled this far.
const HIDE_AFTER_SCROLL_PX = 120
// Ignore small scroll movements so the bar does not flicker around the threshold.
const MIN_DIRECTION_PX = 4

function isLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Header() {
  const pathname = usePathname() ?? '/'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuPresented, setMobileMenuPresented] = useState(false)
  const [scrolledAway, setScrolledAway] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuSheetRef = useRef<HTMLDivElement>(null)
  const mobileMenuOpenRef = useRef(mobileMenuOpen)
  const { totalCount, isCartOpen, openCart, closeCart } = useCart()

  mobileMenuOpenRef.current = mobileMenuOpen

  // The bar never hides while the menu or the bag is open.
  const headerHidden = scrolledAway && !mobileMenuOpen && !isCartOpen

  useInertBackground('mobile-navigation', mobileMenuPresented)

  useEffect(() => {
    if (mobileMenuOpen) setMobileMenuPresented(true)
  }, [mobileMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Hide on scroll down, return on scroll up. Reduced motion keeps the bar visible.
  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      frame = 0
      const y = window.scrollY
      const delta = y - lastY
      lastY = y

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      const focusInside = headerRef.current?.contains(document.activeElement) ?? false
      if (reduceMotion || focusInside || y < HIDE_AFTER_SCROLL_PX) {
        setScrolledAway(false)
        return
      }
      if (Math.abs(delta) < MIN_DIRECTION_PX) return
      setScrolledAway(delta > 0)
    }

    const handleScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!mobileMenuPresented) return

    const originalOverflow = document.body.style.overflow
    const menuTrigger = menuButtonRef.current
    document.body.style.overflow = 'hidden'

    const getFocusableElements = () => {
      if (!menuSheetRef.current) return []
      return Array.from(
        menuSheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
    }

    const focusFirstItem = () => {
      getFocusableElements()[0]?.focus()
    }

    const animationFrame = window.requestAnimationFrame(focusFirstItem)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileMenuOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === firstElement || !menuSheetRef.current?.contains(activeElement))) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && (activeElement === lastElement || !menuSheetRef.current?.contains(activeElement))) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
      menuTrigger?.focus()
    }
  }, [mobileMenuPresented])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const renderNavigationLinks = (className: string, linkClassName: string) => (
    <nav aria-label="Main navigation" className={className}>
      {navigationLinks.map((link) => {
        const active = isLinkActive(pathname, link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={closeMobileMenu}
            aria-current={active ? 'page' : undefined}
            className={`link-draw transition-colors duration-[180ms] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] ${linkClassName} ${
              active ? 'text-[var(--ink)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      <header
        ref={headerRef}
        style={{ transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)' }}
        className={`fixed inset-x-0 top-0 z-40 h-[var(--header-h)] bg-[var(--paper)] text-[var(--ink)] transition-[transform,visibility] duration-300 ease-[var(--ease-out)] ${
          headerHidden ? 'invisible' : 'visible'
        }`}
      >
        <div className="mx-auto flex h-full w-full items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <Link
            href="/"
            aria-label="Darpan home"
            className="font-display text-[24px] leading-none text-[var(--ink)] transition-colors duration-[180ms] hover:text-[var(--ink-2)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
          >
            Darpan
          </Link>

          {renderNavigationLinks('hidden min-[900px]:flex items-center gap-8 whitespace-nowrap text-[15px]', '')}

          <div className="flex shrink-0 items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={openCart}
              aria-label={`Bag, ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`}
              className="link-draw min-h-11 whitespace-nowrap text-[15px] text-[var(--ink-2)] transition-colors duration-[180ms] ease-[var(--ease-out)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
            >
              Bag (<span className="tabular-nums">{totalCount}</span>)
            </button>

            <Link
              href={TRY_ON_HREF}
              data-press
              className="inline-flex min-h-11 items-center whitespace-nowrap bg-[var(--ink)] px-4 text-[15px] text-[var(--paper)] transition-colors duration-[180ms] ease-[var(--ease-out)] hover:bg-[var(--ink-2)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
            >
              Try it on
            </Link>

            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-sheet"
              className="link-draw min-h-11 text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] min-[900px]:hidden"
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence
        onExitComplete={() => {
          if (!mobileMenuOpenRef.current) setMobileMenuPresented(false)
        }}
      >
        {mobileMenuOpen && (
          <motion.div
            id="mobile-navigation-sheet"
            ref={menuSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            aria-hidden={!mobileMenuOpen}
            inert={!mobileMenuOpen}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              duration: mobileMenuOpen ? motionTiming.menu : motionTiming.control,
              ease: mobileMenuOpen ? motionEase.enter : motionEase.exit,
            }}
            className="fixed inset-0 z-50 flex min-h-[100svh] flex-col bg-[var(--paper)] px-5 pb-8 pt-5 text-[var(--ink)] sm:px-8"
          >
            <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="font-display text-[24px] leading-none text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
              >
                Darpan
              </Link>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="link-draw min-h-11 text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]"
              >
                Close
              </button>
            </div>

            {renderNavigationLinks('flex flex-col items-start gap-6 pt-12', 'font-display text-[32px] leading-none')}
          </motion.div>
        )}
      </AnimatePresence>

      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
    </>
  )
}
