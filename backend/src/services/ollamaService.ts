import axios from 'axios';
import { config } from '../config';
import {
  AISlideshowScene,
  AISlideshowResult,
  GenerateSlideshowOptions,
  AnalyzeImagesOptions,
} from './geminiService';

export class OllamaService {
  private getBaseUrl(): string {
    return (config.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
  }

  /**
   * Check connection to local Ollama server and list installed models
   */
  async checkConnection(): Promise<{
    connected: boolean;
    models: string[];
    defaultModel: string;
    visionModel: string;
    version?: string;
    error?: string;
  }> {
    const baseUrl = this.getBaseUrl();
    try {
      const res = await axios.get(`${baseUrl}/api/tags`, { timeout: 3000 });
      const rawModels = res.data?.models || [];
      const models = rawModels.map((m: any) => m.name || m.model || '');

      let version = 'unknown';
      try {
        const verRes = await axios.get(`${baseUrl}/api/version`, { timeout: 2000 });
        version = verRes.data?.version || 'unknown';
      } catch {
        // version endpoint optional
      }

      return {
        connected: true,
        models,
        defaultModel: config.ollamaModel,
        visionModel: config.ollamaVisionModel,
        version,
      };
    } catch (err: any) {
      return {
        connected: false,
        models: [],
        defaultModel: config.ollamaModel,
        visionModel: config.ollamaVisionModel,
        error: err.message || 'Ollama offline',
      };
    }
  }

  /**
   * Translates common Ollama connection and runtime errors into clear Hindi guidance.
   */
  private handleOllamaError(error: any, modelName: string): never {
    const baseUrl = this.getBaseUrl();
    const status = error?.response?.status;
    const errorStr = typeof error === 'string' ? error : error?.message || JSON.stringify(error);

    if (
      error?.code === 'ECONNREFUSED' ||
      errorStr.includes('ECONNREFUSED') ||
      errorStr.includes('connect ECONNREFUSED')
    ) {
      throw new Error(
        `Ollama सेवा से संपर्क नहीं हो सका (${baseUrl})। कृपया सुनिश्चित करें कि Ollama बैकग्राउंड में चालू है (टर्मिनल में 'ollama serve' चलाएं या Ollama Desktop ऐप शुरू करें)।`
      );
    }

    if (
      status === 404 ||
      errorStr.includes('404') ||
      (errorStr.includes('model') && errorStr.includes('not found'))
    ) {
      throw new Error(
        `Ollama मॉडल "${modelName}" स्थापित नहीं है (404 Not Found)। कृपया अपने टर्मिनल में "ollama pull ${modelName}" चलाकर मॉडल डाउनलोड करें, या .env में OLLAMA_MODEL बदलें।`
      );
    }

    throw new Error(`Ollama त्रुटि: ${errorStr}`);
  }

  /**
   * Generates a complete slideshow storyboard with scenes, narration, subtitles, and effects from a prompt using Ollama.
   */
  async generateSlideshow(options: GenerateSlideshowOptions): Promise<AISlideshowResult> {
    const {
      topic,
      slideCount = 5,
      style = 'Cinematic Documentary',
      aspectRatio = '16:9',
      model,
    } = options;

    const targetModel = model || config.ollamaModel || 'llama3';
    const baseUrl = this.getBaseUrl();

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
      const response = await axios.post(
        `${baseUrl}/api/chat`,
        {
          model: targetModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          format: 'json',
          stream: true,
          options: {
            temperature: 0.7,
          },
        },
        {
          responseType: 'stream',
          timeout: 0,
        }
      );

      await new Promise<void>((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              const piece = parsed.message?.content || parsed.response || '';
              if (piece) {
                responseText += piece;
                if (options.onChunk) {
                  options.onChunk(piece, responseText.length);
                }
              }
            } catch {
              // incomplete line, continue
            }
          }
        });

