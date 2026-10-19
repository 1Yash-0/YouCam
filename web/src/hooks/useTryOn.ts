'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DrawerStep,
  EarOption,
  CompareMode,
  StylingExtras,
  TryOnState,
} from '@/components/tryon/types'
import { Product } from '@/lib/products'

export const SAMPLE_PHOTO_ID = 'f813b0825ce8b5f0dd103b255ec7410af0c6a8003b8f4b92198de200696f3b9c'
export const SAMPLE_PHOTO_URL = '/sample-face.png'
export const SAMPLE_IRIS_PX = 37
export const SAMPLE_IRIS_MM = 11.7
export const SAMPLE_EYE_COORDS = { x: 623.5, y: 488 }

export const PROCESSING_MESSAGES = [
  'Aligning iris diameter to 11.7 mm anatomical baseline…',
  'Calibrating sub-millimeter jewellery drop against earlobe…',
  'Balancing 18k gold luster with your portrait lighting…',
  'Verifying physical scale diff-box within 10% tolerance…',
]

export const PRESET_LIPSTICK_BERRY = {
  id: 'berry-satin',
  name: 'Berry (Satin)',
  hex: '#9B1B30',
  texture: 'satin' as const,
  intensity: 80,
}

export const PRESET_HAIR_BRAIDS = {
  templateId: 'braid-01',
  title: 'Two Braids Updo',
}

export const PRESET_BLOUSE_EMERALD = {
  productId: 'emerald-blouse',
  title: 'Emerald Silk Blouse',
}

export const PRESET_STUD_STACK = {
  productId: 'dot-stud',
  sizeCm: 0.6,
  wearingLocation: [385, 620] as [number, number],
}

interface UseTryOnProps {
  product: Product
  initialSizeCm?: number
}

