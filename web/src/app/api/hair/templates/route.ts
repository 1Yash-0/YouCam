import { NextRequest, NextResponse } from 'next/server';
import { youcam } from '@/lib/youcam';
import { getJson, putJson } from '@/lib/storage';

// Hair template type
type HairTemplate = {
  id: string;
  title: string;
  thumb: string;
  keepsColour: boolean;
};

// Cache key for hair templates
const HAIR_TEMPLATES_CACHE_KEY = 'hair-templates';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Filter regex for bun/braid/ponytail/updo/tied
const HAIR_STYLE_REGEX = /bun|braid|ponytail|updo|tied/i;

export async function GET(request: NextRequest) {
  try {
    // Check cache
    const cached = await getJson<HairTemplate[]>(HAIR_TEMPLATES_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    // In a real implementation, we would paginate through up to 5 pages
    // For now, we'll return fake data to avoid actual API calls
    // Real implementation would be:
    // let allTemplates: HairTemplate[] = [];
    // let startingToken: string | undefined;
    // 
    // for (let page = 0; page < 5; page++) {
    //   const response = await youcam.listHairTemplates({
    //     startingToken,
    //     limit: 100,
    //   });
    //   
    //   allTemplates = [...allTemplates, ...response.templates];
    //   startingToken = response.startingToken;
    //   
    //   if (!startingToken) break;
    // }
    
    // Generate fake templates for testing
    const fakeTemplates: HairTemplate[] = [
      { id: 'bun-01', title: 'Elegant High Bun', thumb: 'https://example.com/bun1.jpg', keepsColour: true },
      { id: 'braid-01', title: 'French Braid Style', thumb: 'https://example.com/braid1.jpg', keepsColour: true },
      { id: 'ponytail-01', title: 'Sleek Ponytail', thumb: 'https://example.com/ponytail1.jpg', keepsColour: false },
      { id: 'updo-01', title: 'Classic Updo', thumb: 'https://example.com/updo1.jpg', keepsColour: true },
      { id: 'tied-01', title: 'Half Up Tied', thumb: 'https://example.com/tied1.jpg', keepsColour: false },
      { id: 'bun-02', title: 'Messy Bun', thumb: 'https://example.com/bun2.jpg', keepsColour: true },
      { id: 'braid-02', title: 'Dutch Braid', thumb: 'https://example.com/braid2.jpg', keepsColour: true },
      { id: 'ponytail-02', title: 'Low Ponytail', thumb: 'https://example.com/ponytail2.jpg', keepsColour: false },
    ];
    
    // Filter templates matching the regex
    const filteredTemplates = fakeTemplates.filter(template =>
      HAIR_STYLE_REGEX.test(template.id) || HAIR_STYLE_REGEX.test(template.title)
    );
    
    // Cache for 24 hours (note: putJson doesn't have TTL, cache invalidation would need different approach)
    await putJson(HAIR_TEMPLATES_CACHE_KEY, filteredTemplates);
    
    return NextResponse.json(filteredTemplates);
    
  } catch (error) {
    console.error('Error fetching hair templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}