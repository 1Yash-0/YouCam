'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

declare global {
  interface Window {
    __lenis?: Lenis
  }
}

/**
 * Smooth wheel scrolling with Lenis, stepped by the GSAP ticker so Lenis and
 * ScrollTrigger share one clock. Reduced-motion and touch (coarse pointer)
 * visitors keep native scrolling.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    gsap.registerPlugin(ScrollTrigger)
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true })
    lenis.on('scroll', () => ScrollTrigger.update())

    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    window.__lenis = lenis

    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33) // GSAP's default thresholds
      lenis.destroy()
      delete window.__lenis
    }
  }, [])

  return <>{children}</>
}

/** Scrolls to a page offset: eased Lenis scroll when active, native smooth scroll otherwise. */
export function scrollToY(y: number) {
  const lenis = window.__lenis
  if (lenis) {
    lenis.scrollTo(y, { duration: 1.1, easing: (t: number) => 1 - (1 - t) ** 4 })
    return
  }
  window.scrollTo({ top: y, behavior: 'smooth' })
}
