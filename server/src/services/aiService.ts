import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index';

export interface ExtractedSceneData {
  characters: string[];
  narration: string;
  dialogue: string;
  emotion: string;
  duration: number;
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml'
};

const ALLOWED_EMOTIONS = ['Tension', 'Awe & Dread', 'Terror', 'Dramatic', 'Calm', 'Action'];

// Vision-capable Gemini models tried in order — earlier entries preferred
const MODEL_CANDIDATES = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];

const EXTRACTION_PROMPT = `You are analyzing a single page from a webtoon/comic. Carefully read ALL text visible in the image (speech bubbles, captions, narrator boxes, sound effects) and extract:

1. characters: array of character names who appear or speak on this page (best-guess names; empty array if unclear)
2. narration: the narrator/caption text for this page rewritten as one cinematic narration script
3. dialogue: spoken dialogue lines formatted as "Character: line", one per line
4. emotion: exactly one of "Tension", "Awe & Dread", "Terror", "Dramatic", "Calm", "Action"
5. duration: suggested on-screen reading duration in seconds (number, 3-15)

IMPORTANT RULES:
- Write ALL extracted text (narration AND dialogue) in Hindi (Devanagari script). Translate any English, Korean, Japanese or other language text into natural, cinematic Hindi.
- Keep proper character names in their original Latin spelling (do not transliterate names into Devanagari).
- Return ONLY a JSON object with exactly these keys: characters, narration, dialogue, emotion, duration.`;

export class AIService {
  /**
   * Uses Gemini vision to OCR a comic page and produce a Hindi scene script.
   */
  public async extractSceneFromImage(imageUrl: string): Promise<ExtractedSceneData> {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server');
    }
    if (!imageUrl) {
      throw new Error('imageUrl is required');
    }

    const { buffer, mimeType } = await this.loadImage(imageUrl);

    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    let rawText = '';
    let lastError: any = null;
    for (const model of MODEL_CANDIDATES) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType
              }
            },
            { text: EXTRACTION_PROMPT }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });
        rawText = (response.text || '').trim();
        if (rawText) break;
      } catch (err) {
        lastError = err;
        console.warn(`[AIService] Model ${model} failed, trying next:`, (err as any)?.message || err);
      }
    }
    if (!rawText) {
      const msg = lastError?.message || 'AI returned an empty response for this page';
      throw new Error(msg);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      throw new Error('AI response was not valid JSON');
    }

    const characters = Array.isArray(parsed.characters)
      ? parsed.characters.map((c: any) => String(c).trim()).filter(Boolean)
      : [];

    const emotion = ALLOWED_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'Dramatic';
    const duration = Math.min(15, Math.max(3, Number(parsed.duration) || 5));

    return {
      characters,
      narration: typeof parsed.narration === 'string' ? parsed.narration.trim() : '',
      dialogue: typeof parsed.dialogue === 'string' ? parsed.dialogue.trim() : '',
      emotion,
      duration
    };
  }

  /**
   * Resolves a page image URL to raw bytes — local /uploads files are read from
   * disk, remote URLs are fetched.
   */
  private async loadImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const resp = await fetch(imageUrl);
      if (!resp.ok) {
        throw new Error(`Failed to fetch remote image (HTTP ${resp.status})`);
      }
      const buffer = Buffer.from(await resp.arrayBuffer());
      const mimeType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      return { buffer, mimeType };
    }

    // Local file — only allow paths inside the uploads directory
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const rel = imageUrl.replace(/^\/+/, '');
    const filePath = path.resolve(process.cwd(), rel);
    if (!filePath.startsWith(uploadsRoot) || !fs.existsSync(filePath)) {
      throw new Error('Page image file not found on server');
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return { buffer, mimeType: MIME_BY_EXT[ext] || 'image/jpeg' };
  }
}

export const aiService = new AIService();
