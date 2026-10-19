'use client'

import React, { useRef, useState, useEffect, MouseEvent } from 'react'
import Link from 'next/link'

export interface PillButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLElement>) => void
  href?: string
  variant?: 'primary' | 'secondary' | 'gold'
  className?: string
  ariaLabel?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

export function PillButton({
  children,
  onClick,
  href,
  variant = 'primary',
  className = '',
  ariaLabel,
  type = 'button',
  disabled = false,
}: PillButtonProps) {
  const containerRef = useRef<HTMLElement | null>(null)
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [magneticOffset, setMagneticOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isFinePointer, setIsFinePointer] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(rmQuery.matches)

    const handleRmChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    rmQuery.addEventListener('change', handleRmChange)

    const ptrQuery = window.matchMedia('(pointer: fine)')
    setIsFinePointer(ptrQuery.matches)
    const handlePtrChange = (e: MediaQueryListEvent) => setIsFinePointer(e.matches)
    ptrQuery.addEventListener('change', handlePtrChange)

    return () => {
      rmQuery.removeEventListener('change', handleRmChange)
      ptrQuery.removeEventListener('change', handlePtrChange)
    }
  }, [])

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (disabled || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCoords({ x, y })

    if (isFinePointer && !prefersReducedMotion) {
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const deltaX = (e.clientX - centerX) / (rect.width / 2)
      const deltaY = (e.clientY - centerY) / (rect.height / 2)
      const pullX = Math.max(-6, Math.min(6, deltaX * 6))
      const pullY = Math.max(-6, Math.min(6, deltaY * 6))
      setMagneticOffset({ x: pullX, y: pullY })
    }
  }

  const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
    if (disabled) return
    setIsHovered(true)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setIsPressed(false)
    setMagneticOffset({ x: 0, y: 0 })
  }

  const handleMouseDown = () => {
    if (!disabled) setIsPressed(true)
  }

  const handleMouseUp = () => {
    setIsPressed(false)
  }

  // Styles
  const transformStyle = prefersReducedMotion
    ? undefined
    : `translate3d(${magneticOffset.x}px, ${magneticOffset.y}px, 0) scale(${isPressed ? 0.98 : 1})`

  const transitionStyle = prefersReducedMotion
    ? 'background-color 180ms ease, opacity 180ms ease'
    : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'

  const fillClipPath = prefersReducedMotion
    ? undefined
    : isHovered
      ? `circle(150% at ${coords.x}px ${coords.y}px)`
      : `circle(0% at ${coords.x}px ${coords.y}px)`

  const baseClasses = `
    relative inline-flex items-center justify-center select-none isolate
    px-5 py-2.5 rounded-full overflow-hidden text-center
    ui-label cursor-pointer
    focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px]
    disabled:opacity-40 disabled:cursor-not-allowed
    border border-[var(--line)]
  `

  const bgTheme =
    variant === 'gold'
      ? 'bg-[var(--gold)] text-white border-transparent'
      : variant === 'secondary'
        ? 'bg-transparent text-[var(--ink)]'
        : 'bg-[var(--ink)] text-white'

  const hoverFillBg =
    variant === 'gold'
      ? 'bg-[var(--ink)]'
      : variant === 'secondary'
        ? 'bg-[var(--paper)]'
        : 'bg-white'

  const content = (
    <>
      {/* Dynamic expanding fill on hover */}
      {!prefersReducedMotion && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none transition-[clip-path] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${hoverFillBg}`}
          style={{ clipPath: fillClipPath }}
        />
      )}
      {/* Label with difference blend */}
      <span
        className={`relative z-10 transition-colors duration-180 ${
          prefersReducedMotion && isHovered && variant === 'primary' ? 'text-black' : ''
        }`}
        style={{
          mixBlendMode: !prefersReducedMotion && variant === 'primary' ? 'difference' : 'normal',
          color: !prefersReducedMotion && variant === 'primary' ? '#ffffff' : undefined,
        }}
      >
        {children}
      </span>
    </>
  )

  const sharedProps = {
    ref: (el: HTMLElement | null) => {
      containerRef.current = el
    },
    onMouseMove: handleMouseMove,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    'aria-label': ariaLabel,
    style: {
      transform: transformStyle,
      transition: transitionStyle,
    },
    className: `${baseClasses} ${bgTheme} ${className}`.trim(),
  }

  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick as any} {...sharedProps}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...sharedProps}
    >
      {content}
    </button>
  )
}
