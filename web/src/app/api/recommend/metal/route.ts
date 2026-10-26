import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recommendMetal } from '@/lib/style';

const RequestSchema = z.object({
  skinHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  zari: z.enum(['gold', 'silver', 'none']).optional().default('none'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skinHex, zari } = RequestSchema.parse(body);
    return NextResponse.json(recommendMetal(skinHex, zari));
  } catch (error) {
    console.error('Error in metal recommendation:', error);
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
