import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hexToLch, deltaE2000Hex, config } from '@/lib/colour';

const RequestSchema = z.object({
  skinHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  outfitHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

type Lipstick = {
  id: string;
  name: string;
  hex: string;
  texture: string;
};

const LIPSTICKS: Lipstick[] = [
  { id: 'brick-red', name: 'brick red', hex: '#A23B2A', texture: 'matte' },
  { id: 'blue-red', name: 'blue red', hex: '#A1001E', texture: 'matte' },
  { id: 'true-red', name: 'true red', hex: '#C1121F', texture: 'satin' },
  { id: 'berry', name: 'berry', hex: '#7B1E3A', texture: 'satin' },
  { id: 'rose', name: 'rose', hex: '#C06C84', texture: 'satin' },
  { id: 'nude-pink', name: 'nude pink', hex: '#D8A1A4', texture: 'satin' },
  { id: 'nude-caramel', name: 'nude caramel', hex: '#B07D62', texture: 'matte' },
  { id: 'terracotta', name: 'terracotta', hex: '#B5562F', texture: 'matte' },
];

function normalizeHue(h: number): number {
  return (h + 360) % 360;
}

function isRedFamily(hue: number, chroma: number): boolean {
  const normalizedHue = normalizeHue(hue);
  return (
    ((normalizedHue >= 340 && normalizedHue < 360) ||
     (normalizedHue >= 0 && normalizedHue < 20)) &&
    chroma >= 30
  );
}

function isPastel(L: number, chroma: number): boolean {
  return L >= 75 && chroma < 25;
}

function getUndertone(hueDeg: number): 'warm' | 'cool' | 'neutral' {
  if (hueDeg >= config.undertoneThresholds.warm) {
    return 'warm';
  } else if (hueDeg < config.undertoneThresholds.cool) {
    return 'cool';
  } else {
    return 'neutral';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skinHex, outfitHex } = RequestSchema.parse(body);
    
    // Get outfit color characteristics
    const outfitLch = hexToLch(outfitHex);
    const outfitHue = outfitLch.h;
    const outfitChroma = outfitLch.C;
    const outfitLightness = outfitLch.L;
    
    // Get skin undertone
    const skinLch = hexToLch(skinHex);
    const undertone = getUndertone(skinLch.h);
    
    let selectedLipstick: Lipstick | null = null;
    let reason = '';
    let deltaE = 0;
    
    // Rule 1: Red family outfit
    if (isRedFamily(outfitHue, outfitChroma)) {
      if (undertone === 'warm') {
        selectedLipstick = LIPSTICKS.find(l => l.id === 'brick-red')!;
        reason = 'red family outfit + warm undertone';
      } else if (undertone === 'cool') {
        selectedLipstick = LIPSTICKS.find(l => l.id === 'blue-red')!;
        reason = 'red family outfit + cool undertone';
      } else {
        selectedLipstick = LIPSTICKS.find(l => l.id === 'true-red')!;
        reason = 'red family outfit + neutral undertone';
      }
    }
    // Rule 2: Pastel outfit
    else if (isPastel(outfitLightness, outfitChroma)) {
      const rose = LIPSTICKS.find(l => l.id === 'rose')!;
      const nudePink = LIPSTICKS.find(l => l.id === 'nude-pink')!;
      
      const deltaERose = deltaE2000Hex(skinHex, rose.hex);
      const deltaENudePink = deltaE2000Hex(skinHex, nudePink.hex);
      
      // Find lipstick with deltaE >= 15 and closest to 15
      const candidates = [
        { lipstick: rose, deltaE: deltaERose },
        { lipstick: nudePink, deltaE: deltaENudePink },
      ].filter(c => c.deltaE >= 15);
      
      if (candidates.length > 0) {
        candidates.sort((a, b) => Math.abs(a.deltaE - 15) - Math.abs(b.deltaE - 15));
        selectedLipstick = candidates[0].lipstick;
        deltaE = candidates[0].deltaE;
        reason = `pastel outfit, closest to ΔE=15 (${candidates[0].deltaE.toFixed(1)})`;
      } else {
        // Neither meets threshold, pick larger deltaE
        if (deltaERose > deltaENudePink) {
          selectedLipstick = rose;
          deltaE = deltaERose;
          reason = `pastel outfit, larger ΔE (${deltaERose.toFixed(1)} vs ${deltaENudePink.toFixed(1)})`;
        } else {
          selectedLipstick = nudePink;
          deltaE = deltaENudePink;
          reason = `pastel outfit, larger ΔE (${deltaENudePink.toFixed(1)} vs ${deltaERose.toFixed(1)})`;
        }
      }
    }
    // Rule 3: Default - max deltaE among berry, terracotta, rose
    else {
      const candidates = ['berry', 'terracotta', 'rose']
        .map(id => LIPSTICKS.find(l => l.id === id)!)
        .map(lipstick => ({
          lipstick,
          deltaE: deltaE2000Hex(skinHex, lipstick.hex),
        }));
      
      candidates.sort((a, b) => b.deltaE - a.deltaE);
      selectedLipstick = candidates[0].lipstick;
      deltaE = candidates[0].deltaE;
      reason = `max ΔE among berry/terracotta/rose (${deltaE.toFixed(1)})`;
    }
    
    return NextResponse.json({
      id: selectedLipstick.id,
      name: selectedLipstick.name,
      hex: selectedLipstick.hex,
      texture: selectedLipstick.texture,
      reason,
      deltaE,
      label: config.label,
    });
    
  } catch (error) {
    console.error('Error in lipstick recommendation:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}