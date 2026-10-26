'use client'

import React, { type HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

/** A quiet loading surface for content that has not arrived yet. */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton bg-[var(--line)] ${className}`}
      {...props}
    />
  )
}
