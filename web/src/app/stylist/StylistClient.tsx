'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PillButton } from '@/components/PillButton'
import { useToast } from '@/components/Toast'

// Benchmark Indian Skin Undertones
const SKIN_SWATCHES = [
  { label: 'Fair Warm / Peach', hex: '#E8B896', undertone: 'Warm (h ≥ 60°)' },
  { label: 'Medium Neutral / Wheatish', hex: '#D49E7C', undertone: 'Neutral (45°–60°)' },
  { label: 'Cool Beige / Olive', hex: '#C58F80', undertone: 'Cool (h < 45°)' },
  { label: 'Deep Warm / Mocha', hex: '#A86F4C', undertone: 'Deep Neutral-Warm' },
]

// Zari embroidery options
const ZARI_OPTIONS = [
  { label: 'Gold Zari', value: 'gold' as const, hex: '#B08A3E' },
  { label: 'Silver Zari', value: 'silver' as const, hex: '#A0A0A0' },
  { label: 'Pure Fabric (No Zari)', value: 'none' as const, hex: '#666666' },
]

// Indian festive and bridal attire fabrics
const FABRIC_SWATCHES = [
  { label: 'Royal Navy Silk', hex: '#0A192F', desc: 'Deep evening silk' },
  { label: 'Crimson / Bridal Red', hex: '#900C3F', desc: 'Traditional red silk' },
  { label: 'Emerald Green', hex: '#0D5C3A', desc: 'Jewel tone silk' },
  { label: 'Pastel Rose Chanderi', hex: '#E0C0C8', desc: 'Light celebratory pastel' },
  { label: 'Ivory / Raw Silk', hex: '#F5F2EB', desc: 'Neutral festive silk' },
  { label: 'Marigold Festive', hex: '#E5A93C', desc: 'Warm radiant silk' },
]

interface MetalRecommendation {
  metal: 'gold' | 'silver' | 'rose gold'
  undertone: 'warm' | 'cool' | 'neutral'
  reason: string
  numbers?: {
    L: number
    a: number
    b: number
    hueDeg: number
  }
}

interface LipstickRecommendation {
  id: string
  name: string
  hex: string
  texture: string
  reason: string
  deltaE: number
}

