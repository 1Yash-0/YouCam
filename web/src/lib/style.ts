import { hexToLch, deltaE2000Hex, config } from '@/lib/colour'
import lipsticksJson from '../../data/lipsticks.json'

/**
 * Style it: pure metal and lipstick decisions from a skin colour.
 * The recommend routes and POST /api/style all use these functions, so the rules live in one place.
 * Nothing here does I/O.
 */

export type Undertone = 'warm' | 'cool' | 'neutral'
export type Metal = 'gold' | 'silver' | 'rose gold'
export type Zari = 'gold' | 'silver' | 'none'

export interface Lipstick {
  id: string
  name: string
  hex: string
  texture: 'matte' | 'satin'
}

export interface MetalRecommendation {
  metal: Metal
  undertone: Undertone
  reason: string
  numbers: { L: number; a: number; b: number; hueDeg: number }
  label: string
}

export interface LipstickRecommendation extends Lipstick {
  reason: string
  deltaE: number
  label: string
}

export interface StyleResult {
  skinHex: string
  undertone: Undertone
  metal: Metal
  metalReason: string
  lipstick: Lipstick
}

/** Outfit assumed when none is known. A neutral grey takes the default lipstick rule. */
export const NEUTRAL_OUTFIT_HEX = '#808080'

const LIPSTICKS = lipsticksJson as Lipstick[]

const byId = (id: string) => LIPSTICKS.find((lipstick) => lipstick.id === id)!

function normalizeHue(h: number): number {
  return (h + 360) % 360
}

function isRedFamily(hue: number, chroma: number): boolean {
  const normalizedHue = normalizeHue(hue)
  return (
    ((normalizedHue >= 340 && normalizedHue < 360) ||
     (normalizedHue >= 0 && normalizedHue < 20)) &&
    chroma >= 30
  )
}

function isPastel(L: number, chroma: number): boolean {
  return L >= 75 && chroma < 25
}

function undertoneFromHue(hueDeg: number): Undertone {
  if (hueDeg >= config.undertoneThresholds.warm) return 'warm'
  if (hueDeg < config.undertoneThresholds.cool) return 'cool'
  return 'neutral'
}

/** Metal from the skin's undertone, or from the zari colour when the outfit has one. */
export function recommendMetal(skinHex: string, zari: Zari = 'none'): MetalRecommendation {
  const { L, h: hueDeg } = hexToLch(skinHex)

  let metal: Metal
  let undertone: Undertone
  let reason: string

  if (zari === 'gold' || zari === 'silver') {
    metal = zari
    undertone = zari === 'gold' ? 'warm' : 'cool'
    reason = 'matches the zari'
  } else {
    undertone = undertoneFromHue(hueDeg)
    metal = undertone === 'warm' ? 'gold' : undertone === 'cool' ? 'silver' : 'rose gold'
    reason = `undertone: ${undertone}`
  }

  return {
    metal,
    undertone,
    reason,
    numbers: { L, a: 0, b: 0, hueDeg }, // a and b are 0 because only the LCH hue is used
    label: config.label,
  }
}

/** Lipstick shade for a skin and outfit colour. */
export function recommendLipstick(skinHex: string, outfitHex: string): LipstickRecommendation {
  const outfitLch = hexToLch(outfitHex)
  const undertone = undertoneFromHue(hexToLch(skinHex).h)

  let selectedLipstick: Lipstick
  let reason = ''
  let deltaE = 0

  // Rule 1: red family outfit
  if (isRedFamily(outfitLch.h, outfitLch.C)) {
    if (undertone === 'warm') {
      selectedLipstick = byId('brick-red')
      reason = 'red family outfit + warm undertone'
    } else if (undertone === 'cool') {
      selectedLipstick = byId('blue-red')
      reason = 'red family outfit + cool undertone'
    } else {
      selectedLipstick = byId('true-red')
      reason = 'red family outfit + neutral undertone'
    }
  }
  // Rule 2: pastel outfit
  else if (isPastel(outfitLch.L, outfitLch.C)) {
    const rose = byId('rose')
    const nudePink = byId('nude-pink')

    const deltaERose = deltaE2000Hex(skinHex, rose.hex)
    const deltaENudePink = deltaE2000Hex(skinHex, nudePink.hex)

    // Closest to ΔE 15 among those at or above 15
    const candidates = [
      { lipstick: rose, deltaE: deltaERose },
      { lipstick: nudePink, deltaE: deltaENudePink },
    ].filter((candidate) => candidate.deltaE >= 15)

    if (candidates.length > 0) {
      candidates.sort((a, b) => Math.abs(a.deltaE - 15) - Math.abs(b.deltaE - 15))
      selectedLipstick = candidates[0].lipstick
      deltaE = candidates[0].deltaE
      reason = `pastel outfit, closest to ΔE=15 (${candidates[0].deltaE.toFixed(1)})`
    } else if (deltaERose > deltaENudePink) {
      // Neither reaches ΔE 15: take the larger difference
      selectedLipstick = rose
      deltaE = deltaERose
      reason = `pastel outfit, larger ΔE (${deltaERose.toFixed(1)} vs ${deltaENudePink.toFixed(1)})`
    } else {
      selectedLipstick = nudePink
      deltaE = deltaENudePink
      reason = `pastel outfit, larger ΔE (${deltaENudePink.toFixed(1)} vs ${deltaERose.toFixed(1)})`
    }
  }
  // Rule 3: default, the largest ΔE among berry, terracotta and rose
  else {
    const candidates = ['berry', 'terracotta', 'rose']
      .map((id) => byId(id))
      .map((lipstick) => ({ lipstick, deltaE: deltaE2000Hex(skinHex, lipstick.hex) }))

    candidates.sort((a, b) => b.deltaE - a.deltaE)
    selectedLipstick = candidates[0].lipstick
    deltaE = candidates[0].deltaE
    reason = `max ΔE among berry/terracotta/rose (${deltaE.toFixed(1)})`
  }

  return {
    id: selectedLipstick.id,
    name: selectedLipstick.name,
    hex: selectedLipstick.hex,
    texture: selectedLipstick.texture,
    reason,
    deltaE,
    label: config.label,
  }
}

// Plain-language reasons for shoppers. The API reason strings above stay technical.
const METAL_REASON: Record<Undertone, string> = {
  warm: 'Warm undertone. Gold flatters you most.',
  cool: 'Cool undertone. Silver flatters you most.',
  neutral: 'Neutral undertone. Rose gold flatters you most.',
}

/** Metal and lipstick for a skin colour, with a neutral outfit unless one is given. */
export function styleFromSkin(skinHex: string, outfitHex: string = NEUTRAL_OUTFIT_HEX): StyleResult {
  const metal = recommendMetal(skinHex)
  const lipstick = recommendLipstick(skinHex, outfitHex)
  return {
    skinHex,
    undertone: metal.undertone,
    metal: metal.metal,
    metalReason: METAL_REASON[metal.undertone],
    lipstick: { id: lipstick.id, name: lipstick.name, hex: lipstick.hex, texture: lipstick.texture },
  }
}