        response.data.on('end', () => {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              const piece = parsed.message?.content || parsed.response || '';
              if (piece) {
                responseText += piece;
                if (options.onChunk) {
                  options.onChunk(piece, responseText.length);
                }
              }
            } catch {
              // ignore
            }
          }
          resolve();
        });

        response.data.on('error', (err: any) => reject(err));
      });
    } catch (err: any) {
      this.handleOllamaError(err, targetModel);
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
        description: parsed.description || `AI Slideshow about ${topic}`,
        style,
        aspectRatio,
        totalDuration: cumulativeTime,
        scenes,
      };
    } catch (err: any) {
      throw new Error(`Ollama JSON पार्सिंग विफल: ${err.message}. कच्चा आउटपुट: ${responseText.slice(0, 200)}`);
    }
  }

  /**
   * Analyzes uploaded slide images or manga panels using Ollama multimodal vision (llava, llama3.2-vision, minicpm-v).
   * Extracts visual narrative, generates voiceover script, subtitles, and assigns best motion effects.
   */
  async analyzeImagesForSlideshow(options: AnalyzeImagesOptions): Promise<AISlideshowResult> {
    const {
      images,
      storyContext = 'Manga / Webtoon Slideshow',
      characterMemoryPrompt,
      model,
    } = options;

    if (!images.length) {
      throw new Error('मल्टीमॉडल विश्लेषण के लिए कम से कम एक इमेज होना आवश्यक है।');
    }

    const targetModel = model || config.ollamaVisionModel || 'llava';
    const baseUrl = this.getBaseUrl();

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
1. SITUATION-AWARE HINDI STORYTELLING:
   - Carefully analyze each panel's visual choreography, facial expressions, and action.
   - Craft amazing Hindi narration and dialogue subtitles tailored to the unfolding situation.
2. CHARACTER MEMORY:
   - Identify characters shown in panels, noting mysterious or masked fighters.
3. DYNAMIC DURATION:
   - Assign realistic scene durations (2.5s to 8.5s) matching dialogue length.

Format strictly as pure JSON:
{
  "title": "हिंदी में इस अध्याय / दृश्य का रोमांचक शीर्षक",
  "description": "1-2 वाक्यों में हिंदी एपिसोड हुक",
  "chapterSummary": "इन पैनल्स में क्या हुआ उसका विस्तृत हिंदी सारांश",
  "unresolvedMysteries": ["मुख्य सस्पेंस या अनसुलझा रहस्य हिंदी में"],
  "characters": [
    {
      "name": "किरदार का नाम",
      "role": "Protagonist / Rival / Ally / Mystery",
      "description": "संक्षिप्त विवरण हिंदी में"
    }
  ],
  "scenes": [
    {
      "slideNumber": 1,
      "title": "पैनल 1 का शीर्षक हिंदी में",
      "narration": "हिंदी में 2-3 वाक्यों का स्थिति-अनुसार रोमांचक नरेशन",
      "subtitles": [
        { "text": "हिंदी संवाद सबटाइटल", "startTime": 0.2, "endTime": 3.8 }
      ],
      "duration": 4.0,
      "effect": "kenburns"
    }
  ]
}`;

    // Clean base64 strings without data: prefix
    const base64Images = images.map((img) =>
      img.base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
    );

    let responseText = '';

    try {
      const response = await axios.post(
        `${baseUrl}/api/chat`,
        {
          model: targetModel,
          messages: [
            {
              role: 'user',
              content: promptText,
              images: base64Images,
            },
          ],
          format: 'json',
          stream: true,
          options: {
            temperature: 0.6,
          },
        },
        {
          responseType: 'stream',
          timeout: 0,
        }
      );

      await new Promise<void>((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              const piece = parsed.message?.content || parsed.response || '';
              if (piece) {
                responseText += piece;
                if (options.onChunk) {
                  options.onChunk(piece, responseText.length);
                }
              }
            } catch {
              // continue
            }
          }
        });

        response.data.on('end', () => {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              const piece = parsed.message?.content || parsed.response || '';
              if (piece) {
                responseText += piece;
                if (options.onChunk) {
                  options.onChunk(piece, responseText.length);
                }
              }
            } catch {
              // ignore
            }
          }
          resolve();
        });

        response.data.on('error', (err: any) => reject(err));
      });
    } catch (err: any) {
      this.handleOllamaError(err, targetModel);
    }

    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanedJson);
      let cumulativeTime = 0;

      const scenes: AISlideshowScene[] = (parsed.scenes || []).map((s: any, idx: number) => {
        const dur = Math.max(2.5, Number(s.duration) || 4.5);
        cumulativeTime += dur;

        return {
          id: `anime_scene_${Date.now()}_${idx}`,
          slideNumber: s.slideNumber || idx + 1,
          title: s.title || `पैनल ${idx + 1}`,
          narration: s.narration || '',
          subtitles: (s.subtitles || []).map((sub: any, subIdx: number) => ({
            id: `sub_${Date.now()}_${idx}_${subIdx}`,
            text: sub.text || '',
            startTime: typeof sub.startTime === 'number' ? sub.startTime : 0.2,
            endTime: typeof sub.endTime === 'number' ? sub.endTime : Math.max(1, dur - 0.2),
          })),
          duration: dur,
          effect: s.effect || 'kenburns',
          imagePrompt: '',
          imageKeyword: '',
        };
      });

      return {
        title: parsed.title || 'एनीमे अध्याय सारांश',
        description: parsed.description || 'मंगा पैनल्स से तैयार की गई हिंदी कहानी',
        chapterSummary: parsed.chapterSummary || '',
        characters: parsed.characters || [],
        unresolvedMysteries: parsed.unresolvedMysteries || [],
        style: 'Anime Storyboard',
        aspectRatio: '16:9',
        totalDuration: cumulativeTime,
        scenes,
      };
    } catch (err: any) {
      throw new Error(`Ollama विज़न JSON पार्सिंग विफल: ${err.message}. कच्चा आउटपुट: ${responseText.slice(0, 200)}`);
    }
  }
}

export const ollamaService = new OllamaService();
