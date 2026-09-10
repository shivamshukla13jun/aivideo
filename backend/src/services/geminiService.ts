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
    style?: any;
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
  chapterSummary?: string;
  characters?: Array<{
    name: string;
    role: string;
    description: string;
    keyTraits?: string[];
    secretsOrMysteries?: string[];
  }>;
  unresolvedMysteries?: string[];
}

export interface GenerateSlideshowOptions {
  topic: string;
  slideCount?: number;
  style?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  model?: string;
  apiKey?: string;
  onChunk?: (chunkText: string, accumulatedLength: number) => void;
}

export interface AnalyzeImagesOptions {
  images: Array<{
    mimeType: string;
    base64Data: string;
    filename?: string;
  }>;
  storyContext?: string;
  characterMemoryPrompt?: string;
  model?: string;
  apiKey?: string;
  onChunk?: (chunkText: string, accumulatedLength: number) => void;
}


export class GeminiService {
  private getClient(customKey?: string): GoogleGenAI {
    const key = (customKey || config.geminiApiKey || '').trim();
    if (!key) {
      throw new Error(
        'Gemini API Key मौजूद नहीं है। कृपया ऐप की सेटिंग्स (⚙️) में या backend/.env में अपनी Google AI Studio API Key (AIzaSy...) दर्ज करें।'
      );
    }
    if (key.startsWith('AQ.')) {
      throw new Error(
        'अमान्य Gemini API Key (Invalid Key): वर्तमान कुंजी "AQ." से शुरू हो रही है, जो एक आंतरिक टोकन है। Google Gemini API के लिए मान्य API Key "AIzaSy..." से शुरू होती है। कृपया https://aistudio.google.com/app/apikey से अपनी फ्री API Key बनाकर सेटिंग्स (⚙️) में पेस्ट करें।'
      );
    }
    return new GoogleGenAI({ apiKey: key });
  }

