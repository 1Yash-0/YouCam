'use client'

import { useEffect, useState, RefObject } from 'react'
import Lenis from 'lenis'

/**
 * Maps a value p from range [inMin, inMax] to [outMin, outMax], clamped.
 * Defaults to normalizing to [0, 1].
 */
export function remap(
  p: number,
  inMin: number,
  inMax: number,
  outMin: number = 0,
  outMax: number = 1
): number {
  if (inMax === inMin) return outMin
  const t = Math.min(Math.max((p - inMin) / (inMax - inMin), 0), 1)
  return outMin + t * (outMax - outMin)
}

/**
 * Standard cubic ease-out helper: 1 - (1 - t)^3 for t in [0, 1].
 */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1)
  return 1 - Math.pow(1 - clamped, 3)
}

type ScrollSubscriber = () => void

let lenisInstance: Lenis | null = null
let sharedRafId: number | null = null
const subscribers = new Set<ScrollSubscriber>()

function startSharedLoop() {
  if (sharedRafId !== null || typeof window === 'undefined') return

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!prefersReduced && !lenisInstance) {
    try {
      lenisInstance = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
      })
    } catch {
      // Fall back to native scrolling if Lenis fails to initialize
    }
  }

  const loop = (time: number) => {
    if (lenisInstance) {
      lenisInstance.raf(time)
    }
    subscribers.forEach((callback) => callback())

    if (subscribers.size > 0 || lenisInstance) {
      sharedRafId = requestAnimationFrame(loop)
    } else {
      sharedRafId = null
    }
  }

  sharedRafId = requestAnimationFrame(loop)
}

function stopSharedLoopIfEmpty() {
  if (subscribers.size === 0 && sharedRafId !== null) {
    cancelAnimationFrame(sharedRafId)
    sharedRafId = null
  }
}

/**
 * Shared scroll progress hook.
 * Returns progress p in range [0, 1] clamped.
 * If targetRef is provided, tracks that element's viewport intersection progress.
 * Otherwise tracks global page scroll progress.
 */
export function useScrollProgress(targetRef?: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const calculate = () => {
      let p = 0
      if (targetRef && targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect()
        const winH = window.innerHeight
        const total = rect.height + winH
        const current = winH - rect.top
        p = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0
      } else {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        p = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 0
      }
      setProgress(p)
    }

    calculate()
    subscribers.add(calculate)
    startSharedLoop()

    const handleScroll = () => {
      if (!lenisInstance) {
        calculate()
      }
    }
    const handleResize = () => {
      calculate()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      subscribers.delete(calculate)
      stopSharedLoopIfEmpty()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [targetRef])

  return progress
}

useScrollProgress.remap = remap
useScrollProgress.easeOutCubic = easeOutCubic
