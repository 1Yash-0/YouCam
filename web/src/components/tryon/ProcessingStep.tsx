'use client'

import React from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { ProcessingStepProps } from './types'

export function ProcessingStep({
  steps,
  currentStepIndex,
  totalSteps,
  progress,
  currentCopy,
  userPhotoUrl,
}: ProcessingStepProps) {
  // Step mapping for luxury editorial titles
  const stepLabels: Record<string, string> = {
    cloth: 'OUTFIT SILHOUETTE',
    hair: 'HAIR COIFFURE',
    makeup: 'LIPSTICK LUSTER',
    earring: 'PHYSICAL EARRING SCALE',
    stack: 'SECONDARY STUD STACK',
    necklace: 'NECKLACE COLLAR',
  }

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden relative bg-[var(--paper)]">
      {/* Background Dimmed Photo Container */}
      <div className="relative w-full aspect-[4/5] bg-black/5 overflow-hidden flex items-center justify-center">
        {userPhotoUrl && (
          <div className="absolute inset-0 opacity-20 filter blur-[1px]">
            <Image
              src={userPhotoUrl}
              alt="Portrait processing"
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Luxury Light Sweep Overlay */}
        <style>{`
          @keyframes lightSweep {
            0% { transform: translateX(-150%) skewX(-20deg); }
            100% { transform: translateX(250%) skewX(-20deg); }
          }
        `}</style>
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          <div
            className="w-[200%] h-full absolute -left-[50%]"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(176, 138, 62, 0.08) 40%, rgba(255, 255, 255, 0.28) 50%, rgba(176, 138, 62, 0.08) 60%, transparent 100%)',
              animation: 'lightSweep 2.4s infinite cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>

        {/* Center Loading Ring & Copy */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
          {/* Animated Gold Ring */}
          <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[var(--gold)]/20" />
            <div
              className="absolute inset-0 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin"
              style={{ animationDuration: '1.2s' }}
            />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] animate-pulse" />
          </div>

          <span className="ui-label text-[10px] text-[var(--gold)] tracking-widest block mb-2">
            ATELIER CALIBRATION
          </span>

          {/* Rotating copy with fade animation */}
          <div className="h-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentCopy}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="text-xs text-[var(--ink)] leading-relaxed font-normal"
              >
                {currentCopy}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* 1px Progress Hairline at bottom of canvas */}
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[var(--line)]">
          <div
            className="h-full bg-[var(--gold)] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      </div>

      {/* Step Sequence Checklist */}
      <div className="p-6 bg-white border-t border-[var(--line)] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="ui-label text-[10px] text-[var(--ink-2)]">EXECUTION SEQUENCE</span>
          <span className="ui-label text-[10px] text-[var(--gold)] tabular-nums">
            STEP {Math.min(currentStepIndex + 1, totalSteps)} OF {totalSteps}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {steps.map((st, idx) => {
            const isCompleted = idx < currentStepIndex
            const isActive = idx === currentStepIndex

            return (
              <div
                key={st}
                className="flex items-center justify-between text-xs py-1"
              >
                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                    ) : isActive ? (
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-3.5 h-3.5 rounded-full bg-[var(--gold)]/30 animate-ping" />
                        <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                      </div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-[var(--line)]" />
                    )}
                  </div>

                  {/* Step Name */}
                  <span
                    className={`ui-label text-[11px] ${
                      isActive
                        ? 'text-[var(--ink)] font-bold'
                        : isCompleted
                        ? 'text-[var(--ink-2)] line-through opacity-70'
                        : 'text-[var(--ink-2)] opacity-50'
                    }`}
                  >
                    {stepLabels[st] || st.toUpperCase()}
                  </span>
                </div>

                <span className="ui-label text-[10px] text-[var(--ink-2)]">
                  {isCompleted ? 'COMPLETE' : isActive ? 'RENDERING…' : 'PENDING'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Screen Reader Announcement */}
      <div aria-live="polite" className="sr-only">
        {currentCopy}. Step {currentStepIndex + 1} of {totalSteps}: {stepLabels[steps[currentStepIndex]] || steps[currentStepIndex]}.
      </div>
    </div>
  )
}
