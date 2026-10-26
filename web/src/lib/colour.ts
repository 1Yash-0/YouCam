/**
 * Color science utilities for sRGB ↔ CIELAB ↔ LCH ↔ CIEDE2000
 * References:
 * - CIELAB: CIE 1976 L*a*b* color space
 * - LCH: CIE L*C*h° cylindrical representation
 * - CIEDE2000: Sharma, Wu & Dalal (2005)
 */

// Configuration constants (exported for reference)
export const config = {
  undertoneThresholds: {
    warm: 60,  // degrees, stylist convention
    cool: 45,  // degrees, stylist convention
  } as const,
  label: 'stylist convention' as const,
};

// Helper: hex to normalized RGB [0,1]
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16) / 255;
    const g = parseInt(h[1] + h[1], 16) / 255;
    const b = parseInt(h[2] + h[2], 16) / 255;
    return [r, g, b];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return [r, g, b];
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

// sRGB to linear RGB (inverse gamma correction)
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Linear RGB to sRGB (gamma correction)
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// sRGB to XYZ (D65 illuminant)
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // Convert to linear
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  
  // sRGB to XYZ matrix (D65)
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  
  return [x, y, z];
}

// XYZ to CIELAB (D65 white point)
function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  // D65 reference white
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;
  
  // Normalize by white point
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  
  return [L, a, b];
}

function f(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) ? Math.pow(t, 1 / 3) : t / (3 * delta * delta) + 4 / 29;
}

// CIELAB to LCH
export function labToLch(L: number, a: number, b: number): { L: number; C: number; h: number } {
  const C = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { L, C, h };
}

// Complete conversion: hex → sRGB → XYZ → CIELAB → LCH
export function hexToLab(hex: string): { L: number; a: number; b: number } {
  const [r, g, b] = hexToRgb(hex);
  const [x, y, z] = rgbToXyz(r, g, b);
  const [L, a, bLab] = xyzToLab(x, y, z);
  return { L, a, b: bLab };
}

export function hexToLch(hex: string): { L: number; C: number; h: number } {
  const { L, a, b } = hexToLab(hex);
  return labToLch(L, a, b);
}

// CIEDE2000 color difference
export function deltaE2000(
  lab1: { L: number; a: number; b: number },
  lab2: { L: number; a: number; b: number }
): number {
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;
  
  // Weighting factors (default 1,1,1)
  const kL = 1.0, kC = 1.0, kH = 1.0;
  
  // Step 1: Calculate C' and h'
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  
  const h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  const h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  
  // Step 2: ΔL', ΔC', ΔH'
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  
  let dh = h2p - h1p;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * Math.PI / 360);
  
  // Step 3: Weighting functions
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  
  let hbar = h1p + h2p;
  if (Math.abs(h1p - h2p) > 180) {
    hbar += 360;
  }
  hbar /= 2;
  
  const T = 1 -
    0.17 * Math.cos((hbar - 30) * Math.PI / 180) +
    0.24 * Math.cos(2 * hbar * Math.PI / 180) +
    0.32 * Math.cos((3 * hbar + 6) * Math.PI / 180) -
    0.20 * Math.cos((4 * hbar - 63) * Math.PI / 180);
  
  const dTheta = 30 * Math.exp(-Math.pow((hbar - 275) / 25, 2));
  
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  
  const SL = 1 + (0.015 * Math.pow(Lbar - 50, 2)) / Math.sqrt(20 + Math.pow(Lbar - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  
  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;
  
  // Step 4: Final ΔE00
  const term1 = dLp / (kL * SL);
  const term2 = dCp / (kC * SC);
  const term3 = dHp / (kH * SH);
  
  return Math.sqrt(
    term1 * term1 +
    term2 * term2 +
    term3 * term3 +
    RT * term2 * term3
  );
}

// Convenience function for hex colors
export function deltaE2000Hex(hex1: string, hex2: string): number {
  const lab1 = hexToLab(hex1);
  const lab2 = hexToLab(hex2);
  return deltaE2000(lab1, lab2);
}