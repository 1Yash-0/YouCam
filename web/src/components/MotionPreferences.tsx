'use client'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { motionEase, motionTiming } from '@/lib/motion-tokens'
export function MotionPreferences({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: motionTiming.control, ease: motionEase.enter }}
    >
      {children}
    </MotionConfig>
  )
}
