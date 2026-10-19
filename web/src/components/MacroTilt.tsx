'use client'

import React, { useState, useEffect, useRef, ReactNode, MouseEvent } from 'react'

export interface MacroTiltProps {
  children: ReactNode
  className?: string
  maxTiltDeg?: number
}

export function MacroTilt({
  children,
  className = '',
  maxTiltDeg = 6,
}: MacroTiltProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [spotlight, setSpotlight] = useState<{ x: number; y: number }>({ x: 50, y: 50 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFinePointer, setIsFinePointer] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(rmQuery.matches)
    const handleRm = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    rmQuery.addEventListener('change', handleRm)

    const ptrQuery = window.matchMedia('(pointer: fine)')
    setIsFinePointer(ptrQuery.matches)
    const handlePtr = (e: MediaQueryListEvent) => setIsFinePointer(e.matches)
    ptrQuery.addEventListener('change', handlePtr)

    return () => {
      rmQuery.removeEventListener('change', handleRm)
      ptrQuery.removeEventListener('change', handlePtr)
    }
  }, [])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !isFinePointer || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    // Tilt: pointer at top tilts up (positive rotateX), right tilts right (positive rotateY)
    const rotX = (0.5 - py) * (maxTiltDeg * 2)
    const rotY = (px - 0.5) * (maxTiltDeg * 2)
    setTilt({ x: rotX, y: rotY })
    setSpotlight({ x: px * 100, y: py * 100 })
  }

  const handleMouseEnter = () => {
    if (!prefersReducedMotion && isFinePointer) {
      setIsHovered(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
    setSpotlight({ x: 50, y: 50 })
  }

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
      style={{
        perspective: '900px',
      }}
    >
      <div
        className="w-full h-full transition-transform duration-180 ease-out"
        style={{
          transform: isHovered
            ? `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`
            : 'rotateX(0deg) rotateY(0deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {children}

        {/* Cursor spotlight on metal */}
        <div
          aria-hidden="true"
          className={`
            pointer-events-none absolute inset-0 z-20 rounded-inherit
            transition-opacity duration-300
            ${isHovered ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            background: `radial-gradient(circle at ${spotlight.x}% ${spotlight.y}%, rgba(255,255,255,0.22) 0%, transparent 60%)`,
            mixBlendMode: 'soft-light',
          }}
        />
      </div>
    </div>
  )
}