export function StylistClient() {
  const { showToast } = useToast()

  // State
  const [selectedSkinHex, setSelectedSkinHex] = useState('#E8B896')
  const [customSkinHex, setCustomSkinHex] = useState('')
  const [selectedZari, setSelectedZari] = useState<'gold' | 'silver' | 'none'>('none')
  const [selectedOutfitHex, setSelectedOutfitHex] = useState('#0A192F')
  const [customOutfitHex, setCustomOutfitHex] = useState('')

  // Recommendation State
  const [metalRec, setMetalRec] = useState<MetalRecommendation | null>(null)
  const [lipstickRec, setLipstickRec] = useState<LipstickRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingLook, setSavingLook] = useState(false)
  const [savedLookId, setSavedLookId] = useState<string | null>(null)
  const [scienceExpanded, setScienceExpanded] = useState(false)

  // Query recommendation endpoints
  const fetchRecommendations = useCallback(
    async (skin: string, zari: 'gold' | 'silver' | 'none', outfit: string) => {
      // Validate hex
      const hexPattern = /^#[0-9A-Fa-f]{6}$/
      if (!hexPattern.test(skin) || !hexPattern.test(outfit)) {
        return
      }

      setLoading(true)
      try {
        const [metalRes, lipstickRes] = await Promise.all([
          fetch('/api/recommend/metal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skinHex: skin, zari }),
          }),
          fetch('/api/recommend/lipstick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skinHex: skin, outfitHex: outfit }),
          }),
        ])

        if (metalRes.ok) {
          const mData = await metalRes.json()
          setMetalRec(mData)
        }

        if (lipstickRes.ok) {
          const lData = await lipstickRes.json()
          setLipstickRec(lData)
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchRecommendations(selectedSkinHex, selectedZari, selectedOutfitHex)
  }, [selectedSkinHex, selectedZari, selectedOutfitHex, fetchRecommendations])

  // Custom Skin Hex Input Handler
  const handleCustomSkinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let hex = customSkinHex.trim()
    if (!hex.startsWith('#')) hex = '#' + hex
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setSelectedSkinHex(hex.toUpperCase())
      setCustomSkinHex('')
    } else {
      showToast({
        message: 'Please enter a valid 6-character hex code (e.g. #D49E7C)',
        variant: 'warn',
      })
    }
  }

  // Custom Outfit Hex Input Handler
  const handleCustomOutfitSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let hex = customOutfitHex.trim()
    if (!hex.startsWith('#')) hex = '#' + hex
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setSelectedOutfitHex(hex.toUpperCase())
      setCustomOutfitHex('')
    } else {
      showToast({
        message: 'Please enter a valid 6-character hex code (e.g. #900C3F)',
        variant: 'warn',
      })
    }
  }

  // Save current look via POST /api/looks
  const handleSaveLook = async () => {
    const metalName = metalRec?.metal || 'gold'
    const lipstickData = lipstickRec || {
      id: 'brick-red',
      name: 'Brick Red / Zari Crimson',
      hex: '#9B1B30',
      texture: 'matte',
    }

    setSavingLook(true)
    try {
      const res = await fetch('/api/looks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: 'single-earring',
          productId: 'gilded-teardrop',
          sizeCm: 3.0,
          options: {
            metal: metalName,
            lipstick: {
              id: lipstickData.id,
              name: lipstickData.name,
              hex: lipstickData.hex,
              texture: lipstickData.texture,
            },
          },
        }),
      })

      const data = await res.json()
      if (res.ok && data.lookId) {
        setSavedLookId(data.lookId)
        showToast({
          message: 'Stylist look saved! Permalink created.',
          variant: 'gold',
        })
      } else {
        showToast({
          message: data.message || 'Failed to save look.',
          variant: 'warn',
        })
      }
    } catch (err: any) {
      showToast({
        message: err.message || 'Network error saving look.',
        variant: 'warn',
      })
    } finally {
      setSavingLook(false)
    }
  }

  const matchingProductId = 'gilded-teardrop'
  const recommendedMetal = metalRec?.metal || 'gold'
  const recommendedLipstickHex = lipstickRec?.hex || '#9B1B30'
  const tryOnDeepLink = `/p/${matchingProductId}?tryon=1&metal=${recommendedMetal}&lipstick=${encodeURIComponent(
    recommendedLipstickHex
  )}`

  return (
    <div className="space-y-12">
      {/* 2-Step Interactive Swatch Selectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Skin Undertone Selection */}
        <div className="p-7 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="ui-label text-[10px] text-[var(--gold)]">STEP 01</span>
              <span className="text-xs font-mono text-[var(--ink-2)]">{selectedSkinHex}</span>
            </div>
            <h2 className="text-xl font-medium text-[var(--ink)] mb-2">
              Skin Undertone Calibration
            </h2>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-6">
              Select your natural skin undertone from scientifically benchmarked Indian complexion swatches or input a custom hex value.
            </p>

            {/* Benchmark Swatches */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {SKIN_SWATCHES.map((swatch) => {
                const isSelected = selectedSkinHex.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setSelectedSkinHex(swatch.hex)}
                    className={`flex flex-col items-center p-3 rounded-[var(--radius-sm)] border transition-all text-center focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer ${
                      isSelected
                        ? 'border-[var(--gold)] bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]'
                        : 'border-[var(--line)] bg-white/40 dark:bg-black/20 hover:border-[var(--ink-2)]'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full border border-black/15 shadow-inner mb-2"
                      style={{ backgroundColor: swatch.hex }}
                      title={swatch.label}
                    />
                    <span className="text-xs font-medium text-[var(--ink)] line-clamp-1">
                      {swatch.label.split('/')[0]}
                    </span>
                    <span className="text-[10px] text-[var(--ink-2)] mt-0.5">
                      {swatch.undertone}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Hex Input */}
          <form onSubmit={handleCustomSkinSubmit} className="pt-4 border-t border-[var(--line)] flex items-center gap-2">
            <label htmlFor="custom-skin-input" className="ui-label text-[10px] text-[var(--ink-2)] shrink-0">
              Custom Hex:
            </label>
            <input
              id="custom-skin-input"
              type="text"
              value={customSkinHex}
              onChange={(e) => setCustomSkinHex(e.target.value)}
              placeholder="#E8B896"
              className="w-28 px-2.5 py-1 text-xs font-mono bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
            />
            <button
              type="submit"
              className="ui-label text-[10px] px-3 py-1 rounded bg-[var(--ink)] text-white hover:bg-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer"
            >
              APPLY
            </button>
          </form>
        </div>

        {/* Step 2: Outfit Fabric & Zari Selection */}
        <div className="p-7 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="ui-label text-[10px] text-[var(--gold)]">STEP 02</span>
              <span className="text-xs font-mono text-[var(--ink-2)]">{selectedOutfitHex}</span>
            </div>
            <h2 className="text-xl font-medium text-[var(--ink)] mb-2">
              Attire Fabric & Zari Accent
            </h2>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-5">
              Select your celebratory garment fabric and metallic Zari embroidery to harmonize metals and lipstick contrast.
            </p>

            {/* Zari Selector */}
            <div className="mb-5">
              <span className="ui-label text-[10px] text-[var(--ink-2)] block mb-2">
                Zari Thread Accent:
              </span>
              <div className="flex flex-wrap gap-2">
                {ZARI_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedZari(opt.value)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ui-label text-[11px] border transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer ${
                      selectedZari === opt.value
                        ? 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)] font-medium'
                        : 'border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/20"
                      style={{ backgroundColor: opt.hex }}
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fabric Swatches */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
              {FABRIC_SWATCHES.map((fab) => {
                const isSelected = selectedOutfitHex.toLowerCase() === fab.hex.toLowerCase()
                return (
                  <button
                    key={fab.hex}
                    type="button"
                    onClick={() => setSelectedOutfitHex(fab.hex)}
                    className={`flex items-center gap-2.5 p-2 rounded-[var(--radius-sm)] border transition-all text-left focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer ${
                      isSelected
                        ? 'border-[var(--gold)] bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]'
                        : 'border-[var(--line)] bg-white/40 dark:bg-black/20 hover:border-[var(--ink-2)]'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full border border-black/15 shrink-0 shadow-inner"
                      style={{ backgroundColor: fab.hex }}
                    />
                    <div className="overflow-hidden">
                      <div className="text-xs font-medium text-[var(--ink)] truncate">
                        {fab.label.split('/')[0]}
                      </div>
                      <div className="text-[9px] text-[var(--ink-2)] truncate font-mono">
                        {fab.hex}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Fabric Hex Input */}
          <form onSubmit={handleCustomOutfitSubmit} className="pt-4 border-t border-[var(--line)] flex items-center gap-2">
            <label htmlFor="custom-outfit-input" className="ui-label text-[10px] text-[var(--ink-2)] shrink-0">
              Custom Fabric Hex:
            </label>
            <input
              id="custom-outfit-input"
              type="text"
              value={customOutfitHex}
              onChange={(e) => setCustomOutfitHex(e.target.value)}
              placeholder="#0A192F"
              className="w-28 px-2.5 py-1 text-xs font-mono bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
            />
            <button
              type="submit"
              className="ui-label text-[10px] px-3 py-1 rounded bg-[var(--ink)] text-white hover:bg-[var(--gold)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer"
            >
              APPLY
            </button>
          </form>
        </div>
      </div>

      {/* Dynamic Recommendation Results Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div>
            <span className="ui-label text-[10px] text-[var(--gold)] block">COLOR HARMONY MATRIX</span>
            <h2 className="text-2xl font-light tracking-tight text-[var(--ink)]">
              Stylist <span className="font-serif-italic">Recommendations</span>
            </h2>
          </div>
          {loading && (
            <span className="ui-label text-[10px] text-[var(--gold)] animate-pulse">
              RE-CALCULATING METRICS…
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Precious Metal Harmony Card */}
          <div className="p-7 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] shadow-xs flex flex-col justify-between">
            <div>
              <span className="ui-label text-[10px] text-[var(--gold)] block mb-1">
                JEWELLERY HARMONY
              </span>
              <h3 className="text-2xl font-light text-[var(--ink)] mb-2 capitalize">
                {metalRec?.metal === 'gold'
                  ? '18k Yellow Gold'
                  : metalRec?.metal === 'silver'
                  ? 'Sterling Silver'
                  : 'Rose Gold'}
              </h3>

              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] ui-label bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 capitalize">
                  {metalRec?.undertone || 'warm'} undertone
                </span>
                {selectedZari !== 'none' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] ui-label bg-black/5 dark:bg-white/5 text-[var(--ink-2)] border border-[var(--line)] capitalize">
                    {selectedZari} Zari alignment
                  </span>
                )}
              </div>

              <p className="text-sm text-[var(--ink-2)] leading-relaxed mb-6">
                {metalRec?.reason
                  ? `Stylist rationale: ${metalRec.reason}. ${
                      metalRec.metal === 'gold'
                        ? 'Warm golden tones illuminate warm complexions and resonate with antique embroidery.'
                        : 'Cool metallic luster balances cool undertones and crisp silver embroidery.'
                    }`
                  : 'Analyzing color temperature and undertone hue…'}
              </p>
            </div>

            {/* Curated Piece Preview */}
            <div className="p-4 rounded-[var(--radius-sm)] bg-white/40 dark:bg-black/20 border border-[var(--line)] flex items-center gap-4">
              <div className="relative w-14 h-14 rounded border border-[var(--line)] bg-white overflow-hidden shrink-0">
                <Image
                  src="/products/gilded-teardrop.png"
                  alt="Gilded Teardrop"
                  fill
                  unoptimized
                  className="object-contain p-1"
                />
              </div>
              <div className="flex-1">
                <span className="ui-label text-[9px] text-[var(--gold)] block">
                  RECOMMENDED ATELIER PIECE
                </span>
                <div className="text-sm font-medium text-[var(--ink)]">Gilded Teardrop (3.0 cm)</div>
                <div className="text-xs text-[var(--ink-2)]">₹1,499 · 18k Yellow Gold Finish</div>
              </div>
            </div>
          </div>

          {/* Lipstick Shade Harmony Card */}
          <div className="p-7 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] shadow-xs flex flex-col justify-between">
            <div>
              <span className="ui-label text-[10px] text-[var(--gold)] block mb-1">
                LIP COLOUR HARMONY
              </span>
              <h3 className="text-2xl font-light text-[var(--ink)] mb-2 capitalize">
                {lipstickRec?.name || 'Brick Red / Zari Crimson'}
              </h3>

              <div className="flex items-center gap-2 mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] ui-label bg-black/5 dark:bg-white/5 text-[var(--ink)] border border-[var(--line)] uppercase">
                  {lipstickRec?.texture || 'MATTE'} FINISH
                </span>
                {lipstickRec?.deltaE !== undefined && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] ui-label bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                    ΔE {lipstickRec.deltaE.toFixed(1)} CONTRAST
                  </span>
                )}
              </div>

              <p className="text-sm text-[var(--ink-2)] leading-relaxed mb-6">
                {lipstickRec?.reason
                  ? `Stylist rationale: ${lipstickRec.reason}. Formulated for optical balance with your attire.`
                  : 'Evaluating CIEDE2000 contrast against skin and outfit coordinates…'}
              </p>
            </div>

            {/* Lipstick Shade Swatch */}
            <div className="p-4 rounded-[var(--radius-sm)] bg-white/40 dark:bg-black/20 border border-[var(--line)] flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full border border-black/20 shadow-md shrink-0"
                style={{ backgroundColor: lipstickRec?.hex || '#9B1B30' }}
              />
              <div>
                <span className="ui-label text-[9px] text-[var(--gold)] block">
                  CALIBRATED LIP COLOUR
                </span>
                <div className="text-sm font-medium text-[var(--ink)] capitalize">
                  {lipstickRec?.name || 'Curated Red'}
                </div>
                <div className="text-xs font-mono text-[var(--ink-2)] uppercase">
                  {lipstickRec?.hex || '#9B1B30'} · {lipstickRec?.texture || 'satin'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Color Science Inspector (Expandable Accordion) */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] overflow-hidden">
          <button
            type="button"
            onClick={() => setScienceExpanded(!scienceExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between text-left focus-visible:outline-2 focus-visible:outline-[var(--gold)] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-serif-italic text-[var(--gold)]">✦</span>
              <span className="ui-label text-xs text-[var(--ink)]">
                COLOR SCIENCE & CIEDE2000 MATHEMATICS
              </span>
            </div>
            <span className="ui-label text-xs text-[var(--gold)]">
              {scienceExpanded ? 'HIDE −' : 'EXPLORE SCIENCE +'}
            </span>
          </button>

          {scienceExpanded && (
            <div className="px-6 pb-6 pt-2 border-t border-[var(--line)] text-xs text-[var(--ink-2)] space-y-3 leading-relaxed">
              <p>
                Darpan computes color harmony via <strong>CIE L*a*b*</strong> and <strong>LCH</strong> colorimetric spaces. Skin hex codes are converted from sRGB to linear RGB, projected onto the CIE XYZ D65 illuminant, and resolved into lightness (L*), chroma (C*), and hue angle (h° = atan2(b*, a*) × 180 / π).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                <div className="p-3 bg-white/40 dark:bg-black/20 rounded border border-[var(--line)]">
                  <div className="ui-label text-[9px] text-[var(--ink)]">WARM UNDERTONE</div>
                  <div className="font-mono text-xs text-[var(--gold)] mt-1">h ≥ 60.0°</div>
                  <div className="text-[10px] mt-1">Recommends 18k Yellow Gold</div>
                </div>
                <div className="p-3 bg-white/40 dark:bg-black/20 rounded border border-[var(--line)]">
                  <div className="ui-label text-[9px] text-[var(--ink)]">NEUTRAL UNDERTONE</div>
                  <div className="font-mono text-xs text-[var(--gold)] mt-1">45.0° ≤ h &lt; 60.0°</div>
                  <div className="text-[10px] mt-1">Recommends Rose Gold</div>
                </div>
                <div className="p-3 bg-white/40 dark:bg-black/20 rounded border border-[var(--line)]">
                  <div className="ui-label text-[9px] text-[var(--ink)]">COOL UNDERTONE</div>
                  <div className="font-mono text-xs text-[var(--gold)] mt-1">h &lt; 45.0°</div>
                  <div className="text-[10px] mt-1">Recommends Sterling Silver</div>
                </div>
              </div>
              <p>
                Lipstick contrast is optimized using the <strong>CIEDE2000 (ΔE)</strong> color difference standard. For pastel ensembles, candidates closest to $\Delta E = 15$ are selected to prevent facial washout; for deep evening fabrics, maximum perceptible contrast is delivered.
              </p>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-4 pt-4">
          <PillButton
            href={tryOnDeepLink}
            variant="primary"
            className="cursor-pointer"
          >
            USE IN TRY-ON
          </PillButton>

          <PillButton
            onClick={handleSaveLook}
            variant="secondary"
            disabled={savingLook}
            className="cursor-pointer"
          >
            {savingLook ? 'SAVING LOOK…' : 'SAVE THIS LOOK'}
          </PillButton>

          {savedLookId && (
            <Link
              href={`/look/${savedLookId}`}
              className="ui-label text-xs text-[var(--gold)] hover:underline ml-auto flex items-center gap-1"
            >
              VIEW SAVED PERMALINK (#{savedLookId}) →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
