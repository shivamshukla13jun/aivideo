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

import { generateAIText, aiConfigured } from '@/lib/ai';

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
      note: 'Hindi via Gemini or Ollama (pick in Settings), else OCR server /translate (free)',
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
    signal: AbortSignal.timeout(300000), // CPU OCR of a tall page (server models, many strips) can take minutes
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `PaddleOCR service error ${res.status}`);
  }
  return cleanLines(Array.isArray(json.lines) ? json.lines : []);
}

/* ------------------------------------------------------------------ */
/* Translation — Gemini (natural Mumbai-style Hindi) → OCR server      */
/* /translate (deep-translator, free, no key) as fallback              */
/* ------------------------------------------------------------------ */

/** Translation is always available: Gemini if a key is configured in Settings, else the OCR server. */
export function canTranslate() {
  return true;
}

/**
 * EN → HI via the active AI provider (Gemini or Ollama, picked in Settings):
 * natural conversational Hindi the way people actually speak in Mumbai —
 * casual friend-to-friend speech, Hinglish loanwords kept in Devanagari, and
 * anything that would sound forced in pure Hindi left untranslated.
 * Returns '' on failure so callers can fall back.
 */
async function translateHindiWithAI(text: string): Promise<string> {
  // Keys/provider live in the DB (managed at /settings) — generateAIText
  // returns '' when nothing is configured and callers fall back.
  if (!(await aiConfigured())) return '';

  const prompt = `You translate webtoon/manga dialogue for Hindi-speaking viewers. Rewrite the English text as natural, everyday Hindi the way people actually talk in Mumbai — casual, conversational, friend-to-friend speech (e.g. "क्या कर रहा है?", "कैसा है भाई?", "अरे चल चल जल्दी!", "मत कर ऐसा").

Rules:
- Output Devanagari script only.
- Spoken Hinglish flavour: everyday English loanwords stay as spoken, transliterated into Devanagari — "attack" → "अटैक", "plan" → "प्लान", "time" → "टाइम", "level" → "लेवल", "training" → "ट्रेनिंग".
- NO formal or literary Hindi — avoid words like अत्यंत, कृपया, अवसर, वर्तमान; say बहुत, भाई, मौका, अभी.
- If a word has no natural Hindi equivalent or would sound forced (character names, places, powers, technique names, brand/foreign words), do NOT translate it — keep it transliterated in Devanagari exactly as it's said (e.g. "Iron Fist" → "आयरन फिस्ट").
- Match the emotion and tone of each line — shouting, whispering, sarcasm, fear, excitement.
- Keep sentence order, line breaks, ellipses and punctuation.
- Output ONLY the Hindi text. No notes, no explanations.

Text:
${text}`;

  return generateAIText(prompt);
}

/** Translate text. EN→HI prefers Gemini (colloquial Mumbai Hindi); falls back to the OCR server's /translate. */
export async function translateText(text: string, target: 'hi' | 'en' = 'hi'): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';

  if (target === 'hi') {
    try {
      const hi = await translateHindiWithAI(clean);
      if (hi) return hi;
    } catch (e: any) {
      console.warn('[OCR] AI Hindi translation failed, falling back:', e?.message || e);
    }
  }

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

/** OCR only — English narration, no translation. */
export async function extractPageTextEn(
  input: string | Buffer,
  _provider: OcrProvider = 'paddle'
): Promise<{ provider: OcrProvider; raw: string; en: string }> {
  const buf = await loadImage(input);
  const lines = await paddleLines(buf);
  return { provider: 'paddle', raw: lines.join('\n'), en: toNarration(lines) };
}

export async function extractPageText(input: string | Buffer, _provider: OcrProvider = 'paddle'): Promise<OcrResult> {
  const { raw, en } = await extractPageTextEn(input, _provider);
  let hi = '';
  if (en) {
    try {
      hi = await translateText(en, 'hi');
    } catch (e: any) {
      console.warn('[OCR] Hindi translation failed:', e?.message || e);
    }
  }
  return { provider: 'paddle', raw, en, hi };
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
