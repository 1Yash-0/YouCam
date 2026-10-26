'use client'
import type { ProcessingStepProps } from './types'
const labels: Record<string,string> = { cloth: 'Outfit', hair: 'Hairstyle', makeup: 'Lip colour', earring: 'Earring', stack: 'Earring stack', necklace: 'Necklace', ring: 'Ring', bracelet: 'Bracelet', watch: 'Watch' }
export function ProcessingStep({ steps, currentStepName, currentStepIndex, totalSteps, currentCopy, userPhotoUrl, onCancel }: ProcessingStepProps) {
  return <section className="grid md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] min-h-[420px]">
    <div className="min-h-[320px] h-[min(65vh,720px)] bg-[var(--paper)]">{userPhotoUrl && <img src={userPhotoUrl} alt="Your photo while the preview is processing" className="w-full h-full object-contain opacity-70" />}</div>
    <div className="p-7 flex flex-col justify-center gap-5">
      <div role="status" aria-live="polite" className="flex flex-col gap-5">
        <h2 className="font-display text-3xl">Preparing your preview.</h2>
        <p>{labels[currentStepName || steps[currentStepIndex]] || 'YouCam'} · Step {Math.min(currentStepIndex+1,totalSteps)} of {totalSteps}</p>
        <progress aria-label="Waiting for YouCam preview" className="w-full accent-[var(--gold)]" />
        <p className="text-[var(--ink-2)]">{currentCopy}</p>
      </div>
      {onCancel && <div className="flex flex-col gap-2">
        <button type="button" onClick={onCancel} className="link-draw self-start text-[16px]">Cancel this preview</button>
        <p className="text-[15px] text-[var(--ink-2)]">The render request has already been sent, so it still uses 1 unit.</p>
      </div>}
    </div>
  </section>
}
