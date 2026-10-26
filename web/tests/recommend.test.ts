import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the dependencies
vi.mock('@/lib/colour', () => ({
  hexToLch: vi.fn(),
  deltaE2000Hex: vi.fn(),
  config: {
    undertoneThresholds: { warm: 60, cool: 45 },
    label: 'stylist convention',
  },
}));

vi.mock('@/lib/youcam');
vi.mock('@/lib/storage');

describe('Recommendation APIs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/recommend/metal', () => {
    it('should recommend gold when zari is gold', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockReturnValue({ L: 50, C: 30, h: 45 });
      
      const { POST } = await import('@/app/api/recommend/metal/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/metal', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', zari: 'gold' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metal).toBe('gold');
      expect(data.undertone).toBe('warm');
      expect(data.reason).toBe('matches the zari');
      expect(data.label).toBe('stylist convention');
    });

    it('should recommend silver when zari is silver', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockReturnValue({ L: 50, C: 30, h: 45 });
      
      const { POST } = await import('@/app/api/recommend/metal/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/metal', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', zari: 'silver' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metal).toBe('silver');
      expect(data.undertone).toBe('cool');
      expect(data.reason).toBe('matches the zari');
    });

    it('should recommend gold for warm undertone (hue >= 60)', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockReturnValue({ L: 50, C: 30, h: 65 });
      
      const { POST } = await import('@/app/api/recommend/metal/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/metal', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', zari: 'none' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metal).toBe('gold');
      expect(data.undertone).toBe('warm');
      expect(data.reason).toBe('undertone: warm');
    });

    it('should recommend silver for cool undertone (hue < 45)', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockReturnValue({ L: 50, C: 30, h: 40 });
      
      const { POST } = await import('@/app/api/recommend/metal/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/metal', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', zari: 'none' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metal).toBe('silver');
      expect(data.undertone).toBe('cool');
      expect(data.reason).toBe('undertone: cool');
    });

    it('should recommend rose gold for neutral undertone (45 <= hue < 60)', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockReturnValue({ L: 50, C: 30, h: 50 });
      
      const { POST } = await import('@/app/api/recommend/metal/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/metal', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', zari: 'none' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metal).toBe('rose gold');
      expect(data.undertone).toBe('neutral');
      expect(data.reason).toBe('undertone: neutral');
    });

    it('should return 400 for invalid hex', async () => {
      const { POST } = await import('@/app/api/recommend/metal/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/metal', {
        method: 'POST',
        body: JSON.stringify({ skinHex: 'invalid' }),
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/recommend/lipstick', () => {
    beforeEach(async () => {
      const { hexToLch, deltaE2000Hex } = await import('@/lib/colour');
      
      // Default mock for hexToLch
      vi.mocked(hexToLch).mockImplementation((hex) => {
        // Return different values based on input
        if (hex === '#FF0000') return { L: 50, C: 60, h: 30 }; // Red outfit
        if (hex === '#E0E0E0') return { L: 85, C: 5, h: 0 };  // Pastel outfit
        if (hex === '#0000FF') return { L: 50, C: 40, h: 240 }; // Blue outfit
        return { L: 50, C: 30, h: 50 }; // Default skin
      });
      
      // Mock deltaE2000Hex to return predictable values
      vi.mocked(deltaE2000Hex).mockImplementation((hex1, hex2) => {
        if (hex2 === '#C06C84') return 12; // rose
        if (hex2 === '#D8A1A4') return 18; // nude pink
        if (hex2 === '#7B1E3A') return 25; // berry
        if (hex2 === '#B5562F') return 20; // terracotta
        return 15; // default
      });
    });

    it('should recommend brick red for red family outfit with warm undertone', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockImplementation((hex) => {
        if (hex === '#FF0000') return { L: 50, C: 40, h: 10 }; // Red outfit with high chroma
        return { L: 50, C: 30, h: 65 }; // Warm skin
      });
      
      const { POST } = await import('@/app/api/recommend/lipstick/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/lipstick', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', outfitHex: '#FF0000' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.id).toBe('brick-red');
      expect(data.name).toBe('brick red');
      expect(data.reason).toContain('red family outfit + warm undertone');
    });

    it('should recommend blue red for red family outfit with cool undertone', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockImplementation((hex) => {
        if (hex === '#FF0000') return { L: 50, C: 40, h: 10 }; // Red outfit
        return { L: 50, C: 30, h: 40 }; // Cool skin
      });
      
      const { POST } = await import('@/app/api/recommend/lipstick/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/lipstick', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', outfitHex: '#FF0000' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.id).toBe('blue-red');
      expect(data.reason).toContain('red family outfit + cool undertone');
    });

    it('should recommend true red for red family outfit with neutral undertone', async () => {
      const { hexToLch } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockImplementation((hex) => {
        if (hex === '#FF0000') return { L: 50, C: 40, h: 10 }; // Red outfit
        return { L: 50, C: 30, h: 50 }; // Neutral skin
      });
      
      const { POST } = await import('@/app/api/recommend/lipstick/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/lipstick', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', outfitHex: '#FF0000' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.id).toBe('true-red');
      expect(data.reason).toContain('red family outfit + neutral undertone');
    });

    it('should select between rose and nude pink for pastel outfit', async () => {
      const { hexToLch, deltaE2000Hex } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockImplementation((hex) => {
        if (hex === '#E0E0E0') return { L: 85, C: 5, h: 0 }; // Pastel outfit
        return { L: 50, C: 30, h: 50 }; // Neutral skin
      });
      
      // Mock deltaE values: rose=12 (<15), nude pink=18 (>=15 and closest to 15)
      vi.mocked(deltaE2000Hex).mockImplementation((hex1, hex2) => {
        if (hex2 === '#C06C84') return 12; // rose
        if (hex2 === '#D8A1A4') return 18; // nude pink
        return 15;
      });
      
      const { POST } = await import('@/app/api/recommend/lipstick/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/lipstick', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', outfitHex: '#E0E0E0' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(['rose', 'nude-pink']).toContain(data.id);
      expect(data.reason).toContain('pastel outfit');
      expect(data.deltaE).toBeGreaterThan(0);
    });

    it('should pick max deltaE among berry/terracotta/rose for other outfits', async () => {
      const { hexToLch, deltaE2000Hex } = await import('@/lib/colour');
      vi.mocked(hexToLch).mockImplementation((hex) => {
        if (hex === '#0000FF') return { L: 50, C: 40, h: 240 }; // Blue outfit
        return { L: 50, C: 30, h: 50 }; // Neutral skin
      });
      
      // berry=25, terracotta=20, rose=12 -> should pick berry
      vi.mocked(deltaE2000Hex).mockImplementation((hex1, hex2) => {
        if (hex2 === '#7B1E3A') return 25; // berry
        if (hex2 === '#B5562F') return 20; // terracotta
        if (hex2 === '#C06C84') return 12; // rose
        return 15;
      });
      
      const { POST } = await import('@/app/api/recommend/lipstick/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/lipstick', {
        method: 'POST',
        body: JSON.stringify({ skinHex: '#FFCCAA', outfitHex: '#0000FF' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.id).toBe('berry');
      expect(data.reason).toContain('max ΔE among berry/terracotta/rose');
      expect(data.deltaE).toBe(25);
    });

    it('should return 400 for invalid hex', async () => {
      const { POST } = await import('@/app/api/recommend/lipstick/route');
      
      const request = new NextRequest('http://localhost:3000/api/recommend/lipstick', {
        method: 'POST',
        body: JSON.stringify({ skinHex: 'invalid', outfitHex: '#000000' }),
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});