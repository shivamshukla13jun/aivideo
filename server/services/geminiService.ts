import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { WebtoonScript, WebtoonCharacter, WebtoonPanel, WebtoonIncident } from '../../src/types.js';

export const BEST_AI_MODEL = 'gemini-3.1-pro-preview';
export const FAST_AI_MODEL = 'gemini-3.8-flash';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      genAIClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return genAIClient;
}
/**
 * Computes estimated scene duration (in seconds) dynamically according to
 * the length of the subtitle dialogue (words & characters) and speed multiplier.
 * Suitable for both Hindi and English webtoon narration.
 */
export function calculateDurationFromSubtitle(
  dialogue?: string,
  speedMultiplier: number = 1.0
): number {
  if (!dialogue || !dialogue.trim()) {
    return Math.max(2, Math.round(3.5 / speedMultiplier));
  }
  const clean = dialogue.trim();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const chars = clean.length;

  // Natural speaking & reading pace: ~2.3 words/sec with 1.2s padding for pauses & visuals
  const timeFromWords = (words / 2.3) + 1.2;
  // Natural character pace: ~14 characters/sec with 1.0s padding
  const timeFromChars = (chars / 14) + 1.0;

  const baseDuration = Math.max(timeFromWords, timeFromChars);
  // Clamped between 2.5s and 20s
  const clampedBase = Math.min(20, Math.max(2.5, Math.round(baseDuration * 10) / 10));

  return Math.max(1.5, Math.round((clampedBase / speedMultiplier) * 10) / 10);
}

/**
 * Downloads / resolves an image URL into a base64 inlineData part so Gemini Multimodal Vision can inspect real pixels.
 */
export async function fetchImageAsInlinePart(
  imageUrl: string
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!imageUrl) return null;

  try {
    // 1. Data URL
    if (imageUrl.startsWith('data:image')) {
      const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        return {
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        };
      }
    }

    // 2. Local relative path or internal route (e.g. /local_cbz/...)
    let targetUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      targetUrl = `http://127.0.0.1:3000${imageUrl}`;
    }

    // 3. HTTP / HTTPS URL
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Referer: targetUrl,
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const mimeType = contentType.split(';')[0].trim() || 'image/jpeg';

        return {
          inlineData: {
            mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
            data: buffer.toString('base64'),
          },
        };
      }
    }
  } catch (err: any) {
    console.warn(
      `[Gemini Vision] Notice fetching image (${imageUrl.slice(0, 50)}...):`,
      err?.message || err
    );
  }

  return null;
}

/**
 * Resilient multi-tier model execution:
 * First attempts the highest-tier frontier model (gemini-3.1-pro-preview with deep thinking),
 * and automatically falls back to gemini-3.8-flash if quota/tier constraints occur, ensuring non-stop operation.
 */
