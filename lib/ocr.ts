/**
 * OCR for webtoon pages — PaddleOCR only.
 *
 * Pages are POSTed to the self-hosted PaddleOCR service (docker-compose
 * `paddleocr` service, PADDLEOCR_URL, default http://localhost:5004) which
 * runs the lightweight PP-OCR mobile models on CPU, groups detections into
 * speech bubbles, and returns bubble text in reading order.
 *
 * Hindi narration still comes from translateText() (Gemini or Google
 * Translate — whichever key is configured); it stays empty if neither is.
 */

export type OcrProvider = 'paddle';

export interface OcrResult {
  provider: OcrProvider;
  /** Raw text as read from the page (reading order, one bubble per line). */
  raw: string;
  /** Cleaned English narration. */
  en: string;
  /** Hindi narration (Devanagari); '' when no translator is configured. */
  hi: string;
}

const paddleUrl = () => (process.env.PADDLEOCR_URL || 'http://localhost:5004').replace(/\/+$/, '');
const geminiKey = () => process.env.GEMINI_API_KEY?.trim() || '';
const googleKey = () => (process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_CLOUD_API_KEY || '').trim();
const GEMINI_MODEL = process.env.GEMINI_OCR_MODEL?.trim() || 'gemini-2.5-flash';

export function listOcrProviders() {
  return [
    {
      id: 'paddle' as const,
      label: 'PaddleOCR (self-hosted, lightweight)',
      available: true,
      note: geminiKey() || googleKey() ? 'Hindi via translation API' : 'No translator configured — Hindi left empty',
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

const WATERMARK = /(https?:\/\/|www\.|\.(com|net|org|io|xyz|site|online|to|gg)\b|scans?\b|discord|patreon|translat(or|ed by)|raw provider)/i;

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
        .replace(/(\.{2,}|…|[A-Za-z])7(?=["'”’)]?(\s|$))/g, '$1?')
        .replace(/([A-Za-z])1(?=["'”’)]?(\s|$))/g, '$1!')
        // Trailing stray symbols left by bubble borders
        .replace(/(\s+[^A-Za-z0-9\s.,!?…'"”’-]{1,3})+$/g, '')
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
/* Translation (Hindi)                                                 */
/* ------------------------------------------------------------------ */

export function canTranslate() {
  return Boolean(geminiKey() || googleKey());
}

async function geminiJson<T>(parts: any[], schema: any): Promise<T> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: geminiKey() });
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
  });
  const text = (result.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(text) as T;
}

/** Translate English narration to Hindi (Devanagari) with whichever service is configured. */
export async function translateText(text: string, target: 'hi' | 'en' = 'hi'): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';

  if (geminiKey()) {
    const { Type } = await import('@google/genai');
    const langPrompt =
      target === 'hi'
        ? `Translate this manga/webtoon narration into natural, everyday spoken Hindi (Devanagari script).

Rules:
- Sound like a real person talking casually, NOT like a textbook or Google Translate.
- Use the kind of Hindi people actually speak — mix in common Hinglish words if it sounds more natural (e.g. "fight", "power", "attack" can stay in English).
- Keep character names, place names, and technique names unchanged.
- Use conversational tone: "यार", "भाई", "अरे" type expressions where they fit the mood.
- Match the emotion — if the original is intense, keep it intense; if funny, keep it funny.
- Keep it suitable for a YouTube voice-over narration.
- Do NOT add extra commentary or explanations — just translate what's there.`
        : `Translate this into natural, fluent English suitable for voice-over narration. Keep names unchanged.`;
    const out = await geminiJson<{ text: string }>(
      [
        {
          text: `${langPrompt}\n\nReturn JSON {"text": "..."}.\n\n${clean}`,
        },
      ],
      { type: Type.OBJECT, properties: { text: { type: Type.STRING } }, required: ['text'] }
    );
    return (out.text || '').trim();
  }

  if (googleKey()) {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(googleKey())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: clean, target, format: 'text' }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `Translate API error ${res.status}`);
    return String(json.data?.translations?.[0]?.translatedText || '').trim();
  }

  return '';
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
  if (en && canTranslate()) {
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
