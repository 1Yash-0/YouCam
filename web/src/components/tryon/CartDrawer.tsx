'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import React, { useEffect, useRef, useState } from 'react'
import { PillButton } from '@/components/PillButton'
import { useCart } from '@/hooks/useCart'
import { useInertBackground } from '@/hooks/useInertBackground'
import { CartDrawerProps } from './types'
import { motionEase, motionTiming } from '@/lib/motion-tokens'

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, totalCount, removeItem } = useCart()
  const dialogRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [isPresented, setIsPresented] = useState(isOpen)

  useEffect(() => {
    if (isOpen) setIsPresented(true)
  }, [isOpen])

  // Manage inert state on background DOM when cart is open
  useInertBackground('cart-drawer', isPresented)

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isPresented) return

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const getFocusableElements = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')

    const focusFrame = window.requestAnimationFrame(() => (getFocusableElements()[0] ?? dialogRef.current)?.focus())

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab') return
      const focusable = getFocusableElements()
      if (focusable.length === 0) {
        e.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown, true)
      window.cancelAnimationFrame(focusFrame)
      opener?.focus()
    }
  }, [isPresented, onClose])

  return (
    <AnimatePresence onExitComplete={() => setIsPresented(false)}>
      {isOpen && (
        <>
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTiming.drawer, ease: motionEase.standard }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40"
            aria-hidden="true"
          />

          {/* Slide-over Bag Sheet */}
          <motion.div
            ref={dialogRef}
            initial={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
            animate={{ x: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
            transition={{
              duration: prefersReducedMotion
                ? motionTiming.feedback
                : isOpen ? motionTiming.drawer : motionTiming.control,
              ease: prefersReducedMotion
                ? motionEase.standard
                : isOpen ? motionEase.enter : motionEase.exit,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Bag"
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-50 flex max-h-dvh w-full max-w-[560px] flex-col border-l border-[var(--line)] bg-[var(--paper)] shadow-2xl"
          >
            {/* Header */}
            <header className="px-6 py-4 border-b border-[var(--line)] bg-[var(--paper)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="ui-label text-[14px] tracking-wider text-[var(--gold)]">
                  Bag
                </span>
                <span className="ui-label text-[14px] text-[var(--ink-2)] tabular-nums">
                  ({totalCount} {totalCount === 1 ? 'item' : 'items'})
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close saved choices"
                className="w-9 h-9 rounded-full border border-[var(--line)] flex items-center justify-center text-[var(--ink)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[var(--ink-2)]">
                  <div className="w-16 h-16 rounded-full bg-white border border-[var(--line)] flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-[var(--line)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-medium text-[var(--ink)] mb-1">Your bag is empty</h4>
                  <p className="text-base text-[var(--ink-2)] max-w-xs mb-6">
                    Save a product and its selected size here. Your try-on photo is not saved with it.
                  </p>
                  <PillButton variant="primary" onClick={onClose} className="!py-2.5 text-[14px]">
                    Explore the collection
                  </PillButton>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 border-b border-[var(--line)] bg-white p-4"
                  >
                    <div className="flex gap-4">
                      {/* Product Thumbnail */}
                      <div className="relative w-18 h-18 rounded-lg overflow-hidden bg-[var(--paper)] border border-[var(--line)] shrink-0">
                        <Image
                          src={item.productImageUrl}
                          alt={item.title}
                          fill
                          sizes="72px"
                          className="object-contain p-2 bg-[var(--paper)]"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <span className="ui-label text-[14px] text-[var(--gold)] block">
                          {item.brand}
                        </span>
                        <h4 className="text-sm font-medium text-[var(--ink)] truncate">
                          <Link href={`/p/${item.productId}`} onClick={onClose} className="underline underline-offset-4">{item.title}</Link>
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-[var(--ink-2)]">
                            {item.sizeLabel || (item.sizeCm !== undefined ? `${item.sizeCm.toFixed(1)} cm` : 'Selected size')}
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.title} from saved choices`}
                        className="text-[var(--ink-2)] hover:text-[var(--warn)] p-1 shrink-0 self-start"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>
            {items.length > 0 && <div className="border-t border-[var(--line)] p-6 text-sm text-[var(--ink-2)]"><p>Your selected pieces and dimensions stay in this browser. Photos are kept separately and expire.</p><Link href="/for-retailers" onClick={onClose} className="underline underline-offset-4 mt-3 block">See the retailer handoff demo</Link></div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
