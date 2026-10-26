'use client'

import React, { useState, useEffect, useRef, ReactNode } from 'react'

export interface BoxRevealImageProps {
  src: string
  alt: string
  aspectRatio?: string
  className?: string
}

export function BoxRevealImage({
  src,
  alt,
  aspectRatio = 'aspect-[4/5]',
  className = '',
}: BoxRevealImageProps) {
  const [revealed, setRevealed] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={`relative overflow-hidden ${aspectRatio} ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            revealed ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${aspectRatio} ${className}`}
    >
      <div
        className="w-full h-full transition-[clip-path] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          clipPath: revealed ? 'inset(0% 0% 0% 0%)' : 'inset(50% 0% 50% 0%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover bg-[var(--paper)] transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: revealed ? 'scale(1)' : 'scale(1.15)',
          }}
        />
      </div>
    </div>
  )
}

export interface BoxRevealHeadingProps {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  className?: string
  italicWord?: string
}

export function BoxRevealHeading({
  children,
  as: Component = 'h2',
  className = '',
}: BoxRevealHeadingProps) {
  const [revealed, setRevealed] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  if (prefersReducedMotion) {
    return (
      <Component
        ref={ref as any}
        className={`transition-opacity duration-200 ${revealed ? 'opacity-100' : 'opacity-0'} ${className}`}
      >
        {children}
      </Component>
    )
  }

  return (
    <div ref={ref} className="overflow-hidden">
      <Component
        className={`transition-transform duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          revealed ? 'translate-y-0' : 'translate-y-[110%]'
        } ${className}`}
      >
        {children}
      </Component>
    </div>
  )
}
