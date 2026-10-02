/**
 * OCR providers for webtoon pages.
 *
 *  - tesseract (default, offline): pre-processed with sharp, tall pages split
 *    into tiles at blank rows, sparse-text mode for speech bubbles, low
 *    confidence / garbage / watermark lines dropped.
 *  - gemini: Gemini vision reads bubbles in reading order and returns English
 *    + Hindi in one call (needs GEMINI_API_KEY).
 *  - google-vision: Google Cloud Vision DOCUMENT_TEXT_DETECTION
 *    (needs GOOGLE_VISION_API_KEY or GOOGLE_CLOUD_API_KEY).
 *
 * Every provider returns English narration text and a Hindi version. Providers
 * that cannot translate themselves use translateText() (Gemini or Google
 * Translate, whichever is configured); Hindi stays empty if neither is.
 */

import sharp from 'sharp';
import type { Worker } from 'tesseract.js';

export type OcrProvider = 'tesseract' | 'gemini' | 'google-vision';

export interface OcrResult {
  provider: OcrProvider;
  /** Raw text as read from the page (reading order, one bubble per line). */
  raw: string;
  /** Cleaned English narration. */
  en: string;
  /** Hindi narration (Devanagari); '' when no translator is configured. */
  hi: string;
}

const geminiKey = () => process.env.GEMINI_API_KEY?.trim() || '';
const googleKey = () => (process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_CLOUD_API_KEY || '').trim();
const GEMINI_MODEL = process.env.GEMINI_OCR_MODEL?.trim() || 'gemini-2.5-flash';

export function listOcrProviders() {
  return [
    {
      id: 'tesseract' as const,
      label: 'Tesseract (offline, default)',
      available: true,
      note: geminiKey() || googleKey() ? 'Hindi via translation API' : 'No translator configured — Hindi left empty',
    },
    {
      id: 'gemini' as const,
      label: 'Gemini Vision (best for comics)',
      available: Boolean(geminiKey()),
      note: geminiKey() ? 'Reads bubbles + writes English & Hindi' : 'Set GEMINI_API_KEY in .env',
    },
    {
      id: 'google-vision' as const,
      label: 'Google Cloud Vision',
      available: Boolean(googleKey()),
      note: googleKey() ? 'High-accuracy OCR + Google Translate' : 'Set GOOGLE_VISION_API_KEY in .env',
    },
  ];
}