export function useTryOn({ product, initialSizeCm }: UseTryOnProps) {
  const productSizes = 'sizes' in product ? product.sizes : undefined
  const initialSize = initialSizeCm || productSizes?.[0] || ('heightCm' in product ? product.heightCm : 3.0)

  const [state, setState] = useState<TryOnState>(() => ({
    isOpen: false,
    step: 'photo',
    previousStep: null,
    productId: product.id,
    sizeCm: initialSize,
    photoId: null,
    photoUrl: null,
    photoDimensions: null,
    isSampleFace: false,
    irisPx: SAMPLE_IRIS_PX,
    irisMm: SAMPLE_IRIS_MM,
    ear: 'right',
    zoom: 1.0,
    caliperCoords: SAMPLE_EYE_COORDS,
    jobId: null,
    activeSteps: ['earring'],
    stepIndex: 0,
    totalSteps: 1,
    currentStepName: 'earring',
    hairlineProgress: 0,
    resultKey: null,
    resultImageUrl: null,
    baseResultImageUrl: null,
    renderedCm: null,
    tolerancePct: 10,
    withinTolerance: null,
    showRuler: true,
    compareMode: 'original',
    splitPosition: 50,
    measurement: null,
    extras: {},
    isPresetRendering: false,
    cachedPresets: new Set<string>(['berry-satin']),
    error: null,
  }))

  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentCopyIndex, setCurrentCopyIndex] = useState(0)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Rotating copy timer during processing
  useEffect(() => {
    if (state.step !== 'processing') return

    const interval = setInterval(() => {
      setCurrentCopyIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length)
    }, 3800)

    return () => clearInterval(interval)
  }, [state.step])

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Sync product changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      productId: product.id,
      sizeCm: initialSizeCm || prev.sizeCm,
    }))
  }, [product.id, initialSizeCm])

  const setStep = useCallback((step: DrawerStep) => {
    setState((prev) => ({
      ...prev,
      previousStep: prev.step,
      step,
    }))
  }, [])

  const setSizeCm = useCallback((sizeCm: number) => {
    setState((prev) => ({ ...prev, sizeCm }))
  }, [])

  const setIrisPx = useCallback((irisPx: number) => {
    setState((prev) => ({ ...prev, irisPx }))
  }, [])

  const resetAverage = useCallback(() => {
    setState((prev) => ({
      ...prev,
      irisPx: SAMPLE_IRIS_PX,
      irisMm: SAMPLE_IRIS_MM,
      caliperCoords: prev.isSampleFace ? SAMPLE_EYE_COORDS : prev.caliperCoords,
    }))
  }, [])

  const setEar = useCallback((ear: EarOption) => {
    setState((prev) => ({ ...prev, ear }))
  }, [])

  const setCaliperCoords = useCallback((caliperCoords: { x: number; y: number }) => {
    setState((prev) => ({ ...prev, caliperCoords }))
  }, [])

  const toggleRuler = useCallback(() => {
    setState((prev) => ({ ...prev, showRuler: !prev.showRuler }))
  }, [])

  const setCompareMode = useCallback((compareMode: CompareMode) => {
    setState((prev) => ({ ...prev, compareMode }))
  }, [])

  const setSplitPosition = useCallback((splitPosition: number) => {
    setState((prev) => ({ ...prev, splitPosition }))
  }, [])

  // Action: Select pre-calibrated sample face
  const selectSampleFace = useCallback(() => {
    setState((prev) => ({
      ...prev,
      photoId: SAMPLE_PHOTO_ID,
      photoUrl: SAMPLE_PHOTO_URL,
      photoDimensions: { width: 1104, height: 1472 },
      isSampleFace: true,
      irisPx: SAMPLE_IRIS_PX,
      irisMm: SAMPLE_IRIS_MM,
      ear: 'right',
      caliperCoords: SAMPLE_EYE_COORDS,
      step: 'measure',
      error: null,
    }))
  }, [])

  // Action: Upload custom user photo
  const uploadPhoto = useCallback(async (file: File) => {
    setIsUploading(true)
    setState((prev) => ({ ...prev, error: null }))

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const response = await fetch('/api/photo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.userMessage || data.message || 'Failed to upload photo')
      }

      const objectUrl = URL.createObjectURL(file)
      setState((prev) => ({
        ...prev,
        photoId: data.photoId,
        photoUrl: objectUrl,
        photoDimensions: { width: data.width, height: data.height },
        isSampleFace: false,
        irisPx: SAMPLE_IRIS_PX,
        irisMm: SAMPLE_IRIS_MM,
        ear: 'auto',
        caliperCoords: { x: data.width * 0.5, y: data.height * 0.35 },
        step: 'measure',
      }))
    } catch (err: any) {
      console.error('Error uploading photo:', err)
      setState((prev) => ({
        ...prev,
        error: {
          code: 'UPLOAD_FAILED',
          userMessage: err.message || 'Failed to upload photo. Please try a different image.',
          recoveryAction: 'reupload',
        },
      }))
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Poll background job
  const startPolling = useCallback((jobId: string, extrasSnapshot: StylingExtras) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/tryon/${jobId}`)
        const data = await response.json()

        if (!response.ok || data.status === 'error') {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setState((prev) => ({
            ...prev,
            step: 'error',
            isPresetRendering: false,
            error: {
              code: data.code || 'TRYON_FAILED',
              userMessage: data.userMessage || 'Virtual try-on failed. Please try again.',
              step: data.step,
              recoveryAction: data.code === 'EAR_NOT_VISIBLE' ? 'ear' : 'retry',
            },
          }))
          return
        }

        if (data.status === 'running') {
          const stepIdx = data.stepIndex || 0
          const total = data.totalSteps || 1
          const calculatedProgress = Math.min((stepIdx + 0.5) / total, 0.95)

          setState((prev) => ({
            ...prev,
            stepIndex: stepIdx,
            totalSteps: total,
            currentStepName: data.step || prev.currentStepName,
            hairlineProgress: calculatedProgress,
          }))
        } else if (data.status === 'done' && data.result) {
          if (pollingRef.current) clearInterval(pollingRef.current)

          const res = data.result
          const hasExtras =
            Boolean(extrasSnapshot.lipstick) ||
            Boolean(extrasSnapshot.hairUp) ||
            Boolean(extrasSnapshot.outfit) ||
            Boolean(extrasSnapshot.stack && extrasSnapshot.stack.length > 0)

          setState((prev) => ({
            ...prev,
            step: 'result',
            isPresetRendering: false,
            jobId: null,
            hairlineProgress: 1.0,
            resultKey: res.key,
            resultImageUrl: res.imageUrl,
            baseResultImageUrl: hasExtras ? prev.baseResultImageUrl || res.imageUrl : res.imageUrl,
            renderedCm: res.measurement?.renderedCm ?? prev.sizeCm,
            tolerancePct: res.measurement?.tolerancePct ?? 10,
            withinTolerance: res.measurement?.withinTolerance ?? true,
            measurement: res.measurement ?? null,
            error: null,
          }))
        }
      } catch (err: any) {
        console.error('Error during tryon polling:', err)
        if (pollingRef.current) clearInterval(pollingRef.current)
        setState((prev) => ({
          ...prev,
          step: 'error',
          isPresetRendering: false,
          error: {
            code: 'POLLING_ERROR',
            userMessage: 'Communication with mirror lost. Please check connection and retry.',
            recoveryAction: 'retry',
          },
        }))
      }
    }, 650)
  }, [])

  // Execute Try-On pipeline
  const submitTryOn = useCallback(
    async (overrideExtras?: StylingExtras) => {
      if (!state.photoId) return

      const activeExtras = overrideExtras ?? state.extras
      const hasExtras =
        Boolean(activeExtras.lipstick) ||
        Boolean(activeExtras.hairUp) ||
        Boolean(activeExtras.outfit) ||
        Boolean(activeExtras.stack && activeExtras.stack.length > 0)

      setIsSubmitting(true)
      setState((prev) => ({
        ...prev,
        error: null,
        isPresetRendering: hasExtras,
      }))

      try {
        const body: Record<string, any> = {
          photoId: state.photoId,
          productId: state.productId,
          sizeCm: state.sizeCm,
          irisPx: state.irisPx,
          occluded: 0,
        }

        if (state.ear !== 'auto') {
          body.ear = state.ear
        }

        if (hasExtras) {
          body.options = {}
          if (activeExtras.lipstick) {
            body.options.lipstick = {
              hex: activeExtras.lipstick.hex,
              texture: activeExtras.lipstick.texture,
              intensity: activeExtras.lipstick.intensity,
            }
          }
          if (activeExtras.hairUp) {
            body.options.hairUp = {
              templateId: activeExtras.hairUp.templateId,
            }
          }
          if (activeExtras.outfit) {
            body.options.outfit = {
              productId: activeExtras.outfit.productId,
            }
          }
          if (activeExtras.stack && activeExtras.stack.length > 0) {
            body.stack = activeExtras.stack
          }
        }

        const response = await fetch('/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await response.json()

        if (!response.ok) {
          throw {
            code: data.code || 'TRYON_ERROR',
            userMessage: data.userMessage || data.message || 'Try-on could not be started',
          }
        }

        // Cache hit: synchronous 0-unit execution
        if (data.status === 'done' && data.result) {
          const res = data.result
          setState((prev) => ({
            ...prev,
            step: 'result',
            isPresetRendering: false,
            resultKey: res.key,
            resultImageUrl: res.imageUrl,
            baseResultImageUrl: hasExtras ? prev.baseResultImageUrl || res.imageUrl : res.imageUrl,
            renderedCm: res.measurement?.renderedCm ?? prev.sizeCm,
            tolerancePct: res.measurement?.tolerancePct ?? 10,
            withinTolerance: res.measurement?.withinTolerance ?? true,
            measurement: res.measurement ?? null,
            extras: activeExtras,
            error: null,
          }))
          return
        }

        // Async execution: start polling
        if (data.status === 'running' && data.jobId) {
          setState((prev) => ({
            ...prev,
            step: 'processing',
            jobId: data.jobId,
            extras: activeExtras,
            stepIndex: 0,
            hairlineProgress: 0.1,
          }))
          startPolling(data.jobId, activeExtras)
        }
      } catch (err: any) {
        console.error('Error submitting tryon:', err)
        setState((prev) => ({
          ...prev,
          step: 'error',
          isPresetRendering: false,
          error: {
            code: err.code || 'TRYON_FAILED',
            userMessage: err.userMessage || 'An unexpected error occurred during try-on.',
            recoveryAction: err.code === 'EAR_NOT_VISIBLE' ? 'ear' : err.code === 'BUDGET_RESERVED' ? 'sample' : 'retry',
          },
        }))
      } finally {
        setIsSubmitting(false)
      }
    },
    [state.photoId, state.productId, state.sizeCm, state.irisPx, state.ear, state.extras, startPolling]
  )

  // Styling Extras toggles (single-job mutex)
  const toggleLipstick = useCallback(() => {
    if (state.isPresetRendering) return

    const nextExtras: StylingExtras = {
      ...state.extras,
      lipstick: state.extras.lipstick ? undefined : PRESET_LIPSTICK_BERRY,
    }
    submitTryOn(nextExtras)
  }, [state.isPresetRendering, state.extras, submitTryOn])

  const selectLipstickShade = useCallback(
    (shade: { id: string; name: string; hex: string; texture: 'matte' | 'satin' | 'gloss' | 'shimmer'; intensity: number }) => {
      if (state.isPresetRendering) return
      const nextExtras: StylingExtras = {
        ...state.extras,
        lipstick: shade,
      }
      submitTryOn(nextExtras)
    },
    [state.isPresetRendering, state.extras, submitTryOn]
  )

  const toggleHairUp = useCallback(() => {
    if (state.isPresetRendering) return

    const nextExtras: StylingExtras = {
      ...state.extras,
      hairUp: state.extras.hairUp ? undefined : PRESET_HAIR_BRAIDS,
    }
    submitTryOn(nextExtras)
  }, [state.isPresetRendering, state.extras, submitTryOn])

  const toggleOutfit = useCallback(() => {
    if (state.isPresetRendering) return

    const nextExtras: StylingExtras = {
      ...state.extras,
      outfit: state.extras.outfit ? undefined : PRESET_BLOUSE_EMERALD,
    }
    submitTryOn(nextExtras)
  }, [state.isPresetRendering, state.extras, submitTryOn])

  const toggleStack = useCallback(() => {
    if (state.isPresetRendering) return

    const nextExtras: StylingExtras = {
      ...state.extras,
      stack: state.extras.stack && state.extras.stack.length > 0 ? undefined : [PRESET_STUD_STACK],
    }
    submitTryOn(nextExtras)
  }, [state.isPresetRendering, state.extras, submitTryOn])

  // Error recovery actions
  const retry = useCallback(() => {
    if (state.step === 'error') {
      submitTryOn()
    }
  }, [state.step, submitTryOn])

  const switchEar = useCallback(() => {
    const nextEar: EarOption = state.ear === 'right' ? 'left' : 'right'
    setState((prev) => ({ ...prev, ear: nextEar }))
    // Retry with other ear
    setTimeout(() => {
      submitTryOn()
    }, 50)
  }, [state.ear, submitTryOn])

  const reupload = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 'photo',
      error: null,
      photoId: null,
      photoUrl: null,
    }))
  }, [])

  return {
    state,
    isUploading,
    isSubmitting,
    currentCopy: PROCESSING_MESSAGES[currentCopyIndex],
    setStep,
    setSizeCm,
    setIrisPx,
    resetAverage,
    setEar,
    setCaliperCoords,
    toggleRuler,
    setCompareMode,
    setSplitPosition,
    selectSampleFace,
    uploadPhoto,
    submitTryOn,
    toggleLipstick,
    selectLipstickShade,
    toggleHairUp,
    toggleOutfit,
    toggleStack,
    retry,
    switchEar,
    reupload,
  }
}
