'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { StyleResult } from '@/lib/style'
import { StylingExtras } from './types'

type Lipstick = NonNullable<StylingExtras['lipstick']>
type HairTemplate = NonNullable<StylingExtras['hairUp']>

const SHADES = [
  { id: 'berry-satin', name: 'Berry', hex: '#9B1B30' },
  { id: 'classic-red', name: 'Ruby', hex: '#B22222' },
  { id: 'warm-nude', name: 'Nude', hex: '#C08081' },
  { id: 'plum-rich', name: 'Plum', hex: '#682860' },
]

const METAL_HEADING: Record<StyleResult['metal'], string> = {
  gold: 'Gold suits you',
  silver: 'Silver suits you',
  'rose gold': 'Rose gold suits you',
}

const SHADE_BUTTON = 'flex min-h-11 items-center gap-2 text-[15px] text-[var(--ink-2)] underline-offset-[6px] hover:text-[var(--ink)] aria-pressed:text-[var(--ink)] aria-pressed:underline aria-pressed:decoration-[var(--gold)] aria-pressed:decoration-2 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[var(--gold)]'

/** Shade name from the API, 'brick red', shown as 'Brick red'. */
const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

function shadeFromSuggestion(lipstick: StyleResult['lipstick']): Lipstick {
  return { id: lipstick.id, name: titleCase(lipstick.name), hex: lipstick.hex, texture: lipstick.texture, intensity: 80 }
}

/** The skin-tone read-out for one photo. `style` is null when the read failed. */
interface StyleReadout {
  photoId: string
  style: StyleResult | null
}

export interface CompleteTheLookProps {
  basicOnly?: boolean
  hidden?: boolean
  /** Personal photo id. Null for the sample face, which has no read-out. */
  photoId?: string | null
  extras: StylingExtras
  isRendering: boolean
  cachedPresets?: Set<string>
  hairTemplates?: HairTemplate[]
  isLoadingHairTemplates?: boolean
  onDraftChange?: (extras: StylingExtras) => void
  onRequestHairTemplates?: () => void
  onApplyStyling?: (extras: StylingExtras) => void
  onClearStyling?: () => void
  // Kept for callers compiled against the original component API.
  onToggleLipstick?: () => void
  onToggleHairUp?: () => void
  onToggleOutfit?: () => void
  onToggleStack?: () => void
  onSelectLipstickShade?: (shade: Lipstick) => void
}