async function generateWithBestAiFallback(params: {
  model?: string;
  contents: any;
  config?: any;
}): Promise<{ text: string; usedModel: string }> {
  const ai = getGenAI();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured or invalid in environment');
  }

  const preferredModel = params.model || BEST_AI_MODEL;
  const fallbackModel = FAST_AI_MODEL;

  // Attempt 1: Preferred Pro Model
  try {
    console.log(`[Gemini Pro] Requesting generation using model: ${preferredModel}`);
    const response = await ai.models.generateContent({
      model: preferredModel,
      contents: params.contents,
      config: {
        ...params.config,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });

    if (response.text && response.text.trim().length > 0) {
      return { text: response.text, usedModel: preferredModel };
    }
  } catch (err: any) {
    console.warn(
      `[Gemini Pro Notice] Model ${preferredModel} encountered: ${err.message}. Retrying with ${fallbackModel}...`
    );
    if (preferredModel === fallbackModel) throw err;
  }

  // Attempt 2: High-speed Flash fallback with ThinkingLevel.HIGH
  try {
    console.log(`[Gemini Flash] Executing fallback generation using model: ${fallbackModel}`);
    const response = await ai.models.generateContent({
      model: fallbackModel,
      contents: params.contents,
      config: {
        ...params.config,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });

    if (response.text && response.text.trim().length > 0) {
      return { text: response.text, usedModel: fallbackModel };
    }
    throw new Error('Empty text received from model');
  } catch (err2: any) {
    console.error(`[Gemini Error] Both AI models failed:`, err2.message);
    throw err2;
  }
}

/**
 * Searches Google for comprehensive details about a manga/webtoon title before generating subtitles and script.
 * Returns a human-readable summary of character names, plot, universe lore, and tone.
 */
export async function searchMangaInfo(mangaTitle: string): Promise<string> {
  const ai = getGenAI();
  if (!ai) {
    return `Manga Overview for "${mangaTitle}": Renowned webtoon featuring high-stakes action, tactical martial arts or supernatural fantasy, dynamic protagonist growth, and intense character confrontations.`;
  }

  try {
    const prompt = `Search Google for comprehensive, accurate details about the manga/webtoon titled "${mangaTitle}".
Find and construct a human-readable reference guide in plain text covering:
1. Official Series Title & Alternative Known Names
2. Author, Artist, Genre & Setting
3. Key Main Characters with their exact names, roles, and personality traits
4. Plot Synopsis & Core Lore / Power Systems
5. Tone & Dialogue Conventions (e.g. dramatic, comedic, martial arts, dark fantasy)

Format the output as a clean, structured, highly readable text summary.`;

    const response = await ai.models.generateContent({
      model: FAST_AI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    if (text && text.trim().length > 30) {
      return text.trim();
    }
  } catch (err) {
    console.warn('[Gemini Search Grounding] Search query info notice:', err);
  }

  return `Manga Overview for "${mangaTitle}": Renowned webtoon series with dynamic action, unique power abilities, and memorable hero-rival dynamics.`;
}

export async function generateWebtoonScript(params: {
  mangaId: number;
  chapterId: number;
  mangaTitle: string;
  chapterName: string;
  pages: string[];
  model?: string;
}): Promise<WebtoonScript> {
  const { mangaId, chapterId, mangaTitle, chapterName, pages, model } = params;

  // Step 1: Search details of the manga via Google Search Grounding
  const mangaDetailsSummary = await searchMangaInfo(mangaTitle);

  // Step 2: Sample up to 6 key page strips and fetch their actual image buffers for multimodal inspection
  const sampledPageUrls = pages.slice(0, 6);
  const fetchedImageParts = await Promise.all(
    sampledPageUrls.map((url) => fetchImageAsInlinePart(url))
  );

  const multimodalParts: any[] = [];
  fetchedImageParts.forEach((part, idx) => {
    if (part) {
      multimodalParts.push({ text: `=== MANGA CHAPTER PAGE STRIP #${idx + 1} IMAGE ===` });
      multimodalParts.push(part);
    }
  });

  const promptText = `You are a World-Class Anime & Webtoon Director, Lead Storyteller, and Master Dialogue Scriptwriter.
You are tasked with crafting an exceptional, cinematic, and non-generic webtoon video script for:
Manga Title: "${mangaTitle}"
Chapter: "${chapterName}"
Total Page Strips Available: ${pages.length}

${
  multimodalParts.length > 0
    ? `IMPORTANT: You have been provided with real high-resolution images of the manga page strips. Look closely at the artwork, character facial expressions, combat stances, energy auras, sound effects (SFX), and existing speech bubbles in the panels!`
    : `Carefully ground your story in the manga lore and details below.`
}

--- OFFICIAL MANGA LORE & SEARCH GROUNDING ---
${mangaDetailsSummary}
--- END MANGA LORE ---

MANDATE FOR DIALOGUE & SUBTITLES:
1. BAN GENERIC/REPETITIVE CLICHÉS:
   - STRICTLY FORBIDDEN: Do NOT write repetitive template lines like "हथियार ताने आगे बढ़ते हुए नायक ने पुकारा..." or "अपनी चमकती तलवार निकालते हुए...".
   - Make dialogue UNIQUE, emotionally charged, and tailored specifically to what is happening in each scene!
   - Capture the authentic personalities of each character: arrogant villains sneer, stoic heroes analyze calmly, energetic allies banter, and intense clashes have breathless dialogue.

2. NARRATOR STORYTELLER POINT-OF-VIEW (Say & Do Style):
   Every subtitle line must be written from the perspective of an immersive 3rd-person story narrator who is narrating the scene to the audience, describing BOTH:
   a) WHAT THE CHARACTER DOES (their physical actions, shifting expressions, stances, or magical surges).
   b) WHAT THE CHARACTER SAYS (their spoken words or shouts quoted directly in the narration).

   BILINGUAL EXAMPLES:
   - English: 'Tightening his grip on the cracked spear, Liam locked eyes with the towering beast and whispered, "Not while I still breathe," stepping into the creature\'s blinding aura.'
   - Hindi: 'टूटे हुए भाले पर अपनी पकड़ मजबूत करते हुए, लियम ने विशालकाय दानव की आँखों में घूरकर फुसफुसाया, "जब तक मेरी सांसें चल रही हैं, मैं तुम्हें आगे नहीं जाने दूंगा!", और उसकी दहकती ऊर्जा की ओर कदम बढ़ा दिए।'
   - English: 'Stumbling backward as black lightning fractured the cobblestones, the commander grimaced, shouting "Scatter immediately!", shielding his eyes from the glare.'
   - Hindi: 'काली बिजली से थरथराते पत्थरों के बीच लड़खड़ाते हुए सेनापति ने दाँत भींचकर चेतावनी दी, "फौरन यहाँ से दूर हटो!", और अपनी आँखों को उस चकाचौंध से बचाया।'

3. STRUCTURE & INCIDENTS (Multi-Scene Breakdown):
   - For each webtoon strip (from page 1 to ${Math.min(pages.length, 12)}), divide the vertical strip into 2 to 3 distinct visual scenes ("incidents").
   - Give each incident a descriptive title (e.g. "Opening Encounter", "Aura Awakening", "Lethal Clash", "Unexpected Arrival").
   - Provide accurate character names (use real names from the lore summary!), distinct actions, spoken lines, and bilingual subtitles (Hindi & English).
   - "overallStory": Write an engaging, atmospheric chapter synopsis in Hindi (कहानी का विवरण).

OUTPUT FORMAT: Return VALID JSON ONLY with this exact JSON structure:
{
  "overallStory": "Detailed, exciting Hindi chapter synopsis here...",
  "characters": [
    {
      "id": "char_1",
      "mangaId": ${mangaId},
      "chapterId": ${chapterId},
      "name": "Real Character Name",
      "role": "Role (e.g. मुख्य नायक / विरोधी / सहयोगी)",
      "description": "Short vivid description of personality and power",
      "keyLines": ["Iconic spoken line in Hindi 1", "Iconic spoken line in Hindi 2"]
    }
  ],
  "panels": [
    {
      "panelIndex": 1,
      "pageUrl": "${pages[0] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}",
      "dialogueHindi": "Hindi narrator POV subtitle describing what character does and says...",
      "dialogueEnglish": "English narrator POV subtitle describing what character does and says...",
      "characterAction": "Clear physical movement or action",
      "characterSays": "What the character says",
      "speaker": "Real Character Name or Narrator",
      "actionDescription": "Camera movement / visual focal point",
      "bgmSuggestion": "Cinematic BGM Track mood",
      "sfx": "Sound effect (e.g. Slash, Boom, Whisper)",
      "estimatedDurationSec": 4,
      "incidents": [
        {
          "incidentIndex": 1,
          "incidentTitle": "Top Scene Title",
          "cropRect": { "topPct": 0, "heightPct": 33 },
          "speaker": "Character Name",
          "characterAction": "What happens in top scene",
          "characterSays": "Dialogue in top scene",
          "dialogueHindi": "Hindi subtitle for top scene...",
          "dialogueEnglish": "English subtitle for top scene...",
          "sfx": "SFX",
          "actionDescription": "Camera zoom note"
        },
        {
          "incidentIndex": 2,
          "incidentTitle": "Mid Scene Title",
          "cropRect": { "topPct": 33, "heightPct": 33 },
          "speaker": "Character Name",
          "characterAction": "What happens in mid scene",
          "characterSays": "Dialogue in mid scene",
          "dialogueHindi": "Hindi subtitle for mid scene...",
          "dialogueEnglish": "English subtitle for mid scene...",
          "sfx": "SFX",
          "actionDescription": "Camera pan note"
        },
        {
          "incidentIndex": 3,
          "incidentTitle": "Climax Scene Title",
          "cropRect": { "topPct": 66, "heightPct": 34 },
          "speaker": "Character Name",
          "characterAction": "What happens in bottom scene",
          "characterSays": "Dialogue in bottom scene",
          "dialogueHindi": "Hindi subtitle for bottom scene...",
          "dialogueEnglish": "English subtitle for bottom scene...",
          "sfx": "SFX",
          "actionDescription": "Close-up action note"
        }
      ]
    }
  ]
}`;

  const aiContents =
    multimodalParts.length > 0 ? [...multimodalParts, { text: promptText }] : promptText;

  const ai = getGenAI();
  if (ai) {
    try {
      const { text, usedModel } = await generateWithBestAiFallback({
        model: model || BEST_AI_MODEL,
        contents: aiContents,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (text) {
        // Strip any markdown fences if present
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const panelsWithUrls: WebtoonPanel[] = (parsed.panels || []).map(
          (p: any, idx: number) => {
            const pageUrl =
              pages[idx] ||
              pages[0] ||
              'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600';

            const defaultIncidents: WebtoonIncident[] = [
              {
                incidentIndex: 1,
                incidentTitle: `Panel ${idx + 1} - Top Scene`,
                cropRect: { topPct: 0, heightPct: 33 },
                speaker: p.speaker || `${mangaTitle} Protagonist`,
                characterAction: p.characterAction || 'Advancing forward with determination',
                characterSays: p.characterSays || 'Stay focused!',
                dialogueHindi:
                  p.dialogueHindi ||
                  `दृढ़ संकल्प के साथ आगे बढ़ते हुए नायक ने चेताया, "सब सतर्क रहो!", और चारों तरफ छाए रहस्यमयी माहौल का मुआयना किया।`,
                dialogueEnglish:
                  p.dialogueEnglish ||
                  `Advancing with unwavering focus, the hero warned, "Stay vigilant!", scanning the eerie surroundings.`,
                sfx: p.sfx || 'Whoosh',
                actionDescription: 'Dynamic zoom on top scene',
              },
              {
                incidentIndex: 2,
                incidentTitle: `Panel ${idx + 1} - Mid Clash`,
                cropRect: { topPct: 33, heightPct: 33 },
                speaker: 'Narrator',
                characterAction: 'Energy flares across the battlefield',
                characterSays: 'Brace yourselves!',
                dialogueHindi: `धमाके की गूंज के बीच पीछे हटते हुए योद्धा ने चिल्लाकर कहा, "सब संभल जाओ!", जब ऊर्जा की प्रचंड लहर चारों तरफ फैल गई।`,
                dialogueEnglish: `Bracing against the massive shockwave, the warrior yelled, "Brace yourselves!", as explosive energy surged across the area.`,
                sfx: 'Boom',
                actionDescription: 'Pan across mid section',
              },
              {
                incidentIndex: 3,
                incidentTitle: `Panel ${idx + 1} - Decisive Strike`,
                cropRect: { topPct: 66, heightPct: 34 },
                speaker: 'Protagonist',
                characterAction: 'Unleashing decisive counter-strike',
                characterSays: 'This ends now!',
                dialogueHindi: `अपनी पूरी शक्ति केंद्रित करते हुए नायक ने दहाड़ लगाई, "यह यहीं खत्म होगा!", और अंतिम निर्णायक प्रहार झोंक दिया।`,
                dialogueEnglish: `Focusing all his inner strength, the hero roared, "This ends now!", driving into the decisive clash.`,
                sfx: 'Rumble',
                actionDescription: 'Close-up on bottom frame',
              },
            ];

            const panelHindi =
              p.dialogueHindi ||
              `दृढ़ संकल्प के साथ आगे बढ़ते हुए नायक ने चेताया, "सब सतर्क रहो!", और चारों तरफ छाए रहस्यमयी माहौल का मुआयना किया।`;
            const panelEnglish =
              p.dialogueEnglish ||
              `Advancing with unwavering focus, the hero warned, "Stay vigilant!", scanning the eerie surroundings.`;

            const rawIncidents =
              Array.isArray(p.incidents) && p.incidents.length > 0
                ? p.incidents
                : defaultIncidents;

            const normalizedIncidents = rawIncidents.map((inc: any) => ({
              ...inc,
              estimatedDurationSec:
                inc.estimatedDurationSec && inc.estimatedDurationSec !== 4
                  ? inc.estimatedDurationSec
                  : calculateDurationFromSubtitle(inc.dialogueHindi || inc.dialogueEnglish || panelHindi),
            }));

            const finalDuration =
              p.estimatedDurationSec && p.estimatedDurationSec !== 4
                ? p.estimatedDurationSec
                : calculateDurationFromSubtitle(panelHindi || panelEnglish);

            return {
              panelIndex: idx + 1,
              pageUrl,
              dialogueHindi: panelHindi,
              dialogueEnglish: panelEnglish,
              characterAction: p.characterAction,
              characterSays: p.characterSays,
              speaker: p.speaker || 'Narrator',
              actionDescription: p.actionDescription || 'Vertical webtoon camera scroll...',
              bgmSuggestion: p.bgmSuggestion || 'Cinematic Action BGM',
              sfx: p.sfx || 'Whoosh',
              estimatedDurationSec: finalDuration,
              incidents: normalizedIncidents,
            };
          }
        );

        // Ensure EVERY chapter page strip gets a panel — the AI may skip trailing
        // pages, but no image should ever be dropped from the generated script.
        for (let idx = panelsWithUrls.length; idx < pages.length; idx++) {
          const dHindi = `दृश्य जारी रहता है — पृष्ठ ${idx + 1} पर कहानी आगे बढ़ती है, और नायक अगले मोड़ के लिए तैयार होता है।`;
          const dEnglish = `The scene continues — on page ${idx + 1} the story moves forward as the hero readies for the next turn.`;
          const mkIncident = (n: number, top: number, height: number): WebtoonIncident => ({
            incidentIndex: n,
            incidentTitle: `Panel ${idx + 1} - Scene ${n}`,
            cropRect: { topPct: top, heightPct: height },
            speaker: n === 2 ? 'Narrator' : `${mangaTitle} Protagonist`,
            dialogueHindi: dHindi,
            dialogueEnglish: dEnglish,
            sfx: 'Whoosh',
            actionDescription: 'Vertical camera pan on strip section',
            estimatedDurationSec: calculateDurationFromSubtitle(dHindi),
          });
          panelsWithUrls.push({
            panelIndex: idx + 1,
            pageUrl: pages[idx],
            dialogueHindi: dHindi,
            dialogueEnglish: dEnglish,
            speaker: 'Narrator',
            actionDescription: 'Vertical webtoon camera scroll',
            bgmSuggestion: 'Cinematic Action BGM',
            sfx: 'Whoosh',
            estimatedDurationSec: calculateDurationFromSubtitle(dHindi),
            incidents: [mkIncident(1, 0, 33), mkIncident(2, 33, 33), mkIncident(3, 66, 34)],
          });
        }

        const characters: WebtoonCharacter[] = (parsed.characters || []).map(
          (c: any, idx: number) => ({
            id: c.id || `char_${mangaId}_${chapterId}_${idx + 1}`,
            mangaId,
            chapterId,
            name: c.name || `${mangaTitle} Character ${idx + 1}`,
            role: c.role || 'मुख्य पात्र',
            description: c.description || 'रहस्यमयी योद्धा',
            keyLines: Array.isArray(c.keyLines) ? c.keyLines : ['"मैं पीछे नहीं हटूंगा!"'],
          })
        );

        return {
          id: `${mangaId}_${chapterId}`,
          mangaId,
          chapterId,
          mangaTitle,
          chapterName,
          overallStory:
            parsed.overallStory ||
            `अध्याय ${chapterName} में ${mangaTitle} के मुख्य पात्रों के बीच एक धमाकेदार मुकाबला देखने को मिलता है।`,
          mangaDetailsSummary,
          subtitleMode: 'narrator_recap',
          characters,
          panels: panelsWithUrls,
          generatedAt: new Date().toISOString(),
          language: 'Hindi',
          modelUsed: usedModel,
        };
      }
    } catch (err) {
      console.warn('[Gemini Service] AI Generation exception, activating dynamic generator:', err);
    }
  }

  // Dynamic fallback generator if API key is missing or both models fail
  return generateFallbackWebtoonScript({
    mangaId,
    chapterId,
    mangaTitle,
    chapterName,
    pages,
    mangaDetailsSummary,
  });
}

/**
 * Extracts visual incidents & high-grade subtitles for a single panel image using Gemini Vision
 */
export async function extractPanelIncidentsFromImage(params: {
  imageUrl: string;
  mangaTitle: string;
  panelIndex: number;
  model?: string;
}): Promise<{ incidents: WebtoonIncident[]; modelUsed?: string }> {
  const { imageUrl, mangaTitle, panelIndex, model } = params;

  // Search manga info for grounding character names and dialogue style
  const mangaDetails = await searchMangaInfo(mangaTitle);

  // Fetch real image inline part
  const inlinePart = await fetchImageAsInlinePart(imageUrl);

  const ai = getGenAI();
  if (ai) {
    try {
      const prompt = `You are a Master Anime/Webtoon Story Director & Vision AI.
Manga Lore for "${mangaTitle}":
${mangaDetails}

Examine this high-resolution webtoon strip image (Panel #${panelIndex} of "${mangaTitle}").
Identify the distinct visual panels/incidents stacked vertically on this image.

MANDATE: HIGH QUALITY, NON-REPETITIVE NARRATOR POV SUBTITLES
For EACH incident found:
1. "speaker": Real character name from the manga lore or image dialogue bubble (e.g. Protagonist, Rival, Mentor, or Narrator).
2. "characterAction": Describe what the character is physically doing, their expression, or martial stance.
3. "characterSays": Direct spoken line.
4. "dialogueHindi": Vivid, cinematic Hindi narrator POV subtitle (Say & Do style, authentic dubbing tone).
5. "dialogueEnglish": Vivid, natural English narrator POV subtitle (Say & Do style).
6. "cropRect": Accurate vertical slice { "topPct": number, "heightPct": number }.

Return VALID JSON ONLY:
{
  "incidents": [
    {
      "incidentIndex": 1,
      "incidentTitle": "Top Scene Title",
      "cropRect": { "topPct": 0, "heightPct": 33 },
      "speaker": "Character Name",
      "characterAction": "What the character does",
      "characterSays": "Spoken quote",
      "dialogueHindi": "Hindi subtitle...",
      "dialogueEnglish": "English subtitle...",
      "sfx": "SFX",
      "actionDescription": "Camera note"
    }
  ]
}`;

      const contents = inlinePart ? [prompt, inlinePart] : [prompt, `Image URL: ${imageUrl}`];

      const { text, usedModel } = await generateWithBestAiFallback({
        model: model || BEST_AI_MODEL,
        contents,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (text) {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.incidents) && parsed.incidents.length > 0) {
          return { incidents: parsed.incidents, modelUsed: usedModel };
        }
      }
    } catch (err) {
      console.warn('[Gemini Vision] Error extracting incidents from image:', err);
    }
  }

  // Dynamic fallback incidents
  return {
    incidents: [
      {
        incidentIndex: 1,
        incidentTitle: `Panel ${panelIndex} - Top Scene`,
        cropRect: { topPct: 0, heightPct: 33 },
        speaker: `${mangaTitle} Hero`,
        characterAction: 'Stepping forward into the fray',
        characterSays: 'Stay behind me!',
        dialogueHindi: `धुंधले उजाले में आगे बढ़ते हुए नायक ने ललकारकर कहा, "सब मेरे पीछे रहो!", और अपनी इंद्रियों को पूरी तरह चौकन्ना कर लिया।`,
        dialogueEnglish: `Stepping forward into the dim light, the hero called out, "Stay behind me!", heightening every sense for sudden danger.`,
        sfx: 'Whoosh',
        actionDescription: 'Zoom-in on top scene',
      },
      {
        incidentIndex: 2,
        incidentTitle: `Panel ${panelIndex} - Mid Clash`,
        cropRect: { topPct: 33, heightPct: 33 },
        speaker: 'Narrator',
        characterAction: 'Tremors pulse across the area',
        characterSays: 'How can this power be so immense?',
        dialogueHindi: `हवा में फैलते भयानक दबाव को महसूस कर दंग रह गए साथी ने कांपते हुए कहा, "इतनी असीम शक्ति कैसे संभव है?", जब चारों तरफ कंपन होने लगा।`,
        dialogueEnglish: `Staggering under the sudden surge of hostile energy, the ally gasped, "How can this power be so immense?", as tremors shook the area.`,
        sfx: 'Boom',
        actionDescription: 'Pan across middle incident',
      },
      {
        incidentIndex: 3,
        incidentTitle: `Panel ${panelIndex} - Decisive Surge`,
        cropRect: { topPct: 66, heightPct: 34 },
        speaker: 'Hero',
        characterAction: 'Unleashing battle aura with fierce resolve',
        characterSays: 'I will break through this barrier!',
        dialogueHindi: `अपनी पूरी आत्मशक्ति को अंतिम वार में झोंकते हुए उसने दहाड़ लगाई, "मैं इस दीवार को तोड़कर रहूँगा!", और विनाशकारी प्रहार कर दिया।`,
        dialogueEnglish: `Gathering every ounce of inner strength into a blinding aura, he shouted, "I will break through this barrier!", driving into the clash.`,
        sfx: 'Rumble',
        actionDescription: 'Close up on bottom frame',
      },
    ],
    modelUsed: 'dynamic_generator',
  };
}

/**
 * Extracts dialogue and subtitles for a single cropped panel / scene using Gemini Vision
 */
export async function extractPanelSubtitleFromImage(params: {
  imageUrl: string;
  mangaTitle: string;
  panelIndex: number;
  model?: string;
}): Promise<{
  speaker: string;
  dialogueHindi: string;
  dialogueEnglish: string;
  characterAction?: string;
  characterSays?: string;
  sfx: string;
  modelUsed?: string;
}> {
  const { imageUrl, mangaTitle, panelIndex, model } = params;
  const ai = getGenAI();

  const inlinePart = await fetchImageAsInlinePart(imageUrl);

  if (ai) {
    try {
      const prompt = `You are a Master Manga Storyteller and Vision Dialogue Director.
Look at this manga scene (Panel #${panelIndex} from "${mangaTitle}").
Analyze the character's facial expression, action, and speech bubbles.
Craft dynamic, high-impact narrator POV subtitles in BOTH Hindi and English (describing what the character says and does).

CRITICAL:
- Do NOT use generic repetitive templates.
- Write vivid, cinematic lines with natural conversational flow.

Return VALID JSON ONLY:
{
  "speaker": "Accurate Character Name or Narrator",
  "characterAction": "What the character physically does",
  "characterSays": "Spoken quote",
  "dialogueHindi": "Narrator POV Hindi subtitle (Say & Do style)",
  "dialogueEnglish": "Narrator POV English subtitle (Say & Do style)",
  "sfx": "Appropriate sound effect"
}`;

      const contents = inlinePart ? [prompt, inlinePart] : [prompt, `Image URL: ${imageUrl}`];

      const { text, usedModel } = await generateWithBestAiFallback({
        model: model || BEST_AI_MODEL,
        contents,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (text) {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          speaker: parsed.speaker || 'Narrator',
          characterAction: parsed.characterAction,
          characterSays: parsed.characterSays,
          dialogueHindi:
            parsed.dialogueHindi ||
            `गंभीर मुद्रा अपनाते हुए नायक ने कहा, "मुकाबले का समय आ चुका है," और आगे के संघर्ष के लिए खुद को तैयार कर लिया।`,
          dialogueEnglish:
            parsed.dialogueEnglish ||
            `Taking a resolute stance, the hero announced, "The moment has arrived," steeling himself for the clash ahead.`,
          sfx: parsed.sfx || 'Whoosh',
          modelUsed: usedModel,
        };
      }
    } catch (err) {
      console.warn('[Gemini Vision] Error extracting panel text:', err);
    }
  }

  return {
    speaker: 'Narrator',
    characterAction: 'Advancing resolutely into the fray',
    characterSays: 'The moment has arrived.',
    dialogueHindi: `गंभीर मुद्रा अपनाते हुए नायक ने कहा, "मुकाबले का समय आ चुका है," और आगे के संघर्ष के लिए खुद को तैयार कर लिया।`,
    dialogueEnglish: `Taking a resolute stance, the hero announced, "The moment has arrived," steeling himself for the clash ahead.`,
    sfx: 'Whoosh',
    modelUsed: 'dynamic_generator',
  };
}

function generateFallbackWebtoonScript(params: {
  mangaId: number;
  chapterId: number;
  mangaTitle: string;
  chapterName: string;
  pages: string[];
  mangaDetailsSummary?: string;
}): WebtoonScript {
  const { mangaId, chapterId, mangaTitle, chapterName, pages, mangaDetailsSummary } = params;
  const pageList =
    pages.length > 0
      ? pages
      : ['https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'];

  const dynamicCharacters: WebtoonCharacter[] = [
    {
      id: `char_${mangaId}_${chapterId}_1`,
      mangaId,
      chapterId,
      name: `${mangaTitle} Protagonist`,
      role: 'मुख्य नायक (Protagonist)',
      description: 'दृढ़ निश्चयी योद्धा जो अपनी सीमाओं को लांघकर आगे बढ़ता है।',
      keyLines: [
        `"जब तक मेरे भीतर सामर्थ्य है, मैं पीछे नहीं हटूंगा!"`,
        `"इस मुकाबले का अंत मेरी शर्तों पर होगा!"`,
      ],
    },
    {
      id: `char_${mangaId}_${chapterId}_2`,
      mangaId,
      chapterId,
      name: 'Rival Challenger',
      role: 'प्रतिद्वंद्वी (Rival)',
      description: 'अथाह शक्तियों से लैस गुप्त प्रतिद्वंदी।',
      keyLines: ['"क्या तुम्हें सच में लगता है कि तुम मुझे चुनौती दे सकते हो?"'],
    },
  ];

  const hindiVividScenarios = [
    `गहरी खामोशी को चीरते हुए, अपनी चमकती तलवार थामे वो आगे बढ़ा... और सख्त लहजे में चेताया— "खामोश! जो कोई भी वहाँ छुपा है, फौरन बाहर आ जाओ!"`,
    `हवा में अचानक उपजे ठंडे दबाव को भांपते हुए उसने मुट्ठियाँ भींची और कहा, "कुछ बहुत भयानक आने वाला है," और अपनी रक्षात्मक मुद्रा संभाल ली।`,
    `अंधेरे के साये से बाहर निकलते हुए प्रतिद्वंदी ने ठंडी मुस्कान के साथ ललकारा, "क्या तुम्हें सच में लगा था कि तुम मुझसे बच निकलोगे?", और चारों ओर अपनी घातक आभा फैला दी।`,
    `अचानक हुए धमाके से बचने के लिए पीछे छलांग लगाते हुए नायक ने चिल्लाकर कहा, "संभल जाओ! यह हमला साधारण नहीं है!", और दुश्मन की अगली चाल भांपने लगा।`,
    `अपनी आत्मा की सारी शक्ति को एक प्रचंड प्रहार में केंद्रित करते हुए उसने दहाड़ लगाई, "मैं अपनी हर सीमा को पार कर दूंगा!", और सीधे तूफ़ान के बीच कूद पड़ा।`,
    `ऊर्जा के भीषण टकराव से कांपते हुए विरोधी ने अविश्वास से फुसफुसाया, "इसके पास इतनी विनाशकारी शक्ति कहाँ से आई?", जब उसके पैरों तले की ज़मीन चटकने लगी।`,
    `उड़ती धूल और अंगारों के बीच अडिग खड़े होकर उसने अपनी स्थिति संभाली और दृढ़ता से कहा, "यह मुकाबला अभी शुरू हुआ है," और अंतिम प्रहार के लिए तैयार हो गया।`,
  ];

  const englishVividScenarios = [
    `Slicing through the heavy silence with his drawn blade, he stepped forward and commanded, "Show yourself immediately—whoever hides in the shadows!"`,
    `Feeling the sudden icy pressure in the atmosphere, he clenched his fists, warning, "Something catastrophic is approaching," locking into a defensive stance.`,
    `Emerging from the creeping dark with a cold sneer, the rival taunted, "Did you truly believe you could escape my grasp?", releasing a suffocating aura.`,
    `Leaping backward as shockwaves cracked the stone floor, the hero shouted, "Brace yourselves! That was no ordinary technique!", calculating the counter-move.`,
    `Gathering every thread of inner aura into a blazing strike, he roared, "I will shatter every limitation!", charging straight into the tempest.`,
    `Trembling amidst the colossal collision of energy, the antagonist muttered in disbelief, "How can an ordinary warrior wield such monstrous power?", as the ground split.`,
    `Standing resolute amidst swirling embers and smoke, the fighter reset his balance, declaring, "This battle has only just begun," preparing the finishing blow.`,
  ];

  // Every page strip becomes a panel — never drop images during auto-extraction.
  const panels: WebtoonPanel[] = pageList.map((url, idx) => {
    const dHindi = hindiVividScenarios[idx % hindiVividScenarios.length];
    const dEnglish = englishVividScenarios[idx % englishVividScenarios.length];
    const inc1Hindi = hindiVividScenarios[(idx * 2) % hindiVividScenarios.length];
    const inc1English = englishVividScenarios[(idx * 2) % englishVividScenarios.length];
    const inc2Hindi = hindiVividScenarios[(idx * 2 + 1) % hindiVividScenarios.length];
    const inc2English = englishVividScenarios[(idx * 2 + 1) % englishVividScenarios.length];
    const inc3Hindi = `धमाके के बीच मुस्कुराते हुए उसने कहा, "यह तो बस शुरुआत है!", और अपनी अंतिम शक्ति को जगाया।`;
    const inc3English = `Smirking through the explosive debris, he declared, "This is only the beginning!", awakening his latent strength.`;

    return {
      panelIndex: idx + 1,
      pageUrl: url,
      dialogueHindi: dHindi,
      dialogueEnglish: dEnglish,
      speaker: idx % 2 === 0 ? `${mangaTitle} Protagonist` : 'Narrator',
      actionDescription:
        idx % 2 === 0
          ? 'Vertical webtoon camera zoom-in on protagonist'
          : 'Slow pan down on atmosphere',
      bgmSuggestion: idx % 3 === 0 ? 'Mysterious Suspense Track' : 'High-Octane Battle Theme',
      sfx: idx % 2 === 0 ? 'Slash / Burst' : 'Low Rumble',
      estimatedDurationSec: calculateDurationFromSubtitle(dHindi),
      incidents: [
        {
          incidentIndex: 1,
          incidentTitle: `Panel ${idx + 1} - Top Scene`,
          cropRect: { topPct: 0, heightPct: 33 },
          speaker: idx % 2 === 0 ? `${mangaTitle} Protagonist` : 'Narrator',
          dialogueHindi: inc1Hindi,
          dialogueEnglish: inc1English,
          sfx: 'Whoosh',
          actionDescription: 'Zoom-in on top action cut',
          estimatedDurationSec: calculateDurationFromSubtitle(inc1Hindi),
        },
        {
          incidentIndex: 2,
          incidentTitle: `Panel ${idx + 1} - Mid Clash`,
          cropRect: { topPct: 33, heightPct: 33 },
          speaker: 'Narrator',
          dialogueHindi: inc2Hindi,
          dialogueEnglish: inc2English,
          sfx: 'Boom',
          actionDescription: 'Pan down middle strip',
          estimatedDurationSec: calculateDurationFromSubtitle(inc2Hindi),
        },
        {
          incidentIndex: 3,
          incidentTitle: `Panel ${idx + 1} - Climax Strike`,
          cropRect: { topPct: 66, heightPct: 34 },
          speaker: 'Rival Challenger',
          dialogueHindi: inc3Hindi,
          dialogueEnglish: inc3English,
          sfx: 'Rumble',
          actionDescription: 'Close up on bottom frame',
          estimatedDurationSec: calculateDurationFromSubtitle(inc3Hindi),
        },
      ],
    };
  });

  return {
    id: `${mangaId}_${chapterId}`,
    mangaId,
    chapterId,
    mangaTitle,
    chapterName,
    overallStory: `अध्याय "${chapterName}" में ${mangaTitle} के पात्रों के बीच एक तीव्र, रोमांचक और नाटकीय मोड़ देखने को मिलता है। मुख्य नायक अपनी सीमाओं से परे जाकर चुनौतियों का सामना करता है।`,
    mangaDetailsSummary:
      mangaDetailsSummary ||
      `Manga Overview for "${mangaTitle}": High-stakes action fantasy webtoon with dynamic hero battles.`,
    subtitleMode: 'narrator_recap',
    characters: dynamicCharacters,
    panels,
    generatedAt: new Date().toISOString(),
    language: 'Hindi',
    modelUsed: 'dynamic_generator',
  };
}
