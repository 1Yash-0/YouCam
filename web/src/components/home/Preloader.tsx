'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'

export interface PreloaderProps {
  onDismiss?: () => void
  forceShow?: boolean
}

export const PRELOADER_SESSION_KEY = 'darpan_preloader_seen'

export function Preloader({ onDismiss, forceShow = false }: PreloaderProps) {
  const [visible, setVisible] = useState<boolean>(() => {
    if (forceShow) return true
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(PRELOADER_SESSION_KEY) !== '1'
    } catch {
      // In private browsing or restricted iframe mode, default to showing once
      return true
    }
  })

  const [phase, setPhase] = useState<'revealing' | 'morphed' | 'lifting' | 'done'>('revealing')
  const [progress, setProgress] = useState(0) // 0 to 1
  const skipButtonRef = useRef<HTMLButtonElement | null>(null)
  const dismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PRELOADER_SESSION_KEY, '1')
        document.body.style.pointerEvents = 'auto'
      }
    } catch {
      // Graceful fallback for restricted environments
    }
    setPhase('done')
    setVisible(false)
    if (onDismiss) onDismiss()
  }, [onDismiss])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check prefers-reduced-motion: collapse to 0ms immediately
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches || !visible) {
      dismiss()
      return
    }

    // Auto-focus skip button for accessibility
    skipButtonRef.current?.focus()

    const startTime = performance.now()
    const revealDuration = 900 // ms
    let animationFrameId: number

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      if (elapsed < revealDuration) {
        const t = elapsed / revealDuration
        // easeOutCubic: 1 - (1 - t)^3
        const eased = 1 - Math.pow(1 - t, 3)
        setProgress(eased)
        animationFrameId = requestAnimationFrame(step)
      } else {
        setProgress(1)
        setPhase('morphed')

        // Morph stage for 100ms, then lift at 1000ms
        const morphTimeout = setTimeout(() => {
          setPhase('lifting')
          // Lift sheet for 400ms -> total duration 1400ms
          const liftTimeout = setTimeout(() => {
            dismiss()
          }, 400)
          return () => clearTimeout(liftTimeout)
        }, 100)
        return () => clearTimeout(morphTimeout)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [visible, dismiss])

  if (!visible || phase === 'done') return null

  return (
    <aside
      aria-label="Site preloader"
      role="status"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--paper)] text-[var(--ink)] select-none transition-transform duration-400 ease-[cubic-bezier(0.55,0,1,0.45)] ${
        phase === 'lifting' ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* Accessible skip button */}
      <button
        ref={skipButtonRef}
        type="button"
        onClick={dismiss}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[var(--ink)] text-white text-xs ui-label rounded-full shadow-lg"
      >
        SKIP PRELOADER
      </button>

      <div className="relative flex flex-col items-center max-w-sm px-6">
        {/* Brand Wordmark & Reveal Mask */}
        <div className="relative py-4 px-2 overflow-hidden">
          {/* Base invisible text to establish stable layout */}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-[0.32em] text-transparent select-none">
            DARPAN
          </h1>

          {/* Masked revealed text */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
            }}
          >
            <span className="text-3xl sm:text-4xl font-bold tracking-[0.32em] text-[var(--ink)]">
              DARPAN
            </span>
          </div>

          {/* Vertical gold scanning hairline */}
          {phase === 'revealing' && (
            <div
              className="absolute top-0 bottom-0 w-[1px] bg-[var(--gold)] pointer-events-none"
              style={{
                left: `${progress * 100}%`,
                boxShadow: '0 0 8px rgba(176,138,62,0.4)',
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Studio attribution */}
        <span className="ui-label text-[10px] text-[var(--ink-2)] tracking-[0.2em] -mt-1 mb-6">
          Kaari Studio · True Size
        </span>

        {/* Horizontal scale cue line */}
        <div className="w-48 flex flex-col items-center">
          <div className="w-full h-[1px] bg-[var(--line)] relative overflow-hidden" style={{ height: '1px' }}>
            <div
              className="h-[1px] bg-[var(--gold)] transition-all duration-200 ease-out"
              style={{
                height: '1px',
                backgroundColor: 'var(--gold)',
                width: phase === 'revealing' ? '0%' : '100%',
              }}
              aria-hidden="true"
            />
          </div>

          <div
            className={`flex justify-between w-full mt-2 text-[9px] ui-label text-[var(--gold)] transition-opacity duration-200 ${
              phase !== 'revealing' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span>0.0 CM</span>
            <span>TRUE SIZE</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
