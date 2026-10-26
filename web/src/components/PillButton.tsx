'use client'

import React from 'react'
import Link from 'next/link'

export interface PillButtonProps {
  children: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  href?: string
  variant?: 'primary' | 'secondary' | 'gold'
  className?: string
  ariaLabel?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

export function PillButton({ children, onClick, href, variant = 'primary', className = '', ariaLabel, type = 'button', disabled = false }: PillButtonProps) {
  const classes = `pill-control pill-${variant} ui-label focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] ${className}`
  if (href && !disabled) return <Link href={href} onClick={onClick} aria-label={ariaLabel} className={classes}>{children}</Link>
  return <button type={type} disabled={disabled} onClick={onClick} aria-label={ariaLabel} className={classes}>{children}</button>
}
