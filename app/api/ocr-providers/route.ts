import { NextResponse } from 'next/server';
import { canTranslate, listOcrProviders } from '@/lib/ocr';

export const dynamic = 'force-dynamic';

// GET /api/ocr-providers — which OCR engines are configured on this server
export async function GET() {
  return NextResponse.json({ success: true, data: listOcrProviders(), canTranslate: canTranslate() });
}
