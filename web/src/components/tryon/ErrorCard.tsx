'use client'

import React from 'react'
import Image from 'next/image'
import { PillButton } from '@/components/PillButton'
import { ErrorCardProps } from './types'

export function ErrorCard({
  error,
  photoUrl,
  onUseSampleFace,
  onRetry,
  onReupload,
  onSwitchEar,
}: ErrorCardProps) {
  const isEarIssue = error.code === 'EAR_NOT_VISIBLE'
  const isNeckIssue = error.code === 'NECK_NOT_VISIBLE'
  const isBudgetIssue = error.code === 'BUDGET_RESERVED'

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden relative bg-[var(--paper)]">
      {/* Visual Canvas Stage with Anatomical Guidance Markers */}
      <div className="relative w-full aspect-[4/5] bg-black/10 overflow-hidden flex items-center justify-center">
        {photoUrl && (
          <div className="absolute inset-0 opacity-25 filter grayscale">
            <Image
              src={photoUrl}
              alt="Portrait for try-on"
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Anatomical Overlays */}
        {isEarIssue && (
          <div className="absolute top-[38%] right-[28%] pointer-events-none">
            <div className="w-16 h-24 rounded-full border-2 border-dashed border-[var(--gold)] animate-pulse flex items-center justify-center">
              <span className="ui-label text-[9px] bg-[var(--ink)] text-[var(--gold)] px-2 py-0.5 rounded-full shadow-md">
                EAR
              </span>
            </div>
          </div>
        )}

        {isNeckIssue && (
          <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="w-48 h-8 rounded-full border-2 border-dashed border-[var(--gold)] animate-pulse flex items-center justify-center">
              <span className="ui-label text-[9px] bg-[var(--ink)] text-[var(--gold)] px-2 py-0.5 rounded-full shadow-md">
                COLLARBONE
              </span>
            </div>
          </div>
        )}

        {/* Center Alert Icon */}
        <div className="relative z-10 w-16 h-16 rounded-full bg-white/90 backdrop-blur-xs border border-[var(--warn)]/40 flex items-center justify-center text-[var(--warn)] shadow-lg">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      </div>

      {/* Recovery Guidance & Actions */}
      <div className="p-6 bg-white border-t border-[var(--line)] flex flex-col gap-5">
        <div>
          <span className="ui-label text-[10px] text-[var(--warn)] tracking-wider block mb-1">
            CALIBRATION ADVICE
          </span>
          <h4 className="text-lg font-serif-italic text-[var(--ink)]">
            {isEarIssue
              ? 'Tuck hair behind your ear'
              : isBudgetIssue
              ? 'Demo budget preserved'
              : 'Try-on needs adjustment'}
          </h4>
          <p className="text-xs text-[var(--ink-2)] mt-1.5 leading-relaxed">
            {error.userMessage}
          </p>
        </div>

        {/* Primary Recovery Button Actions */}
        <div className="flex flex-col gap-2.5">
          {isBudgetIssue ? (
            <PillButton
              variant="gold"
              onClick={onUseSampleFace}
              className="w-full justify-center !py-3 text-xs"
            >
              USE PRE-CALIBRATED SAMPLE FACE (0 UNITS)
            </PillButton>
          ) : isEarIssue ? (
            <>
              <PillButton
                variant="gold"
                onClick={onSwitchEar}
                className="w-full justify-center !py-3 text-xs"
              >
                SWITCH TO OTHER EAR
              </PillButton>
              <PillButton
                variant="secondary"
                onClick={onReupload}
                className="w-full justify-center !py-2.5 text-xs"
              >
                UPLOAD NEW PHOTO
              </PillButton>
            </>
          ) : (
            <>
              <PillButton
                variant="primary"
                onClick={onRetry}
                className="w-full justify-center !py-3 text-xs"
              >
                TRY AGAIN
              </PillButton>
              <PillButton
                variant="secondary"
                onClick={onUseSampleFace}
                className="w-full justify-center !py-2.5 text-xs"
              >
                USE SAMPLE FACE INSTEAD
              </PillButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
