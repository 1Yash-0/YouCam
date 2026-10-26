'use client'
import { useEffect } from 'react'

export interface PreloaderProps {
  onDismiss?: () => void
  forceShow?: boolean
}

export const PRELOADER_SESSION_KEY = 'darpan_preloader_seen'

/** The first screen is usable immediately; retain the old component contract for callers. */
export function Preloader({ onDismiss }: PreloaderProps) {
  useEffect(() => onDismiss?.(), [onDismiss])
  return null
}
