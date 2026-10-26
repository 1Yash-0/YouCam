'use client'

import { useEffect, useState, RefObject } from 'react'

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
    const handleScroll = () => calculate()
    const handleResize = () => {
      calculate()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [targetRef])

  return progress
}

useScrollProgress.remap = remap
useScrollProgress.easeOutCubic = easeOutCubic
