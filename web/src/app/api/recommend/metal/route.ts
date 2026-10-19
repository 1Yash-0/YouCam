import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hexToLch, config } from '@/lib/colour';

const RequestSchema = z.object({
  skinHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  zari: z.enum(['gold', 'silver', 'none']).optional().default('none'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skinHex, zari } = RequestSchema.parse(body);
    
    // Get skin color in LCH
    const { L, C, h: hueDeg } = hexToLch(skinHex);
    
    let metal: 'gold' | 'silver' | 'rose gold';
    let undertone: 'warm' | 'cool' | 'neutral';
    let reason: string;
    
    if (zari === 'gold' || zari === 'silver') {
      metal = zari;
      undertone = zari === 'gold' ? 'warm' : 'cool';
      reason = 'matches the zari';
    } else {
      // Determine undertone from hue angle
      if (hueDeg >= config.undertoneThresholds.warm) {
        undertone = 'warm';
        metal = 'gold';
      } else if (hueDeg < config.undertoneThresholds.cool) {
        undertone = 'cool';
        metal = 'silver';
      } else {
        undertone = 'neutral';
        metal = 'rose gold';
      }
      reason = `undertone: ${undertone}`;
    }
    
    return NextResponse.json({
      metal,
      undertone,
      reason,
      numbers: { L, a: 0, b: 0, hueDeg }, // Note: a and b are 0 in LCH hue representation
      label: config.label,
    });
    
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