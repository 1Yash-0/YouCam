import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the dependencies
vi.mock('@/lib/youcam', () => ({
  youcam: {
    createSkinToneTask: vi.fn(),
    listHairTemplates: vi.fn(),
  },
}));

vi.mock('@/lib/storage', () => ({
  getJson: vi.fn(),
  putJson: vi.fn(),
}));

vi.mock('@/lib/errors', () => ({
  AppError: class AppError extends Error {
    constructor(
      public code: string,
      message: string,
      public httpStatus: number = 500,
      public userMessage?: string
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
  ErrorCodes: {
    INPUT_ERROR: 'INPUT_ERROR',
  },
}));

describe('Analysis and Hair APIs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/analyse/skin-tone', () => {
    it('should return cached skin tone analysis', async () => {
      const { getJson } = await import('@/lib/storage');
      vi.mocked(getJson).mockResolvedValue({
        skinHex: '#F5D0C5',
        lipHex: '#C1121F',
        eyeHex: '#4A2C2A',
        hairHex: '#3D2B1F',
      });
      
      const { POST } = await import('@/app/api/analyse/skin-tone/route');
      
      const request = new NextRequest('http://localhost:3000/api/analyse/skin-tone', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'test-photo-123' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.skinHex).toBe('#F5D0C5');
      expect(data.lipHex).toBe('#C1121F');
      expect(data.eyeHex).toBe('#4A2C2A');
      expect(data.hairHex).toBe('#3D2B1F');
      expect(getJson).toHaveBeenCalledWith('skin-tone:test-photo-123');
    });

    it('should return FACE_NOT_FRONTAL for face angle errors', async () => {
      const { getJson } = await import('@/lib/storage');
      vi.mocked(getJson).mockResolvedValue(null);
      
      const { POST } = await import('@/app/api/analyse/skin-tone/route');
      
      const request = new NextRequest('http://localhost:3000/api/analyse/skin-tone', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'photo_with_face_angle_error' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('FACE_NOT_FRONTAL');
      expect(data.message).toBe('Face the camera straight on, chin level.');
    });

    it('should return fake result when no cache', async () => {
      const { getJson, putJson } = await import('@/lib/storage');
      vi.mocked(getJson).mockResolvedValue(null);
      const mockPutJson = vi.mocked(putJson);
      
      const { POST } = await import('@/app/api/analyse/skin-tone/route');
      
      const request = new NextRequest('http://localhost:3000/api/analyse/skin-tone', {
        method: 'POST',
        body: JSON.stringify({ photoId: 'new-photo-456' }),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.skinHex).toBe('#F5D0C5');
      expect(data.lipHex).toBe('#C1121F');
      expect(data.eyeHex).toBe('#4A2C2A');
      expect(data.hairHex).toBe('#3D2B1F');
      expect(mockPutJson).toHaveBeenCalled();
    });

    it('should return 400 for invalid request', async () => {
      const { POST } = await import('@/app/api/analyse/skin-tone/route');
      
      const request = new NextRequest('http://localhost:3000/api/analyse/skin-tone', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/hair/templates', () => {
    it('should return cached hair templates', async () => {
      const { getJson } = await import('@/lib/storage');
      const mockTemplates = [
        { id: 'bun-01', title: 'Elegant High Bun', thumb: 'url1', keepsColour: true },
        { id: 'braid-01', title: 'French Braid', thumb: 'url2', keepsColour: true },
      ];
      vi.mocked(getJson).mockResolvedValue(mockTemplates);
      
      const { GET } = await import('@/app/api/hair/templates/route');
      
      const request = new NextRequest('http://localhost:3000/api/hair/templates');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual(mockTemplates);
      expect(getJson).toHaveBeenCalledWith('hair-templates');
    });

    it('should return filtered fake templates when no cache', async () => {
      const { getJson, putJson } = await import('@/lib/storage');
      vi.mocked(getJson).mockResolvedValue(null);
      const mockPutJson = vi.mocked(putJson);
      
      const { GET } = await import('@/app/api/hair/templates/route');
      
      const request = new NextRequest('http://localhost:3000/api/hair/templates');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      
      // Should only return templates matching bun|braid|ponytail|updo|tied
      data.forEach((template: any) => {
        const matches = 
          /bun|braid|ponytail|updo|tied/i.test(template.id) ||
          /bun|braid|ponytail|updo|tied/i.test(template.title);
        expect(matches).toBe(true);
      });
      
      expect(mockPutJson).toHaveBeenCalled();
    });

    it('should return filtered templates only', async () => {
      const { getJson, putJson } = await import('@/lib/storage');
      vi.mocked(getJson).mockResolvedValue(null);
      const mockPutJson = vi.mocked(putJson);
      
      const { GET } = await import('@/app/api/hair/templates/route');
      
      const request = new NextRequest('http://localhost:3000/api/hair/templates');
      
      const response = await GET(request);
      const data = await response.json();
      
      // Count how many templates we got
      const templateCount = data.length;
      
      // Verify all templates match the filter
      data.forEach((template: any) => {
        const idMatch = /bun|braid|ponytail|updo|tied/i.test(template.id);
        const titleMatch = /bun|braid|ponytail|updo|tied/i.test(template.title);
        expect(idMatch || titleMatch).toBe(true);
      });
      
      // We should have some templates (at least the ones from fake data that match)
      expect(templateCount).toBeGreaterThan(0);
    });
  });
});