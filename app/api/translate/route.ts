import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/ocr';

export const dynamic = 'force-dynamic';

// POST /api/translate { text, target: 'hi' | 'en' } — narration translation via OCR server
export async function POST(req: NextRequest) {
  try {
    const { text, target } = await req.json();
    const translated = await translateText(String(text || ''), target === 'en' ? 'en' : 'hi');
    return NextResponse.json({ success: true, data: { text: translated } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