  /**
   * Catches and formats Gemini API errors into actionable, clear Hindi messages.
   */
  public handleGeminiError(error: any): never {
    const errorStr = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));

    if (
      error?.status === 401 ||
      errorStr.includes('401') ||
      errorStr.includes('UNAUTHENTICATED') ||
      errorStr.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
      errorStr.includes('invalid authentication credentials')
    ) {
      throw new Error(
        'अमान्य Gemini API Key (401 Unauthorized): प्रदान की गई कुंजी अमान्य है। Google Gemini API के लिए मान्य API Key "AIzaSy..." से शुरू होती है। कृपया https://aistudio.google.com/app/apikey पर जाकर एक नई फ्री API Key बनाएं और ऐप सेटिंग्स (⚙️) में सेव करें।'
      );
    }

    if (errorStr.includes('404') || errorStr.includes('NOT_FOUND')) {
      throw new Error(
        'चयनित Gemini मॉडल उपलब्ध नहीं है। कृपया मॉडल को "gemini-3.6-flash" पर रखें।'
      );
    }

    if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'Gemini API दर सीमा (Rate Limit 429): अनुरोधों की सीमा पूरी हो गई है। कृपया 30 सेकंड बाद पुनः प्रयास करें या अपनी API Key का कोटा जांचें।'
      );
    }

    throw error;
  }

  /**
   * Resolves model name to current supported versions, mapping legacy/deprecated names.
   */
  private resolveModel(modelName?: string): string {
    if (!modelName) return 'gemini-3.6-flash';
    return modelName;
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
      model = 'gemini-3.6-flash',
      apiKey,
    } = options;

    const targetModel = this.resolveModel(model);

    const ai = this.getClient(apiKey);

    const systemPrompt = `You are an elite video director and motion graphics designer specializing in AI slideshow video generation for Hindi audiences.
Your task is to take a topic or concept and create an emotionally captivating, visually stunning multi-scene slideshow video storyboard.

CRITICAL REQUIREMENT - LANGUAGE:
All titles, descriptions, voiceover narration, and subtitles MUST BE STRICTLY WRITTEN IN HINDI (हिंदी - Devanagari script). The Hindi must be natural, dramatic, emotionally engaging, and easy to speak and read aloud. Only the "imagePrompt" and "imageKeyword" should be in English for image generation models.

Each scene MUST include:
1. "slideNumber": sequential integer starting from 1
2. "title": short punchy scene header in Hindi (हिंदी शीर्षक)
3. "narration": compelling voiceover narration in Hindi (2-3 sentences, natural pacing) (हिंदी नरेशन)
4. "subtitles": array of subtitle segments in Hindi timed perfectly within the slide's duration. (हिंदी सबटाइटल)
   Each segment: {"text": string (in Hindi), "startTime": number in seconds, "endTime": number in seconds}
5. "duration": duration in seconds (between 4 and 8 seconds per slide)
6. "effect": the most dramatic camera motion for this scene. Choose strictly from:
   ["kenburns", "zoom-in", "zoom-out", "pan-left", "pan-right", "crossfade", "fade", "wipe"]
7. "imagePrompt": a photorealistic, highly detailed image generation prompt (in English)
8. "imageKeyword": 2-4 clean English keywords for stock photo search (e.g. "futuristic cyberpunk city night rain")

Respond ONLY with clean, valid JSON matching the schema without markdown code blocks.`;

    const userPrompt = `Topic: "${topic}"
Target Slide Count: ${slideCount}
Style: ${style}
Aspect Ratio: ${aspectRatio}

Generate the video slideshow plan in pure JSON with all narrations, titles, descriptions, and subtitles strictly in HINDI (हिंदी):
{
  "title": "हिंदी में वीडियो का शीर्षक",
  "description": "हिंदी में संक्षिप्त सारांश",
  "style": "${style}",
  "aspectRatio": "${aspectRatio}",
  "scenes": [
    {
      "slideNumber": 1,
      "title": "दृश्य शीर्षक हिंदी में",
      "narration": "हिंदी में 2-3 वाक्यों का आकर्षक नरेशन",
      "subtitles": [
        { "text": "पहला हिंदी सबटाइटल", "startTime": 0, "endTime": 2.5 },
        { "text": "दूसरा हिंदी सबटाइटल", "startTime": 2.5, "endTime": 5.0 }
      ],
      "duration": 5.0,
      "effect": "kenburns",
      "imagePrompt": "Detailed visual description in English",
      "imageKeyword": "relevant english keyword"
    }
  ]
}`;

    let responseText = '';
    try {
      // Stream real-time tokens from Gemini AI API
      const responseStream = await ai.models.generateContentStream({
        model: targetModel,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        responseText += text;
        if (options.onChunk) {
          options.onChunk(text, responseText.length);
        }
      }
    } catch (streamErr: any) {
      this.handleGeminiError(streamErr);
    }

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
      storyContext = 'Manga / Webtoon Slideshow',
      characterMemoryPrompt,
      model = 'gemini-3.6-flash',
      apiKey,
    } = options;

    const targetModel = this.resolveModel(model);

    if (!images.length) {
      throw new Error('At least one image must be provided for multimodal analysis.');
    }

    const ai = this.getClient(apiKey);

    const parts: any[] = [];

    // Add multimodal images
    images.forEach((img, i) => {
      parts.push({
        text: `Panel #${i + 1} (${img.filename || `Panel_${i + 1}`}):`,
      });
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Data,
        },
      });
    });

    const memoryBlock = characterMemoryPrompt ? `\n${characterMemoryPrompt}\n` : '';

    const promptText = `You are an elite anime director, manga recap creator, and master storyteller specializing in anime/manga recaps for Hindi audiences.
You are analyzing ${images.length} manga/webtoon panels in sequence.
Story context: "${storyContext}"
${memoryBlock}

CRITICAL MANDATORY REQUIREMENT - EVERYTHING IN HINDI (सब कुछ हिंदी में):
- All titles, descriptions, chapter summaries, character descriptions, unresolved mysteries, voiceover narrations, and subtitles MUST BE STRICTLY WRITTEN IN HINDI (हिंदी भाषा, देवनागरी लिपि).
- Write in thrilling, dramatic, high-retention conversational Hindi that top anime recap creators speak on YouTube.
- Character names should be written with Hindi phonetics and English in brackets (e.g., 'डैनियल पार्क (Daniel Park)', 'अनाम नकाबपोश लड़ाका (Anonymous Masked Fighter)').

CRITICAL OBJECTIVES:
1. AMAZING SITUATION-AWARE HINDI STORYTELLING (परिस्थिति के अनुसार धमाकेदार हिंदी कहानी):
   - Carefully read the visual details: speech bubbles, character facial expressions, battle choreography, sound effects, comedic timing, and emotional tension.
   - Craft amazing Hindi narration and dialogue subtitles tailored exactly to the unfolding situation (मार्शल आर्ट्स मुकाबला, धोखा, गुप्त रहस्य, अचानक हमला, कॉमेडी, आदि).
   - Make the storytelling feel alive, dramatic, and deeply captivating for Hindi anime/manga fans!

2. PERSISTENT CHARACTER MEMORY & AUDIENCE ENGAGEMENT HOOKS (किरदारों की याददाश्त और दर्शकों को बांधने वाले संकेत):
   - Identify every character shown or referenced in these panels.
   - If an ANONYMOUS, MYSTERIOUS, HOODED, or MASKED figure appears, or someone performs a recognizable technique or shows a hidden mark:
     * Add exciting narrator reminders in Hindi to build massive audience curiosity (उदा: "ज़रा रुकिए... उस निशान को ध्यान से देखिए! क्या यह वही रहस्यमयी योद्धा है जिसने पिछले अध्याय में तबाही मचाई थी?!", "छाया में खड़ा यह नकाबपोश आखिर कौन है?!").
     * Document their alias, role, and mystery in the "characters" and "unresolvedMysteries" fields in Hindi.
   - If a known returning character appears, reference their previous feats in Hindi.

3. SITUATION-AWARE DYNAMIC PANEL DURATION & SUBTITLES (स्थिति और सबटाइटल के अनुसार सटीक समय):
   - DO NOT make panel durations arbitrarily long or too small. The duration MUST strictly match the dramatic situation and subtitle length:
     * Quick Action / Shock / Sound Effect / Punch (1-3 words, e.g. "धमाका!", "क्या?!", "रुको!"): Duration MUST be short (2.0s to 2.8s).
     * Short dialogue / focused action (4-8 words): Duration should be 3.0s to 4.2s.
     * Standard conversation (9-15 words): Duration should be 4.5s to 6.2s.
     * Dramatic reveal / strategy explanation (16-25 words): Duration should be 6.5s to 8.5s.
     * Heavy monologue or climax (26+ words): Capped at 9.5s.
   - Pacing should feel natural for a human reading the subtitles aloud at ~2.5 words/sec, plus comfortable breathing space.
   - Subtitle timings (startTime, endTime) must fit accurately within that duration.


Format strictly as pure JSON:
{
  "title": "हिंदी में इस अध्याय / दृश्य का रोमांचक शीर्षक",
  "description": "1-2 वाक्यों में हिंदी एपिसोड हुक",
  "chapterSummary": "इन पैनल्स में क्या हुआ उसका विस्तृत हिंदी सारांश",
  "unresolvedMysteries": [
    "मुख्य सस्पेंस या अनसुलझा रहस्य हिंदी में (उदा: उस नकाबपोश लड़ाके की असली पहचान क्या है?)"
  ],
  "characters": [
    {
      "name": "किरदार का नाम (उदा: 'अनाम नकाबपोश फाइटर / Anonymous Masked Fighter')",
      "role": "नायक (Protagonist) / प्रतिद्वंद्वी (Rival) / रहस्यमयी अजनबी (Mysterious Stranger) / खलनायक (Antagonist) / साथी (Ally)",
      "description": "इस अध्याय में उसका रूप-रंग, हाव-भाव, या लड़ाई की शैली हिंदी में",
      "keyTraits": ["खासियत 1", "खासियत 2"],
      "secretsOrMysteries": ["अनसुलझा रहस्य या सुराग हिंदी में"]
    }
  ],
  "scenes": [
    {
      "slideNumber": 1,
      "title": "पैनल 1 का शीर्षक हिंदी में",
      "narration": "इस पैनल के लिए रोमांचक हिंदी वॉयस-ओवर नरेशन",
      "subtitles": [
        { "text": "पहला हिंदी सबटाइटल", "startTime": 0.3, "endTime": 2.5 },
        { "text": "दूसरा हिंदी सबटाइटल", "startTime": 2.5, "endTime": 4.8 }
      ],
      "duration": 5.0,
      "effect": "kenburns"
    }
  ]
}`;

    parts.push({ text: promptText });

    let responseText = '';
    try {
      // Stream real-time tokens from Gemini AI API
      const responseStream = await ai.models.generateContentStream({
        model: targetModel,
        contents: [{ role: 'user', parts }],
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        responseText += text;
        if (options.onChunk) {
          options.onChunk(text, responseText.length);
        }
      }
    } catch (streamErr: any) {
      this.handleGeminiError(streamErr);
    }

    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();


    try {
      const parsed = JSON.parse(cleanedJson);
      let cumulativeTime = 0;

      const scenes: AISlideshowScene[] = (parsed.scenes || []).map((s: any, idx: number) => {
        const narration = s.narration || s.title || '';
        const wordCount = narration.split(/\s+/).filter(Boolean).length;
        // Provide generous human reading pace: ~2.4 words per second + 1.2s padding
        const estimatedDuration = Math.max(4.5, Math.round((wordCount / 2.4 + 1.2) * 10) / 10);
        const dur = Math.max(estimatedDuration, Number(s.duration) || 5);
        cumulativeTime += dur;

        let rawSubs = s.subtitles;
        if (!rawSubs || !Array.isArray(rawSubs) || rawSubs.length === 0) {
          rawSubs = [
            {
              text: narration,
              startTime: 0.3,
              endTime: Math.max(1.5, dur - 0.3),
            },
          ];
        }

        return {
          id: `slide_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          slideNumber: s.slideNumber || idx + 1,
          title: s.title || `Panel ${idx + 1}`,
          narration: narration,
          subtitles: rawSubs.map((sub: any, subIdx: number) => ({
            id: `sub_${Date.now()}_${idx}_${subIdx}`,
            text: sub.text || '',
            startTime: typeof sub.startTime === 'number' ? Math.max(0.2, sub.startTime) : 0.3,
            endTime: typeof sub.endTime === 'number' ? Math.min(dur - 0.2, sub.endTime) : dur - 0.3,
          })),
          duration: dur,
          effect: s.effect || 'kenburns',
          imagePrompt: '',
          imageKeyword: '',
        };
      });

      return {
        title: parsed.title || 'Manga Chapter Story',
        description: parsed.description || '',
        chapterSummary: parsed.chapterSummary || '',
        characters: parsed.characters || [],
        unresolvedMysteries: parsed.unresolvedMysteries || [],
        style: parsed.style || 'Anime Storytelling',
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
