'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PhotoStep } from './PhotoStep'
import { MeasureStep } from './MeasureStep'
import { ProductSetupStep } from './ProductSetupStep'
import { ProcessingStep } from './ProcessingStep'
import { ResultStep } from './ResultStep'
import { ErrorCard } from './ErrorCard'
import { useTryOn } from '@/hooks/useTryOn'
import { useCart } from '@/hooks/useCart'
import { useToast } from '@/components/Toast'
import { getProductDisplayImageUrl, selectionLabel } from '@/lib/product-capabilities'
import { TryOnDrawerProps } from './types'
import { SizeRuler, StepCue } from './SizeRuler'

/** Kept as the integration boundary for existing callers; presented as a full-page studio. */
export function TryOnDrawer({ isOpen, onClose, product, initialSizeCm }: TryOnDrawerProps) {
  const search = useSearchParams()
  const initialized = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const h = useTryOn({ product, initialSizeCm })
  const { state, capabilities: c } = h
  const { addItem, openCart } = useCart()
  const { showToast } = useToast()
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      if (search.get('sample') === '1' && !sessionStorage.getItem(`darpan_job_${product.id}`)) h.selectSampleFace()
    }
  }, [search, product.id, h.selectSampleFace])
  async function deletePhoto() {
    if (!state.photoId || state.isSampleFace) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/photo/${state.photoId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Deletion failed')
      h.reupload()
      showToast({ message: 'Your photo and previews were deleted.', variant: 'gold' })
    } catch { showToast({ message: 'Could not delete your photo. Please retry.', variant: 'warn' }) }
    finally { setDeleting(false) }
  }
  if (!isOpen) return null
  const busy = state.step === 'processing' || h.isSubmitting
  return <main className="tryon-studio max-w-[1440px] mx-auto px-4 md:px-8 py-6">
    <header className="flex flex-wrap justify-between items-start gap-5 pb-2">
      <div><h1 className="font-display text-4xl md:text-5xl">{product.name}</h1><p className="mt-2 text-[17px] text-[var(--ink-2)]">{selectionLabel(product, state.sizeCm, state.ringSizeUs, state.ringSizeKnown)}</p></div>
      <button className="link-draw py-2" onClick={onClose}>Back to piece</button>
    </header>
    <StepCue current={state.step === 'photo' ? 0 : state.step === 'result' ? 2 : 1} names={['Photo', c.calibration ? 'Estimate scale' : 'Details', 'Compare & save']} />
    {c.calibration && state.step !== 'photo' && state.step !== 'result' && <div className="pb-6"><SizeRuler sizes={c.sizes} value={state.sizeCm} disabled={busy} label="Drop length in centimetres" onChange={(size) => h.setSizeCm(size)} /></div>}
    <div className="bg-[var(--paper)]">
      {state.step === 'photo' && <PhotoStep product={product} onSelectSample={h.selectSampleFace} onUploadFile={h.uploadPhoto} isUploading={h.isUploading} error={state.error?.userMessage} />}
      {state.step === 'measure' && (c.calibration ? <MeasureStep photoUrl={state.photoUrl || ''} isSampleFace={state.isSampleFace} irisPx={state.irisPx} onIrisChange={h.setIrisPx} onResetAverage={h.resetAverage} ear={state.ear} onEarChange={h.setEar} selectedSizeCm={state.sizeCm} onSubmitTryOn={() => h.submitTryOn()} isSubmitting={h.isSubmitting} caliperCoords={state.caliperCoords} onCaliperCoordsChange={h.setCaliperCoords} /> : <ProductSetupStep product={product} state={state} onRingSize={h.setRingSize} onFinger={h.setFinger} onSubmit={() => h.submitTryOn()} isSubmitting={h.isSubmitting} />)}
      {state.step === 'processing' && <ProcessingStep steps={state.activeSteps} currentStepName={state.currentStepName} currentStepIndex={state.stepIndex} totalSteps={state.totalSteps} progress={state.hairlineProgress} currentCopy={h.currentCopy} userPhotoUrl={state.photoUrl} />}
      {state.step === 'result' && <ResultStep state={state} product={product} sizeComparisons={h.sizeComparisons} onCompareSize={h.compareSize} isComparingSize={busy} onToggleRuler={h.toggleRuler} onSetCompareMode={h.setCompareMode} onSliderPositionChange={h.setSplitPosition} onToggleLipstick={h.toggleLipstick} onToggleHairUp={h.toggleHairUp} onToggleOutfit={h.toggleOutfit} onToggleStack={h.toggleStack} onSelectLipstickShade={h.selectLipstickShade} onApplyStyling={h.applyStyling} onClearStyling={h.clearStyling} hairTemplates={h.hairTemplates} isLoadingHairTemplates={h.isLoadingHairTemplates} onRequestHairTemplates={h.loadHairTemplates} onRecalibrate={() => state.isSampleFace ? h.reupload() : h.setStep('measure')} onAddToCart={() => {
        const sizeLabel = selectionLabel(product, state.sizeCm, state.ringSizeUs, state.ringSizeKnown)
        addItem({ productId: product.id, title: product.name, brand: product.brand, priceUsd: product.priceUsd, productImageUrl: getProductDisplayImageUrl(product), sizeLabel, selectionKey: sizeLabel })
        showToast({ message: `${product.name} saved to your choices.`, variant: 'gold' }); openCart()
      }} />}
      {state.step === 'error' && state.error && <ErrorCard error={state.error} photoUrl={state.photoUrl} onUseSampleFace={h.selectSampleFace} onRetry={h.retry} onReupload={h.reupload} onSwitchEar={h.switchEar} />}
    </div>
    {state.photoId && !state.isSampleFace && <div className="flex flex-wrap gap-5 py-5 text-sm"><button disabled={busy} className="underline underline-offset-4" onClick={h.reupload}>Use another photo</button><button disabled={deleting || busy} className="underline underline-offset-4" onClick={deletePhoto}>{deleting ? 'Deleting…' : 'Delete my photo and previews'}</button></div>}
  </main>
}

