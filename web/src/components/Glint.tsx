'use client'

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react'

export interface GlintProps {
  children?: ReactNode
  maskUrl?: string
  className?: string
  trigger?: boolean
  triggerOnHover?: boolean
  angleDeg?: number
  durationMs?: number
}

export function Glint({
  children,
  maskUrl,
  className = '',
  trigger,
  triggerOnHover = true,
  angleDeg,
  durationMs,
}: GlintProps) {
  const [active, setActive] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const lastRunRef = useRef<number>(0)
  const elementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const triggerGlint = useCallback(() => {
    if (prefersReducedMotion) return
    const now = Date.now()
    if (now - lastRunRef.current < 6000) return // Max once per 6s
    lastRunRef.current = now
    setActive(true)
    setTimeout(() => setActive(false), durationMs)
  }, [prefersReducedMotion, durationMs])

  // Trigger on external prop change
  useEffect(() => {
    if (trigger) {
      triggerGlint()
    }
  }, [trigger, triggerGlint])

  // Trigger once when entering viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !elementRef.current || prefersReducedMotion) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          triggerGlint()
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(elementRef.current)
    return () => observer.disconnect()
  }, [prefersReducedMotion, triggerGlint])

  const maskStyle = maskUrl
    ? {
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }
    : undefined

  return (
    <div
      ref={elementRef}
      onMouseEnter={triggerOnHover ? triggerGlint : undefined}
      onFocus={triggerGlint}
      className={`relative inline-block overflow-hidden ${className}`}
    >
      {children}

      {/* Glint Sweep Layer */}
      {!prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20"
          style={maskStyle}
        >
          <div
            className={`
              absolute inset-0 w-[200%] -left-[50%] h-full pointer-events-none
              transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]
              ${active ? 'translate-x-[120%]' : '-translate-x-[120%]'}
            `}
            style={{
              background: `linear-gradient(${angleDeg ?? 105}deg, transparent 40%, rgba(255,246,220,0.55) 50%, transparent 60%)`,
              mixBlendMode: 'soft-light',
            }}
          />
        </div>
      )}

      {/* Static soft highlight for reduced motion */}
      {prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 opacity-30"
          style={{
            ...maskStyle,
            background:
              'linear-gradient(105deg, transparent 55%, rgba(255,246,220,0.4) 60%, transparent 65%)',
            mixBlendMode: 'soft-light',
          }}
        />
      )}
    </div>
  )
}
