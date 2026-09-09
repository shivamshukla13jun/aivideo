import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

export interface AISlideshowScene {
  id: string;
  slideNumber: number;
  title: string;
  narration: string;
  subtitles: Array<{
    id: string;
    text: string;
    startTime: number;
    endTime: number;
  }>;
  duration: number;
  effect: 'kenburns' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'fade' | 'crossfade' | 'wipe';
  imagePrompt: string;
  imageKeyword: string;
  imageUrl?: string;
}

export interface AISlideshowResult {
  title: string;
  description: string;
  style: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  totalDuration: number;
  scenes: AISlideshowScene[];
}

export interface GenerateSlideshowOptions {
  topic: string;
  slideCount?: number;
  style?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  model?: string;
  apiKey?: string;
}

export interface AnalyzeImagesOptions {
  images: Array<{
    mimeType: string;
    base64Data: string;
    filename?: string;
  }>;
  storyContext?: string;
  model?: string;
  apiKey?: string;
}

export class GeminiService {
  private getClient(customKey?: string): GoogleGenAI {
    const key = customKey || config.geminiApiKey;
    if (!key) {
      throw new Error(
        'Gemini API Key is missing. Please provide it in settings, in your request, or set GEMINI_API_KEY in the backend .env file.'
      );
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Generates a complete slideshow storyboard with scenes, narration, subtitles, and effects from a prompt.
   */
  async generateSlideshow(options: GenerateSlideshowOptions): Promise<AISlideshowResult> {
    const {
      topic,
      slideCount = 5,
      style = 'Cinematic Documentary',
      aspectRatio = '16:9',
      model = 'gemini-2.5-flash',
      apiKey,
    } = options;

    const ai = this.getClient(apiKey);

    const systemPrompt = `You are an elite Hollywood video director and motion graphics designer specializing in AI slideshow video generation.
Your task is to take a topic or concept and create an emotionally captivating, visually stunning multi-scene slideshow video storyboard.

Each scene MUST include:
1. "slideNumber": sequential integer starting from 1
2. "title": short punchy scene header
3. "narration": compelling voiceover narration (2-3 sentences, natural pacing)
4. "subtitles": array of subtitle segments timed perfectly within the slide's duration.
   Each segment: {"text": string, "startTime": number in seconds, "endTime": number in seconds}
5. "duration": duration in seconds (between 4 and 8 seconds per slide)
6. "effect": the most dramatic camera motion for this scene. Choose strictly from:
   ["kenburns", "zoom-in", "zoom-out", "pan-left", "pan-right", "crossfade", "fade", "wipe"]
7. "imagePrompt": a photorealistic, highly detailed image generation prompt
8. "imageKeyword": 2-4 clean English keywords for stock photo search (e.g. "futuristic cyberpunk city night rain")

Respond ONLY with clean, valid JSON matching the schema without markdown code blocks.`;

    const userPrompt = `Topic: "${topic}"
Target Slide Count: ${slideCount}
Style: ${style}
Aspect Ratio: ${aspectRatio}

Generate the video slideshow plan in pure JSON:
{
  "title": "Title of the video",
  "description": "Short summary",
  "style": "${style}",
  "aspectRatio": "${aspectRatio}",
  "scenes": [
    {
      "slideNumber": 1,
      "title": "Scene title",
      "narration": "Narration text",
      "subtitles": [
        { "text": "First phrase", "startTime": 0, "endTime": 2.5 },
        { "text": "Second phrase", "startTime": 2.5, "endTime": 5.0 }
      ],
      "duration": 5.0,
      "effect": "kenburns",
      "imagePrompt": "Detailed visual description",
      "imageKeyword": "relevant keyword"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
    });

    const responseText = response.text || '{}';
    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanedJson);
      let cumulativeTime = 0;

      const scenes: AISlideshowScene[] = (parsed.scenes || []).map((s: any, idx: number) => {
        const dur = Math.max(3, Number(s.duration) || 5);
        cumulativeTime += dur;

        // Auto-assign high quality curated Unsplash photography if no image is present
        const keyword = encodeURIComponent(s.imageKeyword || 'cinematic');
        const fallbackUrl = `https://images.unsplash.com/featured/?${keyword}&sig=${idx + 1}`;

        return {
          id: `slide_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          slideNumber: s.slideNumber || idx + 1,
          title: s.title || `Scene ${idx + 1}`,
          narration: s.narration || '',
          subtitles: (s.subtitles || []).map((sub: any, subIdx: number) => ({
            id: `sub_${Date.now()}_${idx}_${subIdx}`,
            text: sub.text || '',
            startTime: typeof sub.startTime === 'number' ? sub.startTime : 0,
            endTime: typeof sub.endTime === 'number' ? sub.endTime : dur,
          })),
          duration: dur,
          effect: s.effect || 'kenburns',
          imagePrompt: s.imagePrompt || '',
          imageKeyword: s.imageKeyword || '',
          imageUrl: fallbackUrl,
        };
      });

      return {
        title: parsed.title || topic,
        description: parsed.description || '',
        style: parsed.style || style,
        aspectRatio: aspectRatio,
        totalDuration: cumulativeTime,
        scenes,
      };
    } catch (err: any) {
      throw new Error(`Failed to parse Gemini response as JSON: ${err.message}. Raw: ${responseText.slice(0, 300)}`);
    }
  }

  /**
   * Analyzes uploaded slide images or manga panels using Gemini multimodal vision.
   * Extracts visual narrative, generates voiceover script, subtitles, and assigns best motion effects.
   */
  async analyzeImagesForSlideshow(options: AnalyzeImagesOptions): Promise<AISlideshowResult> {
    const {
      images,
      storyContext = 'Manga / Webtoon or Photo Slideshow',
      model = 'gemini-2.5-flash',
      apiKey,
    } = options;

    if (!images.length) {
      throw new Error('At least one image must be provided for multimodal analysis.');
    }

    const ai = this.getClient(apiKey);

    const parts: any[] = [];

    // Add multimodal images
    images.forEach((img, i) => {
      parts.push({
        text: `Image #${i + 1} (${img.filename || `Panel_${i + 1}`}):`,
      });
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Data,
        },
      });
    });

    const promptText = `You are an expert video director. You are provided with ${images.length} images for a slideshow video.
Story context: "${storyContext}"

Analyze each image sequentially and produce a cinematic slideshow video script in valid JSON:
1. For each image, write an engaging voiceover narration describing or storytelling the action.
2. Break down the narration into timed subtitles (startTime, endTime within the slide duration).
3. Set an optimal duration in seconds (4-8s).
4. Assign the most impactful camera transition effect:
   ["kenburns", "zoom-in", "zoom-out", "pan-left", "pan-right", "crossfade", "fade", "wipe"]
   - If the image has a single character or dramatic face: choose "zoom-in" or "kenburns"
   - If the image is a landscape or wide scene: choose "pan-left" or "pan-right"
   - If it is an intense action transition: choose "zoom-out" or "wipe"

Format strictly as JSON:
{
  "title": "Storyboard Title",
  "description": "Story overview",
  "style": "Cinematic Storytelling",
  "aspectRatio": "16:9",
  "scenes": [
    {
      "slideNumber": 1,
      "title": "Scene 1 Title",
      "narration": "Narration text",
      "subtitles": [
        { "text": "Phrase 1", "startTime": 0, "endTime": 2.5 }
      ],
      "duration": 5.0,
      "effect": "kenburns"
    }
  ]
}`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
    });

    const responseText = response.text || '{}';
    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanedJson);
      let cumulativeTime = 0;

      const scenes: AISlideshowScene[] = (parsed.scenes || []).map((s: any, idx: number) => {
        const dur = Math.max(3, Number(s.duration) || 5);
        cumulativeTime += dur;

        return {
          id: `slide_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          slideNumber: s.slideNumber || idx + 1,
          title: s.title || `Scene ${idx + 1}`,
          narration: s.narration || '',
          subtitles: (s.subtitles || []).map((sub: any, subIdx: number) => ({
            id: `sub_${Date.now()}_${idx}_${subIdx}`,
            text: sub.text || '',
            startTime: typeof sub.startTime === 'number' ? sub.startTime : 0,
            endTime: typeof sub.endTime === 'number' ? sub.endTime : dur,
          })),
          duration: dur,
          effect: s.effect || 'kenburns',
          imagePrompt: '',
          imageKeyword: '',
        };
      });

      return {
        title: parsed.title || 'Analyzed Slideshow',
        description: parsed.description || '',
        style: parsed.style || 'Cinematic Storytelling',
        aspectRatio: '16:9',
        totalDuration: cumulativeTime,
        scenes,
      };
    } catch (err: any) {
      throw new Error(`Failed to parse Gemini response: ${err.message}. Raw: ${responseText.slice(0, 300)}`);
    }
  }
}

export const geminiService = new GeminiService();
