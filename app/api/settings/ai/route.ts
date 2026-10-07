import { NextRequest, NextResponse } from 'next/server';
import { getAiProvider, setAiProvider } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/** GET /api/settings/ai — { provider: 'gemini' | 'ollama' } */
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: { provider: await getAiProvider() } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

/** POST /api/settings/ai — { provider: 'gemini' | 'ollama' } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = body.provider === 'ollama' ? 'ollama' : 'gemini';
    await setAiProvider(provider);
    return NextResponse.json({ success: true, data: { provider } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
