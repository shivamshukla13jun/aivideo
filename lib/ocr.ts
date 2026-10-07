/**
 * OCR for webtoon pages — PaddleOCR only.
 *
 * Pages are POSTed to the self-hosted PaddleOCR service (docker-compose
 * `paddleocr` service, PADDLEOCR_URL, default http://localhost:5004) which
 * runs PP-OCRv5 server models on CPU (PADDLE_OCR_MODEL=mobile for the
 * lightweight tier), light-preprocesses the page, splits tall webtoon
 * strips, re-checks dark pages with an inverted pass, groups detections
 * into speech bubbles, and returns bubble text in reading order.
 *
 * Hindi translation is done by the same OCR server via /translate
 * (deep-translator, free, no API key needed).
 */

export type OcrProvider = 'paddle';

export interface OcrResult {
  provider: OcrProvider;
  /** Raw text as read from the page (reading order, one bubble per line). */
  raw: string;
  /** Cleaned English narration. */
  en: string;
  /** Hindi narration (Devanagari). */
  hi: string;
}

const paddleUrl = () => (process.env.PADDLEOCR_URL || 'http://localhost:5004').replace(/\/+$/, '');

export function listOcrProviders() {
  return [
    {
      id: 'paddle' as const,
      label: 'PaddleOCR (self-hosted, lightweight)',
      available: true,
      note: 'Hindi via OCR server /translate (free, no key needed)',
    },
  ];
}

export function isProviderAvailable(p: string): p is OcrProvider {
  return p === 'paddle';
}

/** True when the PaddleOCR sidecar is reachable. */
export async function pingPaddleOcr(): Promise<boolean> {
  try {
    const res = await fetch(`${paddleUrl()}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Text clean-up helpers                                               */
/* ------------------------------------------------------------------ */

// Watermark/site-promo detection — only match actual site references, not
// dialogue containing words like "scans" or "translate".
const WATERMARK = /(https?:\/\/|www\.|\w+\.(com|net|org|io|xyz|site|online|to|gg)\b|discord|patreon|ko-fi|translat(?:ed|ion)\s+by|scanlation|raw\s*provider|read\s+\w+\s+(?:at|on)\s+\w+\.)/i;

function isGarbage(line: string) {
  const t = line.trim();
  if (t.length < 2) return true;
  if (WATERMARK.test(t)) return true;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const nonSpace = t.replace(/\s/g, '').length || 1;
  if (letters / nonSpace < 0.6) return true;
  // Single short "words" made of random letters are mostly speed lines / art
  const words = t.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
  if (words.length === 0) return true;
  if (words.length === 1 && t.length < 4 && !/^(I|OK|NO|OH|AH|HM+|EH)\W*$/i.test(t)) return true;
  // Runs of 1–2 letter fragments ("N WU AN") are textures misread as text
  const tokens = t.split(/\s+/);
  const avgLen = tokens.reduce((s, w) => s + w.replace(/[^A-Za-z]/g, '').length, 0) / tokens.length;
  if (tokens.length >= 2 && avgLen < 2.5) return true;
  return false;
}

/** Comic lettering is mostly ALL CAPS — turn it into readable sentence case. */
function sentenceCase(text: string) {
  const letters = text.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '').length;
  if (!letters || upper / letters.length < 0.7) return text;
  return text
    .toLowerCase()
    .replace(/(^\s*|[.!?…]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\bi\b/g, 'I')
    .replace(/\bi'(m|ll|ve|d)\b/g, (_, s) => `I'${s}`);
}

function cleanLines(lines: string[]) {
  return lines
    .map((l) =>
      l
        .replace(/[|_~`^<>{}[\]\\]/g, ' ')
        // Common comic-font confusions: "...7" / "WHAT7" → "?", "NO1" → "!"
        .replace(/(\.{2,}|…|[A-Za-z])7(?=["'"')]?(\s|$))/g, '$1?')
        .replace(/([A-Za-z])1(?=["'"')]?(\s|$))/g, '$1!')
        // Trailing stray symbols left by bubble borders
        .replace(/(\s+[^A-Za-z0-9\s.,!?…'""'-]{1,3})+$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((l) => !isGarbage(l));
}

const toNarration = (lines: string[]) =>
  sentenceCase(
    lines
      .join(' ')
      .replace(/\s+([,.!?…])/g, '$1')
      .replace(/-\s+(?=[a-z])/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

/* ------------------------------------------------------------------ */
/* PaddleOCR sidecar                                                   */
/* ------------------------------------------------------------------ */

async function paddleLines(buf: Buffer): Promise<string[]> {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'application/octet-stream' }), 'page.png');
  const res = await fetch(`${paddleUrl()}/ocr`, {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(120000), // CPU OCR of a tall page can be slow
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `PaddleOCR service error ${res.status}`);
  }
  return cleanLines(Array.isArray(json.lines) ? json.lines : []);
}

/* ------------------------------------------------------------------ */
/* Translation (via OCR server /translate — free, no API key)          */
/* ------------------------------------------------------------------ */

/** Translation is always available since it uses the OCR server's /translate endpoint (deep-translator). */
export function canTranslate() {
  return true;
}

/** Translate text via the OCR server's /translate endpoint. */
export async function translateText(text: string, target: 'hi' | 'en' = 'hi'): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';

  const source = target === 'hi' ? 'en' : 'hi';
  const res = await fetch(`${paddleUrl()}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean, target, source }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `Translation service error ${res.status}`);
  }
  return (json.text || '').trim();
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

async function loadImage(input: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input;
  const res = await fetch(input, { headers: { Referer: new URL(input).origin } });
  if (!res.ok) throw new Error(`Failed to fetch image for OCR (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function extractPageText(input: string | Buffer, _provider: OcrProvider = 'paddle'): Promise<OcrResult> {
  const buf = await loadImage(input);
  const lines = await paddleLines(buf);
  const en = toNarration(lines);
  let hi = '';
  if (en) {
    try {
      hi = await translateText(en, 'hi');
    } catch (e: any) {
      console.warn('[OCR] Hindi translation failed:', e?.message || e);
    }
  }
  return { provider: 'paddle', raw: lines.join('\n'), en, hi };
}

/** Backwards-compatible helper: English text only, '' on failure. */
export async function extractTextFromImage(imageInput: string | Buffer): Promise<string> {
  try {
    return (await extractPageText(imageInput, 'paddle')).en;
  } catch (err) {
    console.warn('OCR extraction failed, keeping text empty:', err);
    return '';
  }
}
