import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recommendLipstick } from '@/lib/style';

const RequestSchema = z.object({
  skinHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  outfitHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skinHex, outfitHex } = RequestSchema.parse(body);
    return NextResponse.json(recommendLipstick(skinHex, outfitHex));
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
