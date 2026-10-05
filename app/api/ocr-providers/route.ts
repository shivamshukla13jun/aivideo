import { NextResponse } from 'next/server';
import { canTranslate, listOcrProviders, pingPaddleOcr } from '@/lib/ocr';

export const dynamic = 'force-dynamic';

// GET /api/ocr-providers — OCR engine status (PaddleOCR sidecar health-checked live)
export async function GET() {
  const up = await pingPaddleOcr();
  const data = listOcrProviders().map((p) =>
    p.id === 'paddle' ? { ...p, available: up, note: up ? p.note : 'PaddleOCR service unreachable — run: docker compose up -d paddleocr' } : p
  );
  return NextResponse.json({ success: true, data, canTranslate: canTranslate() });
}