export function CompleteTheLook({
  hidden = false,
  photoId = null,
  extras,
  isRendering,
  hairTemplates = [],
  isLoadingHairTemplates = false,
  onDraftChange,
  onRequestHairTemplates,
  onApplyStyling,
  onClearStyling,
}: CompleteTheLookProps) {
  const [draft, setDraft] = useState<StylingExtras>(extras)
  const [hairPickerOpen, setHairPickerOpen] = useState(false)
  const [readout, setReadout] = useState<StyleReadout | null>(null)
  const requestedFor = useRef<string | null>(null)
  const preselectedFor = useRef<string | null>(null)
  const lipstick = draft.lipstick

  useEffect(() => setDraft(extras), [extras])

  // Read the skin tone once per photo, the first time the panel opens.
  useEffect(() => {
    if (hidden || !photoId || requestedFor.current === photoId) return
    requestedFor.current = photoId
    fetch('/api/style', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Style request failed (${response.status})`)
        setReadout({ photoId, style: (await response.json()) as StyleResult })
      })
      .catch(() => setReadout({ photoId, style: null }))
  }, [hidden, photoId])

  // A read-out only applies to the photo on screen; a late reply for an earlier photo is ignored.
  const current = readout && photoId && readout.photoId === photoId ? readout : null
  const suggestion = current?.style ? shadeFromSuggestion(current.style.lipstick) : null

  // Preselect the suggested shade once per photo, without replacing a shade the shopper already chose.
  useEffect(() => {
    if (!current?.style || preselectedFor.current === current.photoId) return
    preselectedFor.current = current.photoId
    const next = shadeFromSuggestion(current.style.lipstick)
    setDraft((prev) => (prev.lipstick ? prev : { ...prev, lipstick: next }))
  }, [current])

  const update = (next: StylingExtras) => {
    setDraft(next)
    onDraftChange?.(next)
  }
  const setLipstick = (next: Lipstick | undefined) => update({ ...draft, lipstick: next })
  const selectShade = (shade: { id: string; name: string; hex: string; texture?: Lipstick['texture'] }) =>
    setLipstick({
      id: shade.id,
      name: shade.name,
      hex: shade.hex,
      texture: shade.texture ?? lipstick?.texture ?? 'satin',
      intensity: lipstick?.intensity ?? 80,
    })
  const requestHair = () => {
    setHairPickerOpen((open) => !open)
    if (!hairPickerOpen && hairTemplates.length === 0) onRequestHairTemplates?.()
  }
  const clearAll = () => {
    update({})
    onClearStyling?.()
  }

  const renderReadout = () => {
    if (!photoId || (current && !current.style)) {
      return <p className="text-[15px] text-[var(--ink-2)]">Skin tone unavailable for this photo.</p>
    }
    if (!current?.style) {
      return (
        <div role="status" className="flex items-center gap-3">
          <span className="h-7 w-7 rounded-full bg-[var(--line)]" aria-hidden="true" />
          <span className="sr-only">Reading your skin tone</span>
        </div>
      )
    }
    return (
      <div>
        <div className="flex items-center gap-3">
          <span className="h-7 w-7 rounded-full" style={{ backgroundColor: current.style.skinHex }} aria-hidden="true" />
          <p className="text-[15px] text-[var(--ink-2)]">Your skin tone (estimated from your photo)</p>
        </div>
        <p className="mt-4 font-display text-[22px] leading-tight text-[var(--ink)]">{METAL_HEADING[current.style.metal]}</p>
        <p className="mt-1 text-[15px] text-[var(--ink-2)]">{current.style.metalReason}</p>
      </div>
    )
  }

  return (
    <section hidden={hidden} className="pt-4" aria-label="Optional styling">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-[var(--ink)]">Optional styling</h3>
        {isRendering && <span className="text-sm text-[var(--gold)]" role="status">Applying styling…</span>}
      </div>
      <p className="mt-1 text-sm text-[var(--ink-2)]">Choose a finish for your preview. Your jewellery size stays the same.</p>

      <div className="mt-5">{renderReadout()}</div>

      <div className="mt-5 space-y-5">
        <div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={Boolean(lipstick)} disabled={isRendering} onChange={(event) => {
              if (!event.target.checked) setLipstick(undefined)
              else if (!lipstick) setLipstick(suggestion ?? { id: 'berry-satin', name: 'Berry', hex: '#9B1B30', texture: 'satin', intensity: 80 })
            }} className="accent-[var(--gold)]" />
            <span className="font-medium">Lip colour</span>
            <span className="text-[var(--ink-2)]">Optional</span>
          </label>
          {lipstick && <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[15px] text-[var(--ink-2)]">Shade</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {suggestion && <button type="button" disabled={isRendering} aria-pressed={lipstick.id === suggestion.id} aria-label={`${suggestion.name} lipstick shade, suggested`} onClick={() => selectShade(suggestion)} className={SHADE_BUTTON}>
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: suggestion.hex }} aria-hidden="true" />
                  {suggestion.name}
                  <span className="flex items-center gap-1 text-[13px] text-[var(--ink-2)]">
                    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7.5 5.5 11 12 3" stroke="var(--gold)" strokeWidth="2" fill="none" /></svg>
                    Suggested
                  </span>
                </button>}
                {SHADES.map((shade) => <button key={shade.id} type="button" disabled={isRendering} aria-pressed={lipstick.id === shade.id} aria-label={`${shade.name} lipstick shade`} onClick={() => selectShade(shade)} className={SHADE_BUTTON}>
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: shade.hex }} aria-hidden="true" />{shade.name}
                </button>)}
                <label className="flex min-h-11 items-center gap-2 text-[15px] text-[var(--ink-2)] focus-within:text-[var(--ink)]">
                  <input aria-label="Custom lipstick colour" type="color" value={/^#[0-9a-f]{6}$/i.test(lipstick.hex) ? lipstick.hex : '#9B1B30'} disabled={isRendering} onChange={(event) => setLipstick({ ...lipstick, id: 'custom', name: 'Custom', hex: event.target.value })} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" />Custom
                </label>
              </div>
            </fieldset>
            <label className="grid gap-1 text-sm text-[var(--ink-2)]">Strength <span className="text-[var(--ink)]">{lipstick.intensity}%</span>
              <input type="range" min="0" max="100" step="1" value={lipstick.intensity} disabled={isRendering} onChange={(event) => setLipstick({ ...lipstick, intensity: Number(event.target.value) })} aria-label="Lip colour strength" className="accent-[var(--gold)]" />
            </label>
            <label className="grid gap-1 text-sm text-[var(--ink-2)]">Finish
              <select value={lipstick.texture} disabled={isRendering} onChange={(event) => setLipstick({ ...lipstick, texture: event.target.value as Lipstick['texture'] })} className="min-h-10 border border-[var(--line)] bg-[var(--paper)] px-3 text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
                <option value="matte">Matte</option><option value="satin">Satin</option><option value="gloss">Gloss</option><option value="shimmer">Shimmer</option>
              </select>
            </label>
          </div>}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium text-[var(--ink)]">Hair</p><p className="text-sm text-[var(--ink-2)]">Optional preview styling</p></div>
            <button type="button" disabled={isRendering} onClick={requestHair} aria-expanded={hairPickerOpen} className="min-h-10 border border-[var(--line)] px-3 text-sm hover:border-[var(--gold)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{draft.hairUp ? 'Change style' : 'Choose style'}</button>
          </div>
          {draft.hairUp && <p className="mt-2 text-sm text-[var(--ink)]">Selected: {draft.hairUp.title} <button type="button" disabled={isRendering} className="link-draw ml-2" onClick={() => update({ ...draft, hairUp: undefined })}>Remove</button></p>}
          {hairPickerOpen && <div className="mt-3">
            {isLoadingHairTemplates ? <p className="text-sm text-[var(--ink-2)]" role="status">Loading available styles…</p> : hairTemplates.length ? <div className="flex flex-wrap gap-2">{hairTemplates.map((template) => <button key={template.templateId} type="button" disabled={isRendering} aria-pressed={draft.hairUp?.templateId === template.templateId} onClick={() => update({ ...draft, hairUp: template })} className="min-h-10 border border-[var(--line)] px-3 text-sm aria-pressed:border-[var(--gold)] aria-pressed:bg-[var(--paper)]">{template.title}</button>)}</div> : <p className="text-sm text-[var(--ink-2)]">No hair styles are available right now.</p>}
          </div>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={clearAll} disabled={isRendering || (!draft.lipstick && !draft.hairUp && !draft.outfit && !draft.stack?.length)} className="link-draw min-h-10 text-[15px] text-[var(--ink-2)] disabled:opacity-45">Clear styling</button>
        <button type="button" onClick={() => onApplyStyling?.(draft)} disabled={isRendering || !onApplyStyling} className="h-11 bg-[var(--ink)] px-6 text-[15px] text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] disabled:opacity-50">Apply styling</button>
      </div>
    </section>
  )
}