export function isProviderAvailable(p: string): p is OcrProvider {
  return listOcrProviders().some((x) => x.id === p && x.available);
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
/* Image preparation                                                   */
/* ------------------------------------------------------------------ */

/** Normalised greyscale PNG tiles; tall pages are cut at blank rows so bubbles are never sliced. */
async function prepareTiles(buf: Buffer, targetWidth: number, maxTileHeight: number): Promise<Buffer[]> {
  const base = sharp(buf).flatten({ background: '#ffffff' }).greyscale();
  const meta = await sharp(buf).metadata();
  const w = meta.width || targetWidth;
  const scale = Math.min(2.5, Math.max(0.5, targetWidth / w));
  const resized = await base
    .resize({ width: Math.round(w * scale), kernel: 'lanczos3' })
    .normalise()
    .sharpen()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const W = info.width;
  const H = info.height;
  const rowBlank = (y: number) => {
    let min = 255;
    let max = 0;
    for (let x = 0; x < W; x += 2) {
      const v = data[y * W * info.channels + x * info.channels];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return max - min < 40;
  };

  const cuts = [0];
  while (H - cuts[cuts.length - 1] > maxTileHeight) {
    const ideal = cuts[cuts.length - 1] + maxTileHeight;
    let cut = ideal;
    for (let d = 0; d < maxTileHeight * 0.3; d++) {
      if (ideal - d > cuts[cuts.length - 1] + 50 && rowBlank(ideal - d)) {
        cut = ideal - d;
        break;
      }
    }
    cuts.push(cut);
  }
  cuts.push(H);

  const tiles: Buffer[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const top = cuts[i];
    const height = cuts[i + 1] - top;
    if (height < 10) continue;
    tiles.push(
      await sharp(data, { raw: { width: W, height: H, channels: info.channels } })
        .extract({ left: 0, top, width: W, height })
        .png()
        .toBuffer()
    );
  }
  return tiles;
}

/* ------------------------------------------------------------------ */
/* Tesseract                                                           */
/* ------------------------------------------------------------------ */

let workerPromise: Promise<Worker> | null = null;
let tesseractQueue: Promise<unknown> = Promise.resolve();

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      return worker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

type OcrLine = { text: string; x0: number; x1: number; y0: number; y1: number };

/**
 * Sparse-text mode returns lines in detection order; rebuild speech bubbles by
 * grouping lines that sit directly under each other and overlap horizontally,
 * then read bubbles top-to-bottom (left-to-right when side by side).
 */
function groupIntoBubbles(lines: OcrLine[]): string[] {
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const bubbles: { lines: OcrLine[]; x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const l of sorted) {
    const h = l.y1 - l.y0;
    const target = bubbles.find((b) => {
      const gap = l.y0 - b.y1;
      const overlap = Math.min(b.x1, l.x1) - Math.max(b.x0, l.x0);
      return gap < h * 1.2 && gap > -h * 0.8 && overlap > Math.min(b.x1 - b.x0, l.x1 - l.x0) * 0.25;
    });
    if (target) {
      target.lines.push(l);
      target.x0 = Math.min(target.x0, l.x0);
      target.x1 = Math.max(target.x1, l.x1);
      target.y1 = Math.max(target.y1, l.y1);
    } else bubbles.push({ lines: [l], x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1 });
  }
  return bubbles
    .sort((a, b) => (Math.abs(a.y0 - b.y0) < 30 ? a.x0 - b.x0 : a.y0 - b.y0))
    .map((b) => b.lines.sort((p, q) => p.y0 - q.y0 || p.x0 - q.x0).map((l) => l.text).join(' '));
}

async function tesseractLines(buf: Buffer): Promise<string[]> {
  const tiles = await prepareTiles(buf, 1600, 2400);
  const worker = await getWorker();
  const lines: string[] = [];
  for (const tile of tiles) {
    const { data } = await worker.recognize(tile, {}, { blocks: true, text: true });
    const tileLines: OcrLine[] = [];
    for (const block of data.blocks || []) {
      for (const para of block.paragraphs) {
        for (const l of para.lines) {
          const text = cleanLines([l.text])[0];
          if (!text) continue;
          // Short fragments are usually art/speed lines misread as letters — demand high confidence
          const short = text.replace(/[^A-Za-z]/g, '').length <= 4;
          if (l.confidence < (short ? 85 : 55)) continue;
          tileLines.push({ text, x0: l.bbox.x0, x1: l.bbox.x1, y0: l.bbox.y0, y1: l.bbox.y1 });
        }
      }
    }
    lines.push(...groupIntoBubbles(tileLines));
  }
  return lines;
}

/** Tesseract is single-threaded per worker — serialise page requests. */
function runTesseract(buf: Buffer): Promise<string[]> {
  const run = tesseractQueue.then(() => tesseractLines(buf));
  tesseractQueue = run.catch(() => undefined);
  return run;
}

/* ------------------------------------------------------------------ */
/* Google Cloud Vision                                                 */
/* ------------------------------------------------------------------ */

async function googleVisionLines(buf: Buffer): Promise<string[]> {
  const tiles = await prepareTiles(buf, 1400, 3000);
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(googleKey())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: tiles.map((t) => ({
        image: { content: t.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['en'] },
      })),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Vision API error ${res.status}`);

  const lines: string[] = [];
  for (const r of json.responses || []) {
    if (r.error) throw new Error(r.error.message);
    for (const page of r.fullTextAnnotation?.pages || []) {
      for (const block of page.blocks || []) {
        const blockLines: string[] = [];
        for (const para of block.paragraphs || []) {
          const words = (para.words || []).map((w: any) => (w.symbols || []).map((s: any) => s.text).join(''));
          blockLines.push(words.join(' '));
        }
        const cleaned = cleanLines(blockLines);
        if (cleaned.length) lines.push(cleaned.join(' '));
      }
    }
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Gemini                                                              */
/* ------------------------------------------------------------------ */

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

async function geminiOcr(buf: Buffer): Promise<{ raw: string; en: string; hi: string }> {
  const { Type } = await import('@google/genai');
  // Keep enough resolution for small lettering on tall webtoon strips
  const img = await sharp(buf).flatten({ background: '#ffffff' }).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();

  const prompt = `You are an OCR and localisation engine for manga/manhwa/webtoon pages.
1. Read EVERY speech bubble, thought bubble and narration box on this page in reading order (top to bottom; within a row follow the panel order).
2. Ignore watermarks, website names, scanlation/translator credits, page numbers and decorative sound effects.
3. "lines": the exact text of each bubble/box, one array item per bubble.
4. "en": the same content as natural English narration a YouTube recap narrator could read aloud (fix ALL-CAPS to normal case, join broken lines; if the source text is not English, translate it). Keep the meaning, do not invent events.
5. "hi": natural, fluent Hindi (Devanagari script) version of "en" for Hindi narration.
If the page has no readable text, return empty strings and an empty array.`;

  const out = await geminiJson<{ lines: string[]; en: string; hi: string }>(
    [{ inlineData: { mimeType: 'image/jpeg', data: img.toString('base64') } }, { text: prompt }],
    {
      type: Type.OBJECT,
      properties: {
        lines: { type: Type.ARRAY, items: { type: Type.STRING } },
        en: { type: Type.STRING },
        hi: { type: Type.STRING },
      },
      required: ['lines', 'en', 'hi'],
    }
  );
  return { raw: (out.lines || []).join('\n'), en: (out.en || '').trim(), hi: (out.hi || '').trim() };
}

/* ------------------------------------------------------------------ */
/* Translation                                                         */
/* ------------------------------------------------------------------ */

export function canTranslate() {
  return Boolean(geminiKey() || googleKey());
}

/** Translate English narration to Hindi (Devanagari) with whichever service is configured. */
export async function translateText(text: string, target: 'hi' | 'en' = 'hi'): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';

  if (geminiKey()) {
    const { Type } = await import('@google/genai');
    const lang = target === 'hi' ? 'natural, fluent Hindi in Devanagari script' : 'natural English';
    const out = await geminiJson<{ text: string }>(
      [
        {
          text: `Translate this manga/webtoon narration into ${lang}. Keep names unchanged, keep it suitable for a voice-over. Return JSON {"text": "..."}.\n\n${clean}`,
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

export async function extractPageText(input: string | Buffer, provider: OcrProvider = 'tesseract'): Promise<OcrResult> {
  const buf = await loadImage(input);

  if (provider === 'gemini') {
    const r = await geminiOcr(buf);
    return { provider, ...r };
  }

  const lines = provider === 'google-vision' ? await googleVisionLines(buf) : await runTesseract(buf);
  const en = toNarration(lines);
  let hi = '';
  if (en && canTranslate()) {
    try {
      hi = await translateText(en, 'hi');
    } catch (e: any) {
      console.warn('[OCR] Hindi translation failed:', e?.message || e);
    }
  }
  return { provider, raw: lines.join('\n'), en, hi };
}

/** Backwards-compatible helper: English text only, '' on failure. */
export async function extractTextFromImage(imageInput: string | Buffer): Promise<string> {
  try {
    return (await extractPageText(imageInput, 'tesseract')).en;
  } catch (err) {
    console.warn('OCR extraction failed, keeping text empty:', err);
    return '';
  }
}
