'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { PillButton } from '@/components/PillButton'
import { useCart } from '@/hooks/useCart'
import { useInertBackground } from '@/hooks/useInertBackground'
import { CartDrawerProps } from './types'

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, totalCount, subtotalInr, updateQuantity, removeItem, clearCart } = useCart()

  // Manage inert state on background DOM when cart is open
  useInertBackground('cart-drawer', isOpen)

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Slide-over Bag Sheet */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Bag"
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[560px] bg-[var(--paper)] flex flex-col shadow-2xl border-l border-[var(--line)]"
          >
            {/* Header */}
            <header className="px-6 py-4 border-b border-[var(--line)] bg-[var(--paper)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="ui-label text-xs tracking-wider text-[var(--gold)]">
                  YOUR BAG
                </span>
                <span className="ui-label text-xs text-[var(--ink-2)] tabular-nums">
                  ({totalCount} {totalCount === 1 ? 'ITEM' : 'ITEMS'})
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close bag"
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
                  <p className="text-xs text-[var(--ink-2)] max-w-xs mb-6">
                    Try on jewellery at true physical scale and add your customized looks directly to your bag.
                  </p>
                  <PillButton variant="primary" onClick={onClose} className="!py-2.5 text-xs">
                    EXPLORE COLLECTION
                  </PillButton>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-white border border-[var(--line)] shadow-xs flex flex-col gap-3"
                  >
                    <div className="flex gap-4">
                      {/* Product Thumbnail */}
                      <div className="relative w-18 h-18 rounded-lg overflow-hidden bg-[var(--paper)] border border-[var(--line)] shrink-0">
                        <Image
                          src={item.productImageUrl}
                          alt={item.title}
                          fill
                          sizes="72px"
                          className="object-contain p-2"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <span className="ui-label text-[10px] text-[var(--gold)] block">
                          {item.brand}
                        </span>
                        <h4 className="text-sm font-medium text-[var(--ink)] truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="ui-label text-[10px] bg-[var(--paper)] px-2 py-0.5 rounded-full border border-[var(--line)] text-[var(--ink)]">
                            {item.sizeCm.toFixed(1)} CM
                          </span>
                          <span className="text-xs font-semibold text-[var(--ink)] tabular-nums">
                            ₹{item.priceInr.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.title} from bag`}
                        className="text-[var(--ink-2)] hover:text-[var(--warn)] p-1 shrink-0 self-start"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Dual Thumbnail: Customer's Try-On Thumbnail */}
                    {item.tryOnThumbnailUrl && (
                      <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--paper)] border border-[var(--line)]/70">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[var(--gold)] shrink-0">
                          <Image
                            src={item.tryOnThumbnailUrl}
                            alt="Your try-on preview"
                            fill
                            sizes="32px"
                            className="object-cover"
                          />
                        </div>
                        <span className="ui-label text-[10px] text-[var(--ok)] flex items-center gap-1">
                          <span>✓</span>
                          <span>TRIED ON YOU AT {(item.triedOnAtCm || item.sizeCm).toFixed(1)} CM</span>
                        </span>
                      </div>
                    )}

                    {/* Quantity Stepper & Row Total */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]/60">
                      <div className="flex items-center gap-2 border border-[var(--line)] rounded-full px-2 py-0.5 bg-white">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-2)] hover:text-[var(--ink)]"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold tabular-nums px-1.5">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="w-5 h-5 flex items-center justify-center text-xs text-[var(--ink-2)] hover:text-[var(--ink)]"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-xs font-bold text-[var(--ink)] tabular-nums">
                        ₹{(item.priceInr * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer / Checkout */}
            {items.length > 0 && (
              <footer className="p-6 bg-white border-t border-[var(--line)] flex flex-col gap-4">
                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="ui-label text-xs text-[var(--ink-2)]">SUBTOTAL</span>
                  <span className="text-xl font-medium text-[var(--ink)] tabular-nums">
                    ₹{subtotalInr.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Editorial Assurances */}
                <div className="flex flex-col gap-1.5 text-[11px] text-[var(--ink-2)]">
                  <p className="flex items-center gap-1.5 text-[var(--ok)]">
                    <span>✓</span>
                    <span>Complimentary express insured delivery across India.</span>
                  </p>
                  <p className="leading-relaxed">
                    Free size exchange within 14 days if the physical scale does not feel right in person.
                  </p>
                </div>

                {/* Demo Notice */}
                <div className="p-2.5 rounded-lg bg-[var(--paper)] text-[10px] text-[var(--ink-2)] text-center">
                  Editorial demonstration mode. No live payment will be processed.
                </div>

                {/* Checkout Button */}
                <PillButton
                  variant="primary"
                  onClick={() => {
                    alert('Order submitted in demo mode! Thank you for experiencing Darpan.')
                    clearCart()
                    onClose()
                  }}
                  className="w-full justify-center !py-3 text-xs"
                >
                  PROCEED TO CHECKOUT · ₹{subtotalInr.toLocaleString('en-IN')}
                </PillButton>
              </footer>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
