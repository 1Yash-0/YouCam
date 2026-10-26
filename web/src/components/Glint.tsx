'use client'

import React, { ReactNode } from 'react'

export interface GlintProps {
  children?: ReactNode
  maskUrl?: string
  className?: string
  trigger?: boolean
  triggerOnHover?: boolean
  angleDeg?: number
  durationMs?: number
}

/**
 * Compatibility wrapper for legacy callers. Public surfaces no longer render
 * a shimmer layer; the image remains a plain, stable stage.
 */
export function Glint({ children, className = '' }: GlintProps) {
  return <div className={`relative inline-block ${className}`}>{children}</div>
}
