'use client'
import type { ProcessingStepProps } from './types'
const labels: Record<string,string> = { cloth: 'Outfit', hair: 'Hairstyle', makeup: 'Lip colour', earring: 'Earring', stack: 'Earring stack', necklace: 'Necklace', ring: 'Ring', bracelet: 'Bracelet', watch: 'Watch' }
export function ProcessingStep({ steps, currentStepName, currentStepIndex, totalSteps, currentCopy, userPhotoUrl }: ProcessingStepProps) {
  return <section className="grid md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] min-h-[420px]">
    <div className="min-h-[320px] h-[min(65vh,720px)] bg-[var(--paper)]">{userPhotoUrl && <img src={userPhotoUrl} alt="Your photo while the preview is processing" className="w-full h-full object-contain opacity-70" />}</div>
    <div className="p-7 flex flex-col justify-center gap-5" role="status" aria-live="polite"><h2 className="font-display text-3xl">Preparing your preview.</h2><p>{labels[currentStepName || steps[currentStepIndex]] || 'YouCam'} · Step {Math.min(currentStepIndex+1,totalSteps)} of {totalSteps}</p><progress aria-label="Waiting for YouCam preview" className="w-full accent-[var(--gold)]" /><p className="text-[var(--ink-2)]">{currentCopy}</p><p className="text-sm text-[var(--ink-2)]">Rendering time varies. Refreshing this page resumes the same job.</p></div>
  </section>
}
