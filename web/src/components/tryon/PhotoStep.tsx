'use client'

import React, { useState, useRef } from 'react'
import { PillButton } from '@/components/PillButton'
import { PhotoStepProps } from './types'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function PhotoStep({
  onSelectSample,
  onUploadFile,
  isUploading,
  error,
}: PhotoStepProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const validateAndUpload = async (file: File) => {
    setValidationError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Please upload a JPG, PNG, or WebP portrait.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError('Image size exceeds 4 MB. Please upload a smaller photo.')
      return
    }

    // Check dimensions
    try {
      const url = URL.createObjectURL(file)
      const img = new window.Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Invalid image'))
      })
      URL.revokeObjectURL(url)

      if (img.naturalWidth < 600 || img.naturalHeight < 600) {
        setValidationError('Photo resolution too low. Please use a portrait at least 600×600 pixels.')
        return
      }
    } catch {
      setValidationError('Could not read image file. Please try another portrait.')
      return
    }

    await onUploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await validateAndUpload(file)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await validateAndUpload(file)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-between gap-8">
      {/* Top Section: Intro & Primary Sample Action */}
      <div className="flex flex-col gap-6">
        <div>
          <span className="ui-label text-[10px] text-[var(--gold)] block mb-1">
            STEP 01 — YOUR PORTRAIT
          </span>
          <h3 className="text-2xl font-serif-italic text-[var(--ink)]">
            See actual size on you
          </h3>
          <p className="text-xs text-[var(--ink-2)] mt-1.5 leading-relaxed">
            Our virtual mirror measures jewellery against your iris diameter (11.7 mm anatomical baseline) for sub-millimeter scale fidelity.
          </p>
        </div>

        {/* Primary Call to Action: Sample Face */}
        <div className="p-5 rounded-xl bg-white border border-[var(--line)] shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="ui-label text-[10px] text-[var(--ink-2)]">INSTANT PRE-CALIBRATED DEMO</span>
            <span className="ui-label text-[10px] text-[var(--ok)] bg-[var(--ok)]/10 px-2 py-0.5 rounded-full">
              0 UNITS SPENT
            </span>
          </div>
          <p className="text-xs text-[var(--ink)] font-normal">
            Try on instantly using our studio reference model. Pre-calibrated coordinates ensure instantaneous 0ms rendering.
          </p>
          <PillButton
            variant="gold"
            onClick={onSelectSample}
            disabled={isUploading}
            className="w-full justify-center !py-3 text-xs"
          >
            USE A SAMPLE FACE
          </PillButton>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-[var(--line)]" />
          <span className="ui-label text-[10px] text-[var(--ink-2)]">OR UPLOAD YOUR OWN</span>
          <div className="flex-1 h-[1px] bg-[var(--line)]" />
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload your portrait image file"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
            flex flex-col items-center justify-center gap-3
            focus-visible:outline-2 focus-visible:outline-[var(--gold)]
            ${
              isDragOver
                ? 'border-[var(--gold)] bg-[var(--gold)]/5'
                : 'border-[var(--line)] hover:border-[var(--gold)]/60 bg-white/50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          <div className="w-12 h-12 rounded-full bg-[var(--paper)] flex items-center justify-center text-[var(--ink-2)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
            </svg>
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--ink)]">
              {isUploading ? 'Preparing portrait…' : 'Drop your portrait here or browse'}
            </p>
            <p className="text-[11px] text-[var(--ink-2)] mt-0.5">
              JPG, PNG, or WebP (Max 4 MB, min 600×600 px)
            </p>
          </div>
        </div>

        {/* Validation or Upload Error Banner */}
        {(validationError || error) && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-[var(--warn)]/10 border border-[var(--warn)]/30 text-[var(--warn)] text-xs flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{validationError || error}</span>
          </div>
        )}
      </div>

      {/* Bottom Section: Editorial Portrait Tips */}
      <div className="pt-4 border-t border-[var(--line)] flex flex-col gap-2.5 text-[var(--ink-2)]">
        <span className="ui-label text-[10px] tracking-wider text-[var(--ink)]">
          FOR BEST MEASUREMENT PRECISION
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-[9px] font-bold shrink-0">
              1
            </span>
            <span>Look directly at the lens, chin level.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-[9px] font-bold shrink-0">
              2
            </span>
            <span>Tuck hair behind ear for clear earlobe visibility.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-[9px] font-bold shrink-0">
              3
            </span>
            <span>Ensure even, natural front lighting.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
