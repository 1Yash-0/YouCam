import { NextRequest, NextResponse } from 'next/server';
import { youcam } from '@/lib/youcam';
import { getJson, putJson } from '@/lib/storage';
import { isFreshHairTemplateCache, normalizeHairTemplates } from '@/lib/hair-templates';

const HAIR_TEMPLATES_CACHE_KEY = 'hair-templates';

export async function GET(request: NextRequest) {
  void request;
  try {
    const cached = await getJson<unknown>(HAIR_TEMPLATES_CACHE_KEY);
    if (isFreshHairTemplateCache(cached)) {
      return NextResponse.json(cached.templates);
    }

    const response = await youcam.listHairTemplates({ limit: 20 });
    const templates = normalizeHairTemplates(response.templates);
    await putJson(HAIR_TEMPLATES_CACHE_KEY, { fetchedAt: Date.now(), templates });
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching hair templates:', error);
    return NextResponse.json(
      { error: 'Hair templates are temporarily unavailable' },
      { status: 503 }
    );
  }
}
