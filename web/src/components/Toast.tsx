'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export interface ToastOptions {
  message: string
  durationMs?: number
  variant?: 'default' | 'gold' | 'ok' | 'warn'
}

interface ToastContextValue {
  showToast: (options: string | ToastOptions) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  const showToast = useCallback((options: string | ToastOptions) => {
    const opts: ToastOptions = typeof options === 'string' ? { message: options } : options
    setToast(opts)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      hideToast()
    }, toast.durationMs ?? 3000)

    return () => clearTimeout(timer)
  }, [toast, hideToast])

  const variantStyles = {
    default: 'bg-[var(--ink)] text-white border-[var(--line)]',
    gold: 'bg-[var(--gold)] text-white border-transparent',
    ok: 'bg-[var(--ok)] text-white border-transparent',
    warn: 'bg-[var(--warn)] text-white border-transparent',
  }[toast?.variant ?? 'default']

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center w-full px-4"
        aria-live="polite"
        role="status"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
              }
              className={`
                pointer-events-auto
                px-5 py-3 rounded-full shadow-lg border
                ui-label text-center max-w-md
                ${variantStyles}
              `}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Standalone Toast display for explicit controlled rendering
 */
export function Toast({
  message,
  visible = true,
  onClose,
  variant = 'default',
}: {
  message: string
  visible?: boolean
  onClose?: () => void
  variant?: 'default' | 'gold' | 'ok' | 'warn'
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const variantStyles = {
    default: 'bg-[var(--ink)] text-white border-[var(--line)]',
    gold: 'bg-[var(--gold)] text-white border-transparent',
    ok: 'bg-[var(--ok)] text-white border-transparent',
    warn: 'bg-[var(--warn)] text-white border-transparent',
  }[variant]

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center w-full px-4"
      aria-live="polite"
      role="status"
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
            }
            onClick={onClose}
            className={`
              pointer-events-auto cursor-pointer
              px-5 py-3 rounded-full shadow-lg border
              ui-label text-center max-w-md
              ${variantStyles}
            `}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
