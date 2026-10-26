import React, { type ReactNode } from 'react'

export interface MacroTiltProps { children: ReactNode; className?: string; maxTiltDeg?: number }

/** Kept for existing callers; product photography is deliberately flat. */
export function MacroTilt({ children, className = '' }: MacroTiltProps) {
  return <div className={className}>{children}</div>
}
