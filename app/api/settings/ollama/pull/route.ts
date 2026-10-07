import { NextRequest, NextResponse } from 'next/server';
import { beginPull, updatePull, endPull } from '@/lib/ollama';

export const dynamic = 'force-dynamic';

const ollamaUrl = () =>
  (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');

/**
 * POST /api/settings/ollama/pull { model }
 * Streams Ollama's NDJSON pull progress straight through to the client so the
 * UI can render a live progress bar, and records each event in the shared
 * pull-progress tracker (visible to status pollers too).
 */
export async function POST(req: NextRequest) {
  try {
    const { model } = await req.json();
    const name = String(model || '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'model is required' }, { status: 400 });
    }

    const upstream = await fetch(`${ollamaUrl()}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });
    if (!upstream.ok || !upstream.body) {
      const msg = await upstream.text().catch(() => `ollama ${upstream.status}`);
      return NextResponse.json(
        { success: false, error: msg.slice(0, 300) },
        { status: 502 }
      );
    }

    beginPull(name);
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    let buf = '';
    let pullError: string | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value, { stream: true });
            controller.enqueue(enc.encode(chunk)); // forward live to the client
            buf += chunk;
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const p = JSON.parse(line);
                updatePull(name, p);
                if (p.error) pullError = p.error;
              } catch {
                // ignore malformed progress lines
              }
            }
          }
          endPull(name, pullError);
          controller.close();
        } catch (e: any) {
          endPull(name, e?.message || String(e));
          controller.error(e);
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
