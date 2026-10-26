'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionEase, motionTiming } from '@/lib/motion-tokens'

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
  const prefersReducedMotion = useReducedMotion()

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
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{
                duration: prefersReducedMotion ? motionTiming.feedback : motionTiming.control,
                ease: prefersReducedMotion ? motionEase.standard : motionEase.enter,
              }}
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
  const prefersReducedMotion = useReducedMotion()

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
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{
              duration: prefersReducedMotion ? motionTiming.feedback : motionTiming.control,
              ease: prefersReducedMotion ? motionEase.standard : motionEase.enter,
            }}
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
