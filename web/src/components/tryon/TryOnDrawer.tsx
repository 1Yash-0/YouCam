'use client'

import React, { useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { DrawerHeader } from './DrawerHeader'
import { PhotoStep } from './PhotoStep'
import { MeasureStep } from './MeasureStep'
import { ProcessingStep } from './ProcessingStep'
import { ResultStep } from './ResultStep'
import { ErrorCard } from './ErrorCard'
import { CartDrawer } from './CartDrawer'
import { useTryOn } from '@/hooks/useTryOn'
import { useCart } from '@/hooks/useCart'
import { useInertBackground } from '@/hooks/useInertBackground'
import { TryOnDrawerProps, DrawerStep } from './types'

export function TryOnDrawer({
  isOpen,
  onClose,
  product,
  initialSizeCm,
}: TryOnDrawerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    state,
    isUploading,
    isSubmitting,
    currentCopy,
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
  } = useTryOn({ product, initialSizeCm })

  const { addItem, isCartOpen, closeCart } = useCart()

  // Handle URL query parameter synchronization (?tryon=1&step=...)
  useEffect(() => {
    if (!isOpen) return

    const currentTryOn = searchParams.get('tryon')
    const currentStepParam = searchParams.get('step') as DrawerStep | null

    if (currentStepParam && ['photo', 'measure', 'processing', 'result', 'bag', 'error'].includes(currentStepParam)) {
      if (state.step !== currentStepParam) {
        setStep(currentStepParam)
      }
    } else if (currentTryOn !== '1') {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tryon', '1')
      params.set('step', state.step)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [isOpen, searchParams, pathname, router, state.step, setStep])

  // Sync step changes back to URL
  useEffect(() => {
    if (!isOpen) return
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('step') !== state.step) {
      params.set('tryon', '1')
      params.set('step', state.step)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [state.step, isOpen, pathname, router, searchParams])

  // Clean up URL on drawer close
  const handleClose = useCallback(() => {
    onClose()
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tryon')
    params.delete('step')
    const queryString = params.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [onClose, pathname, router, searchParams])

  // Manage inert state on background DOM (#page-root, <main>, <header>)
  useInertBackground('tryon-drawer', isOpen)

  // Background body scroll lock and escape key handler
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  // Add to Bag handler
  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      title: product.name,
      brand: product.brand,
      sizeCm: state.sizeCm,
      priceInr: product.priceInr,
      productImageUrl: product.imagePath,
      tryOnThumbnailUrl: state.resultImageUrl || undefined,
      triedOnAtCm: state.renderedCm || state.sizeCm,
    })
    setStep('bag')
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleClose}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Slide-Over Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-title"
              className="fixed inset-y-0 right-0 z-50 w-full max-w-[560px] bg-[var(--paper)] flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.14)] border-l border-[var(--line)]"
            >
              {/* Drawer Header */}
              <DrawerHeader
                product={product}
                selectedSizeCm={state.sizeCm}
                onSizeChange={setSizeCm}
                currentStep={state.step}
                onClose={handleClose}
              />

              {/* Step Content Stage */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {state.step === 'photo' && (
                  <PhotoStep
                    onSelectSample={selectSampleFace}
                    onUploadFile={uploadPhoto}
                    isUploading={isUploading}
                    error={state.error?.userMessage}
                  />
                )}

                {state.step === 'measure' && (
                  <MeasureStep
                    photoUrl={state.photoUrl || '/sample-face.png'}
                    isSampleFace={state.isSampleFace}
                    irisPx={state.irisPx}
                    onIrisChange={setIrisPx}
                    onResetAverage={resetAverage}
                    ear={state.ear}
                    onEarChange={setEar}
                    selectedSizeCm={state.sizeCm}
                    onSubmitTryOn={() => submitTryOn()}
                    isSubmitting={isSubmitting}
                    caliperCoords={state.caliperCoords}
                    onCaliperCoordsChange={setCaliperCoords}
                  />
                )}

                {state.step === 'processing' && (
                  <ProcessingStep
                    steps={state.activeSteps}
                    currentStepIndex={state.stepIndex}
                    totalSteps={state.totalSteps}
                    progress={state.hairlineProgress}
                    currentCopy={currentCopy}
                    userPhotoUrl={state.photoUrl}
                  />
                )}

                {state.step === 'result' && (
                  <ResultStep
                    state={state}
                    product={product}
                    onToggleRuler={toggleRuler}
                    onSetCompareMode={setCompareMode}
                    onSliderPositionChange={setSplitPosition}
                    onToggleLipstick={toggleLipstick}
                    onToggleHairUp={toggleHairUp}
                    onToggleOutfit={toggleOutfit}
                    onToggleStack={toggleStack}
                    onSelectLipstickShade={selectLipstickShade}
                    onAddToCart={handleAddToCart}
                    onRecalibrate={() => setStep('measure')}
                  />
                )}

                {state.step === 'error' && state.error && (
                  <ErrorCard
                    error={state.error}
                    photoUrl={state.photoUrl}
                    onUseSampleFace={selectSampleFace}
                    onRetry={retry}
                    onReupload={reupload}
                    onSwitchEar={switchEar}
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart Drawer Slide-Over Sheet (Accessible when step is 'bag' or when header bag opened) */}
      <CartDrawer
        isOpen={isCartOpen || state.step === 'bag'}
        onClose={() => {
          closeCart()
          if (state.step === 'bag') {
            setStep('result')
          }
        }}
      />
    </>
  )
}
