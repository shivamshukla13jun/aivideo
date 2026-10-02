import { NextRequest, NextResponse } from 'next/server';
import { canTranslate, translateText } from '@/lib/ocr';

export const dynamic = 'force-dynamic';

// POST /api/translate { text, target: 'hi' | 'en' } — narration translation
export async function POST(req: NextRequest) {
  try {
    const { text, target } = await req.json();
    if (!canTranslate()) {
      return NextResponse.json(
        { success: false, error: 'No translator configured — set GEMINI_API_KEY or GOOGLE_CLOUD_API_KEY in .env' },
        { status: 400 }
      );
    }
    const translated = await translateText(String(text || ''), target === 'en' ? 'en' : 'hi');
    return NextResponse.json({ success: true, data: { text: translated } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
