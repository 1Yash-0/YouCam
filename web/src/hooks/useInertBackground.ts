'use client'

import { useEffect } from 'react'
import { setBackgroundInert } from '@/lib/focus-containment'

/**
 * Hook to apply background focus containment (inert attribute and page-under-drawer class)
 * to #page-root and <header> while the drawer is open.
 */
export function useInertBackground(drawerId: string, isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return

    setBackgroundInert(drawerId, true)

    return () => {
      setBackgroundInert(drawerId, false)
    }
  }, [drawerId, isOpen])
}
