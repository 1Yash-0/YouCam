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
import { getProductCapabilities } from '@/lib/product-capabilities'
import { SAMPLE_RESULTS } from '@/lib/sample-catalogue'
import { buildTryOnRequest } from '@/lib/tryon-request'
import sampleFace from '../../data/sample-face.json'

export const SAMPLE_PHOTO_ID = 'f813b0825ce8b5f0dd103b255ec7410af0c6a8003b8f4b92198de200696f3b9c'
export const SAMPLE_PHOTO_URL = '/sample-face.png'
export const SAMPLE_IRIS_PX = sampleFace.iris.px
export const SAMPLE_IRIS_MM = 11.7
export const SAMPLE_EYE_COORDS = sampleFace.eyeCenter

export const PROCESSING_MESSAGES = [
  'Preparing your preview…',
  'Applying the selected piece with YouCam…',
  'Waiting for the render to finish…',
  'You can return to this page while your preview is processing.',
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
  const capabilities = getProductCapabilities(product)
  const productSizes = 'sizes' in product ? product.sizes : undefined
  const initialSize = initialSizeCm || productSizes?.[0] || ('heightCm' in product ? product.heightCm : 3.0)

  const [state, setState] = useState<TryOnState>(() => ({
    isOpen: false,
    step: 'photo',
    previousStep: null,
    productId: product.id,
    sizeCm: initialSize,
    finger: 3,
    ringSizeUs: 7,
    ringSizeKnown: false,
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
    activeSteps: [capabilities.flow === 'ear' ? 'earring' : capabilities.flow === 'neck' ? 'necklace' : product.type as 'ring' | 'watch' | 'bracelet'],
    stepIndex: 0,
    totalSteps: 1,
    currentStepName: capabilities.flow === 'ear' ? 'earring' : product.type,
    hairlineProgress: 0,
    resultKey: null,
    resultImageUrl: null,
    baseResultImageUrl: null,
    baseMeasurement: null,
    renderedCm: null,
    tolerancePct: 10,
    withinTolerance: null,
    showRuler: true,
    compareMode: 'original',
    splitPosition: 50,
    measurement: null,
    extras: {},
    isPresetRendering: false,
    cachedPresets: new Set<string>(),
    error: null,
  }))

  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hairTemplates, setHairTemplates] = useState<Array<{ templateId: string; title: string }>>([])
  const [isLoadingHairTemplates, setIsLoadingHairTemplates] = useState(false)
  const [currentCopyIndex, setCurrentCopyIndex] = useState(0)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollGeneration = useRef(0)
  const mounted = useRef(true)
  const pollingBusy = useRef(false)
  const submitBusy = useRef(false)
  const hairTemplatesBusy = useRef(false)
  const attemptId = useRef<string | null>(null)
  const [sizeComparisons, setSizeComparisons] = useState<Array<{ sizeCm: number; imageUrl: string; measurement?: TryOnState['measurement'] }>>([])
  const resumeKey = `darpan_job_${product.id}`

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
    mounted.current = true
    return () => {
      mounted.current = false
      pollGeneration.current++
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
      irisPx: prev.irisPx,
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

  // A sample is a reviewed render, not a request to spend credits.
  const selectSampleFace = useCallback(() => {
    const sample = SAMPLE_RESULTS[product.id]
    if (!sample) return
    pollGeneration.current++
    attemptId.current = null
    if (pollingRef.current) clearInterval(pollingRef.current)
    sessionStorage.removeItem(resumeKey)
    setSizeComparisons(sample.variants || (sample.sizeCm ? [{ sizeCm: sample.sizeCm, imageUrl: sample.imageUrl }] : []))
    setState((prev) => ({
      ...prev,
      photoId: SAMPLE_PHOTO_ID,
      photoUrl: sample.photoUrl || null,
      photoDimensions: { width: 1104, height: 1472 },
      isSampleFace: true,
      irisPx: SAMPLE_IRIS_PX,
      irisMm: SAMPLE_IRIS_MM,
      ear: 'right',
      caliperCoords: SAMPLE_EYE_COORDS,
      sizeCm: sample.sizeCm || prev.sizeCm,
      resultImageUrl: sample.imageUrl,
      baseResultImageUrl: sample.imageUrl,
      baseMeasurement: null,
      resultKey: `sample-${product.id}`,
      jobId: null,
      measurement: null,
      renderedCm: null,
      withinTolerance: null,
      extras: {},
      step: 'result',
      error: null,
    }))
  }, [product.id, resumeKey])

  // Action: Upload custom user photo
  const uploadPhoto = useCallback(async (file: File) => {
    setIsUploading(true)
    setState((prev) => ({ ...prev, error: null }))

    try {
      const ticketResponse = await fetch('/api/photo/upload', { method: 'POST' })
      if (!ticketResponse.ok) {
        let userMessage = 'Could not prepare a private upload. Please retry.'
        try {
          const error = await ticketResponse.json()
          if (typeof error?.userMessage === 'string' && error.userMessage.trim()) userMessage = error.userMessage
        } catch {
          // Keep the generic message when a proxy returns a non-JSON error page.
        }
        throw new Error(userMessage)
      }
      const ticket = await ticketResponse.json()
      let response: Response
      if (ticket.signedUrl) {
        const sent = await fetch(ticket.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file })
        if (!sent.ok) throw new Error('Upload interrupted. Please retry.')
        response = await fetch('/api/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadKey: ticket.key }) })
      } else {
        const formData = new FormData(); formData.append('photo', file)
        response = await fetch('/api/photo', { method: 'POST', body: formData })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.userMessage || data.message || 'Failed to upload photo')
      }

      setSizeComparisons([])
      setState((prev) => ({
        ...prev,
        photoId: data.photoId,
        photoUrl: `/api/photo/${data.photoId}`,
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
    const generation = ++pollGeneration.current
    const startedAt = Date.now()

    pollingRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        setState(prev => ({ ...prev, step: 'error', isPresetRendering: false, error: { code: 'POLLING_TIMEOUT', userMessage: 'This preview is taking longer than usual. Retry to check the same job again.', recoveryAction: 'retry' } }))
        return
      }
      if (pollingBusy.current) return
      pollingBusy.current = true
      try {
        const response = await fetch(`/api/tryon/${jobId}`)
        const data = await response.json()
        if (generation !== pollGeneration.current || !mounted.current) return

        if (response.status === 409 || response.status >= 500 && data.code !== 'BUDGET_RESERVED') return
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
          sessionStorage.removeItem(resumeKey)
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
            baseMeasurement: hasExtras ? prev.baseMeasurement : res.measurement ?? null,
            renderedCm: res.measurement?.renderedCm ?? null,
            tolerancePct: res.measurement?.tolerancePct ?? 10,
            withinTolerance: res.measurement?.withinTolerance ?? null,
            measurement: res.measurement ?? null,
            error: null,
          }))
        }
      } catch (err: any) {
        if (generation !== pollGeneration.current || !mounted.current) return
        console.error('Error during tryon polling:', err)
        setState((prev) => ({
          ...prev,
          currentStepName: 'Reconnecting to your existing preview…',
        }))
      } finally {
        pollingBusy.current = false
      }
    }, 1800)
  }, [resumeKey])

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(resumeKey) || 'null')
      if (saved?.jobId && saved?.photoId) {
        setState(prev => ({ ...prev, ...saved, step: 'processing', photoUrl: `/api/photo/${saved.photoId}`, isSampleFace: false }))
        startPolling(saved.jobId, saved.extras || {})
      }
    } catch { sessionStorage.removeItem(resumeKey) }
  }, [resumeKey, startPolling])

  // Execute Try-On pipeline
  const submitTryOn = useCallback(
    async (overrideExtras?: StylingExtras, overrideSize?: number) => {
      if (!state.photoId || state.isSampleFace || submitBusy.current) return
      submitBusy.current = true

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
        const body = buildTryOnRequest(product, { ...state, sizeCm: overrideSize ?? state.sizeCm }, activeExtras)
        attemptId.current ??= crypto.randomUUID()
        body.attemptId = attemptId.current
        if (overrideSize !== undefined) setState(prev => ({ ...prev, sizeCm: overrideSize }))

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
            jobId: null,
            resultImageUrl: res.imageUrl,
            baseResultImageUrl: hasExtras ? prev.baseResultImageUrl || res.imageUrl : res.imageUrl,
            baseMeasurement: hasExtras ? prev.baseMeasurement : res.measurement ?? null,
            renderedCm: res.measurement?.renderedCm ?? null,
            tolerancePct: res.measurement?.tolerancePct ?? 10,
            withinTolerance: res.measurement?.withinTolerance ?? null,
            measurement: res.measurement ?? null,
            extras: activeExtras,
            error: null,
          }))
          return
        }

        // Async execution: start polling
        if (data.status === 'running' && data.jobId) {
          sessionStorage.setItem(resumeKey, JSON.stringify({ jobId: data.jobId, photoId: state.photoId, sizeCm: overrideSize ?? state.sizeCm, irisPx: state.irisPx, ear: state.ear, finger: state.finger, ringSizeUs: state.ringSizeUs, ringSizeKnown: state.ringSizeKnown, extras: activeExtras }))
          setState((prev) => ({
            ...prev,
            step: 'processing',
            jobId: data.jobId,
            extras: activeExtras,
            stepIndex: 0,
            hairlineProgress: 0.1,
          }))
          if (mounted.current) startPolling(data.jobId, activeExtras)
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
        submitBusy.current = false
        setIsSubmitting(false)
      }
    },
    [state, product, resumeKey, startPolling]
  )

  // Styling Extras toggles (single-job mutex)
  useEffect(() => {
    if (state.step === 'result' && state.resultImageUrl && !state.isSampleFace && capabilities.calibration && !Object.values(state.extras).some(Boolean)) {
      setSizeComparisons(prev => [...prev.filter(item => item.sizeCm !== state.sizeCm), { sizeCm: state.sizeCm, imageUrl: state.resultImageUrl!, measurement: state.measurement }].sort((a,b) => a.sizeCm-b.sizeCm))
    }
  }, [state.step, state.resultImageUrl, state.sizeCm, state.isSampleFace, state.extras, state.measurement, capabilities.calibration])

  const compareSize = async (size: number) => {
    const hasExtras = Boolean(state.extras.lipstick || state.extras.hairUp || state.extras.outfit || state.extras.stack?.length)
    if (state.step !== 'result' || isSubmitting || state.isPresetRendering || submitBusy.current) return
    if (state.sizeCm === size && !hasExtras) return
    const existing = sizeComparisons.find(item => item.sizeCm === size)
    if (existing) {
      const measurement = existing.measurement ?? null
      setState(prev => ({
        ...prev,
        sizeCm: size,
        resultImageUrl: existing.imageUrl,
        baseResultImageUrl: existing.imageUrl,
        baseMeasurement: measurement,
        measurement,
        renderedCm: measurement?.renderedCm ?? null,
        tolerancePct: measurement?.tolerancePct ?? 10,
        withinTolerance: measurement?.withinTolerance ?? null,
        extras: {},
      }))
    } else if (!state.isSampleFace) await submitTryOn({}, size)
  }
  const toggleLipstick = useCallback(() => {
    if (state.isPresetRendering || state.isSampleFace) return
    setState((prev) => ({ ...prev, extras: { ...prev.extras, lipstick: prev.extras.lipstick ? undefined : PRESET_LIPSTICK_BERRY } }))
  }, [state.isPresetRendering, state.isSampleFace])

  const selectLipstickShade = useCallback(
    (shade: { id: string; name: string; hex: string; texture: 'matte' | 'satin' | 'gloss' | 'shimmer'; intensity: number }) => {
      if (state.isPresetRendering || state.isSampleFace) return
      setState((prev) => ({ ...prev, extras: { ...prev.extras, lipstick: shade } }))
    },
    [state.isPresetRendering, state.isSampleFace]
  )

  const loadHairTemplates = useCallback(async () => {
    if (hairTemplates.length || hairTemplatesBusy.current) return hairTemplates
    hairTemplatesBusy.current = true
    setIsLoadingHairTemplates(true)
    try {
      const response = await fetch('/api/hair/templates')
      if (!response.ok) throw new Error('Hair presets are unavailable. Please try again later.')
      const templates = await response.json() as Array<{ id?: string; templateId?: string; title: string }>
      const normalized = templates.filter((item) => item && item.title && (item.templateId || item.id)).map((item) => ({ templateId: item.templateId || item.id!, title: item.title }))
      setHairTemplates(normalized)
      return normalized
    } catch (error) {
      setState(prev => ({ ...prev, error: { code: 'HAIR_UNAVAILABLE', userMessage: error instanceof Error ? error.message : 'Hair presets are unavailable.' } }))
      return []
    } finally {
      hairTemplatesBusy.current = false
      setIsLoadingHairTemplates(false)
    }
  }, [hairTemplates])

  const toggleHairUp = useCallback(() => {
    if (state.isPresetRendering || state.isSampleFace) return
    if (state.extras.hairUp) setState((prev) => ({ ...prev, extras: { ...prev.extras, hairUp: undefined } }))
    else void loadHairTemplates()
  }, [state.isPresetRendering, state.isSampleFace, state.extras.hairUp, loadHairTemplates])

  const clearStyling = useCallback(() => {
    if (state.isPresetRendering || submitBusy.current) return
    setState((prev) => ({
      ...prev,
      extras: {},
      resultImageUrl: prev.baseResultImageUrl || prev.resultImageUrl,
      measurement: prev.baseMeasurement,
      renderedCm: prev.baseMeasurement?.renderedCm ?? null,
      tolerancePct: prev.baseMeasurement?.tolerancePct ?? 10,
      withinTolerance: prev.baseMeasurement?.withinTolerance ?? null,
      compareMode: 'original',
      error: null,
    }))
  }, [state.isPresetRendering])

  const applyStyling = useCallback((extras: StylingExtras) => {
    if (state.isPresetRendering || state.isSampleFace || submitBusy.current) return
    const hasExtras = Boolean(extras.lipstick || extras.hairUp || extras.outfit || extras.stack?.length)
    if (!hasExtras) {
      clearStyling()
      return
    }
    if (JSON.stringify(extras) === JSON.stringify(state.extras)) return
    return submitTryOn(extras)
  }, [state.isPresetRendering, state.isSampleFace, state.extras, submitTryOn, clearStyling])

  const toggleOutfit = useCallback(() => {
    if (state.isPresetRendering || state.isSampleFace) return
    setState((prev) => ({ ...prev, extras: { ...prev.extras, outfit: prev.extras.outfit ? undefined : PRESET_BLOUSE_EMERALD } }))
  }, [state.isPresetRendering, state.isSampleFace])

  const toggleStack = useCallback(() => {
    if (state.isPresetRendering || state.isSampleFace) return
    setState((prev) => ({ ...prev, extras: { ...prev.extras, stack: prev.extras.stack?.length ? undefined : [PRESET_STUD_STACK] } }))
  }, [state.isPresetRendering, state.isSampleFace])

  // Error recovery actions
  const retry = useCallback(() => {
    if (state.step === 'error') {
      if (state.error?.code === 'SUBMISSION_UNCERTAIN') { selectSampleFace(); return }
      if (state.jobId && state.error?.code === 'POLLING_TIMEOUT') { setStep('processing'); startPolling(state.jobId, state.extras); return }
      if (state.jobId) { attemptId.current = crypto.randomUUID(); sessionStorage.removeItem(resumeKey) }
      submitTryOn()
    }
  }, [state, submitTryOn, setStep, startPolling, selectSampleFace, resumeKey])

  const switchEar = useCallback(() => {
    const nextEar: EarOption = state.ear === 'right' ? 'left' : 'right'
    setState((prev) => ({ ...prev, ear: nextEar }))
    attemptId.current = crypto.randomUUID()
    setStep('measure')
  }, [state.ear, setStep])

  const reupload = useCallback(() => {
    pollGeneration.current++
    attemptId.current = null
    if (pollingRef.current) clearInterval(pollingRef.current)
    sessionStorage.removeItem(resumeKey)
    setState((prev) => ({
      ...prev,
      step: 'photo',
      error: null,
      photoId: null,
      photoUrl: null,
      jobId: null,
      resultImageUrl: null,
      baseResultImageUrl: null,
      baseMeasurement: null,
      measurement: null,
      renderedCm: null,
      withinTolerance: null,
      extras: {},
    }))
  }, [resumeKey])

  return {
    state,
    sizeComparisons,
    compareSize,
    capabilities,
    setFinger: (finger: 1 | 2 | 3 | 4 | 5) => setState(prev => ({ ...prev, finger })),
    setRingSize: (ringSizeUs: number, ringSizeKnown: boolean) => setState(prev => ({ ...prev, ringSizeUs, ringSizeKnown })),
    isUploading,
    isSubmitting,
    hairTemplates,
    isLoadingHairTemplates,
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
    loadHairTemplates,
    applyStyling,
    clearStyling,
    toggleOutfit,
    toggleStack,
    retry,
    switchEar,
    reupload,
  }
}
