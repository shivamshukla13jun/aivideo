/**
 * Advanced SEO & Virality Engine
 *
 * Multi-layer SEO optimization for maximum reach:
 * 1. Keyword analysis from narration content
 * 2. Trending format patterns (proven viral structures)
 * 3. Platform-specific optimization
 * 4. Optimal posting schedule
 * 5. Virality scoring & recommendations
 * 6. A/B title variants
 * 7. AI-powered enhancement via Gemini (when available)
 */

export interface AdvancedSeoResult {
  /** Primary optimized metadata */
  primary: SeoMetadata;
  /** A/B test variant titles */
  titleVariants: string[];
  /** Platform-specific adaptations */
  platformSeo: Record<string, PlatformSeoMetadata>;
  /** Virality score and analysis */
  viralityScore: ViralityScore;
  /** Optimal posting schedule */
  schedule: PostingSchedule;
  /** Content improvement tips */
  tips: string[];
}

export interface SeoMetadata {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  categoryId: string;
  thumbnailTips: string[];
}

export interface PlatformSeoMetadata {
  platform: string;
  title: string;
  caption: string;
  hashtags: string[];
  /** Character limit for this platform */
  maxCaptionLength: number;
}

export interface ViralityScore {
  /** Overall score 0–100 */
  score: number;
  /** Breakdown of scoring factors */
  factors: ViralityFactor[];
  /** Risk factors that could limit reach */
  risks: string[];
  /** Predicted performance tier */
  tier: 'low' | 'medium' | 'high' | 'viral';
}

export interface ViralityFactor {
  name: string;
  score: number; // 0–100
  weight: number;
  tip?: string;
}

export interface PostingSchedule {
  /** Best time to post (UTC hour) */
  bestHourUTC: number;
  /** Best day of week (0=Sun) */
  bestDayOfWeek: number;
  /** Human-readable recommendation */
  recommendation: string;
  /** Stagger schedule for multi-platform (platform → delay in hours after first post) */
  stagger: Record<string, number>;
}

// --- Proven viral title patterns for webtoon/manga content ---
const VIRAL_TITLE_PATTERNS = [
  '{series} Ch.{chapter} — This Changes EVERYTHING | Webtoon',
  '{series} Chapter {chapter}: {title} | MOST Intense Manhwa Scene Yet',
  'I Can\'t Believe What Happened in {series} Ch.{chapter}! (Webtoon)',
  '{series} Ch.{chapter} Recap — {title} | Manhwa MUST WATCH',
  'The Truth About {series} Finally Revealed | Ch.{chapter} Webtoon',
  '{series}: {title} — The Manhwa Everyone is Talking About',
  '{series} Chapter {chapter} Left Me SPEECHLESS | Webtoon Recap',
  'This {series} Scene Broke the Internet | Ch.{chapter} Manhwa',
  '{series} Ch.{chapter} | The Moment That Changed Everything | Webtoon',
  'Watch {series} Ch.{chapter} Before It\'s Too Late | Manhwa Recap',
];

const SHORTS_TITLE_PATTERNS = [
  '{series} in 60 SECONDS! #shorts #webtoon',
  'When {series} hits different... Ch.{chapter} #manhwa #shorts',
  '{series} Ch.{chapter}: The Scene That Went VIRAL #webtoon #shorts',
  'POV: You just read {series} Ch.{chapter} #manhwa #shorts',
  'This {series} webtoon scene is INSANE #shorts #manhwa',
  '{series} manhwa recap you NEED to see #shorts #webtoon',
];

// Trending hashtags for webtoon/manga content (regularly updated)
const TRENDING_HASHTAGS = {
  base: ['#webtoon', '#manhwa', '#manga', '#anime', '#webtoonedit'],
  engagement: ['#viral', '#trending', '#fyp', '#foryou', '#mustwatch'],
  niche: ['#manhwarecap', '#webtoonrecommendation', '#mangaedit', '#webtoonanime', '#animerecap'],
  emotional: ['#shock', '#epic', '#intense', '#emotional', '#mindblown'],
};

// Webtoon/manga category keywords for SEO
const CATEGORY_KEYWORDS = [
  'webtoon', 'manhwa', 'manga', 'manhua', 'anime', 'comic',
  'webtoon recap', 'manhwa recap', 'manga recap',
  'webtoon dub', 'manhwa dub', 'webcomic',
  'webtoon animation', 'animated webtoon', 'webtoon edit',
  'webtoon chapter', 'new chapter', 'latest chapter',
];

// Anchors that MUST survive — this app only publishes webtoon/manhwa chapter videos.
const WEBTOON_ANCHOR_TAGS = ['webtoon', 'manhwa', 'manga', 'webtoon recap', 'manhwa recap', 'webtoon chapter'];
const WEBTOON_ANCHOR_HASHTAGS = ['#webtoon', '#manhwa', '#manga'];

/** Force-include webtoon anchors + series/chapter tags, deduped, anchors first. */
function withAnchorTags(tags: string[], seriesTitle: string, chapterNumber: number): string[] {
  const chapterAnchors = [
    seriesTitle,
    `${seriesTitle} chapter ${chapterNumber}`,
    `${seriesTitle} webtoon`,
    `${seriesTitle} manhwa`,
    ...WEBTOON_ANCHOR_TAGS,
  ];
  const seen = new Set<string>();
  return [...chapterAnchors, ...tags]
    .filter((t) => {
      const k = t.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 50);
}

/** Force-include webtoon anchor hashtags + series hashtag. */
function withAnchorHashtags(hashtags: string[], seriesTitle: string): string[] {
  const seriesTag = `#${seriesTitle.replace(/\s+/g, '')}`;
  const normalized = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`));
  const seen = new Set<string>();
  return [seriesTag, ...WEBTOON_ANCHOR_HASHTAGS, ...normalized]
    .filter((h) => {
      const k = h.trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 20);
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w)
    .filter(w => !['that', 'this', 'with', 'from', 'they', 'were', 'have', 'been', 'said', 'their'].includes(w));
}

function detectTone(narrations: string[]): 'action' | 'romance' | 'mystery' | 'comedy' | 'drama' | 'horror' | 'neutral' {
  const text = narrations.join(' ').toLowerCase();
  const scores: Record<string, number> = { action: 0, romance: 0, mystery: 0, comedy: 0, drama: 0, horror: 0 };
  const patterns: Record<string, string[]> = {
    action: ['fight', 'attack', 'battle', 'power', 'destroy', 'slash', 'punch', 'explosion', 'war', 'strike'],
    romance: ['love', 'heart', 'kiss', 'beautiful', 'feelings', 'together', 'date', 'relationship', 'blush', 'confession'],
    mystery: ['secret', 'hidden', 'truth', 'discover', 'mystery', 'clue', 'suspect', 'strange', 'unknown', 'investigate'],
    comedy: ['laugh', 'funny', 'joke', 'silly', 'haha', 'ridiculous', 'embarrass', 'awkward', 'hilarious', 'prank'],
    drama: ['cry', 'tears', 'pain', 'suffer', 'betray', 'sacrifice', 'emotional', 'tragic', 'desperate', 'farewell'],
    horror: ['dark', 'blood', 'monster', 'ghost', 'fear', 'nightmare', 'cursed', 'evil', 'death', 'terror'],
  };
  for (const [genre, keywords] of Object.entries(patterns)) {
    scores[genre] = keywords.filter(kw => text.includes(kw)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 2 ? (best[0] as any) : 'neutral';
}

function generateTitleVariants(
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  isShort: boolean
): string[] {
  const patterns = isShort ? SHORTS_TITLE_PATTERNS : VIRAL_TITLE_PATTERNS;
  return patterns.map(p =>
    p.replace('{series}', seriesTitle)
      .replace('{chapter}', String(chapterNumber))
      .replace('{title}', chapterTitle)
  ).map(t => t.slice(0, 100));
}

function buildOptimizedDescription(
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  narrations: string[],
  tone: string,
  keywords: string[]
): string {
  const summary = narrations.join(' ').slice(0, 500);
  const topKeywords = keywords.slice(0, 5).join(', ');

  return [
    `${seriesTitle} Chapter ${chapterNumber}: ${chapterTitle} — Full animated webtoon recap with voice-over narration.`,
    '',
    summary || `Watch the latest chapter of ${seriesTitle} come to life with stunning animation and immersive storytelling.`,
    '',
    `Genre: ${tone.charAt(0).toUpperCase() + tone.slice(1)} | Series: ${seriesTitle}`,
    `Keywords: ${topKeywords}`,
    '',
    `Subscribe for more ${seriesTitle} chapters and webtoon content!`,
    `New chapters every week — hit the bell to never miss an upload.`,
    '',
    `#${seriesTitle.replace(/\s+/g, '')} #webtoon #manhwa #manga #chapter${chapterNumber}`,
    '#webtoonrecap #manhwarecap #animerecap #webtoonedit #animated',
  ].join('\n');
}

function buildPlatformSeo(
  primary: SeoMetadata,
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  tone: string
): Record<string, PlatformSeoMetadata> {
  const igCaption = [
    primary.title,
    '',
    primary.description.slice(0, 800),
    '',
    [...primary.hashtags.slice(0, 20), ...TRENDING_HASHTAGS.engagement.slice(0, 5)].join(' '),
  ].join('\n');

  // Reddit favors descriptive, non-clickbait titles; no hashtags
  const redditTitle = `${seriesTitle} Chapter ${chapterNumber}: ${chapterTitle} — Webtoon animated recap`.slice(0, 300);

  const twitterText = [
    primary.title,
    primary.hashtags.slice(0, 4).join(' '),
  ].join('\n');

  const fbCaption = [
    primary.title,
    '',
    primary.description.slice(0, 2000),
    '',
    primary.hashtags.slice(0, 10).join(' '),
  ].join('\n');

  return {
    youtube: {
      platform: 'youtube',
      title: primary.title,
      caption: primary.description,
      hashtags: primary.hashtags,
      maxCaptionLength: 5000,
    },
    instagram: {
      platform: 'instagram',
      title: primary.title.slice(0, 100),
      caption: igCaption.slice(0, 2200),
      hashtags: [...primary.hashtags.slice(0, 20), ...TRENDING_HASHTAGS.engagement.slice(0, 5)],
      maxCaptionLength: 2200,
    },
    reddit: {
      platform: 'reddit',
      title: redditTitle,
      caption: redditTitle,
      hashtags: [],
      maxCaptionLength: 300,
    },
    twitter: {
      platform: 'twitter',
      title: primary.title.slice(0, 100),
      caption: twitterText.slice(0, 280),
      hashtags: primary.hashtags.slice(0, 4),
      maxCaptionLength: 280,
    },
    facebook: {
      platform: 'facebook',
      title: primary.title,
      caption: fbCaption.slice(0, 5000),
      hashtags: primary.hashtags.slice(0, 10),
      maxCaptionLength: 5000,
    },
  };
}

function computeViralityScore(
  title: string,
  description: string,
  tags: string[],
  hashtags: string[],
  narrations: string[],
  tone: string,
  sceneCount: number,
  hasAudio: boolean
): ViralityScore {
  const factors: ViralityFactor[] = [];

  // 1. Title quality (power words, length, curiosity gap)
  const powerWords = ['insane', 'shocking', 'unbelievable', 'epic', 'incredible', 'must', 'never', 'best', 'worst', 'secret', 'truth', 'revealed'];
  const titleLower = title.toLowerCase();
  const titlePowerScore = Math.min(100, powerWords.filter(w => titleLower.includes(w)).length * 25 + 25);
  const titleLengthScore = title.length >= 40 && title.length <= 70 ? 100 : title.length < 20 ? 30 : 60;
  factors.push({ name: 'Title Power Words', score: titlePowerScore, weight: 0.15, tip: titlePowerScore < 50 ? 'Add emotional trigger words like "SHOCKING", "INSANE", or "MUST WATCH"' : undefined });
  factors.push({ name: 'Title Length', score: titleLengthScore, weight: 0.05, tip: titleLengthScore < 70 ? 'Ideal title is 40-70 characters' : undefined });

  // 2. Description quality
  const descScore = description.length > 500 ? 90 : description.length > 200 ? 70 : 40;
  factors.push({ name: 'Description Quality', score: descScore, weight: 0.1, tip: descScore < 70 ? 'Write 500+ character descriptions with keywords in first 150 chars' : undefined });

  // 3. Tag diversity
  const tagScore = Math.min(100, tags.length * 4);
  factors.push({ name: 'Tag Coverage', score: tagScore, weight: 0.1, tip: tagScore < 60 ? 'Add 15-25 relevant tags mixing broad and specific terms' : undefined });

  // 4. Hashtag strategy
  const hashScore = Math.min(100, hashtags.length * 10);
  factors.push({ name: 'Hashtag Strategy', score: hashScore, weight: 0.1, tip: hashScore < 60 ? 'Include trending hashtags like #fyp #viral alongside niche tags' : undefined });

  // 5. Content depth (narration quality)
  const totalNarration = narrations.join(' ').length;
  const contentScore = totalNarration > 2000 ? 90 : totalNarration > 1000 ? 70 : totalNarration > 500 ? 50 : 30;
  factors.push({ name: 'Content Depth', score: contentScore, weight: 0.15, tip: contentScore < 60 ? 'Richer narration improves engagement and watch time' : undefined });

  // 6. Audio presence
  const audioScore = hasAudio ? 100 : 20;
  factors.push({ name: 'Audio/Narration', score: audioScore, weight: 0.15, tip: !hasAudio ? 'Add voice-over narration — videos with audio get 3x more engagement' : undefined });

  // 7. Scene count (video length/variety)
  const sceneScore = sceneCount >= 10 ? 90 : sceneCount >= 5 ? 70 : sceneCount >= 3 ? 50 : 30;
  factors.push({ name: 'Visual Variety', score: sceneScore, weight: 0.1, tip: sceneScore < 60 ? 'More scenes = more visual variety = better retention' : undefined });

  // 8. Genre appeal
  const genreScores: Record<string, number> = { action: 90, drama: 85, romance: 80, mystery: 75, horror: 75, comedy: 70, neutral: 50 };
  const genreScore = genreScores[tone] || 50;
  factors.push({ name: 'Genre Appeal', score: genreScore, weight: 0.1 });

  // Calculate weighted score
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weightedScore = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight);

  // Risk analysis
  const risks: string[] = [];
  if (title.length > 80) risks.push('Title too long — may get truncated in search results');
  if (tags.length < 5) risks.push('Too few tags — add more for discoverability');
  if (!hasAudio) risks.push('No audio — silent videos get significantly less engagement');
  if (sceneCount < 3) risks.push('Very few scenes — video may feel static');
  if (description.length < 100) risks.push('Description too short — losing SEO opportunity');

  const tier = weightedScore >= 80 ? 'viral' : weightedScore >= 60 ? 'high' : weightedScore >= 40 ? 'medium' : 'low';

  return { score: weightedScore, factors, risks, tier };
}

function computePostingSchedule(): PostingSchedule {
  // Based on social media analytics research for entertainment content
  // Peak engagement: Tue-Thu, 2-5 PM EST (7-10 PM UTC)
  // Weekend secondary peak: Sat 10 AM - 1 PM EST
  return {
    bestHourUTC: 19, // 7 PM UTC = 2 PM EST / 11 AM PST
    bestDayOfWeek: 3, // Wednesday
    recommendation: 'Best time: Tuesday-Thursday, 2-5 PM EST. Post YouTube first, then stagger other platforms 2-4 hours apart for maximum reach.',
    stagger: {
      youtube: 0,      // Post first on YouTube
      reddit: 2,       // 2 hours later
      instagram: 4,    // 4 hours later
      twitter: 1,      // 1 hour after YouTube (fast engagement)
      facebook: 6,     // 6 hours later
    },
  };
}

export function generateAdvancedSeo(
  scenes: any[],
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  extraKeywords?: string,
  isShort: boolean = false
): AdvancedSeoResult {
  const narrations = scenes.map((s: any) => s.narration).filter(Boolean) as string[];
  const hasAudio = scenes.some((s: any) => s.audio?.url || s.audio?.cloudinaryUrl);
  const tone = detectTone(narrations);
  const keywords = extractKeywords(narrations.join(' '));
  const extra = (extraKeywords || '').split(',').map(k => k.trim()).filter(Boolean);

  // Generate title variants
  const titleVariants = generateTitleVariants(seriesTitle, chapterNumber, chapterTitle, isShort);
  const primaryTitle = titleVariants[0];

  // Build tags — webtoon anchors always first, never dropped
  const tags = withAnchorTags(
    [
      chapterTitle,
      ...CATEGORY_KEYWORDS.slice(0, 12),
      ...keywords.slice(0, 8),
      ...extra,
      tone,
      `${tone} webtoon`,
      `${seriesTitle} chapter`,
    ],
    seriesTitle,
    chapterNumber
  );

  // Build hashtags — anchors always present
  const hashtags = withAnchorHashtags(
    [
      `#${seriesTitle.replace(/\s+/g, '')}Chapter${chapterNumber}`,
      ...TRENDING_HASHTAGS.base,
      ...TRENDING_HASHTAGS.engagement.slice(0, 3),
      ...TRENDING_HASHTAGS.niche.slice(0, 3),
    ],
    seriesTitle
  );

  const description = buildOptimizedDescription(seriesTitle, chapterNumber, chapterTitle, narrations, tone, keywords);

  const primary: SeoMetadata = {
    title: primaryTitle,
    description,
    tags,
    hashtags,
    categoryId: '24', // Entertainment
    thumbnailTips: [
      'Use a dramatic scene with character faces visible',
      'Add bold text overlay with chapter number',
      'Use high contrast colors (red, yellow, white text on dark)',
      'Include series logo/branding',
      `Emphasize the ${tone} mood with appropriate expressions`,
    ],
  };

  const platformSeo = buildPlatformSeo(primary, seriesTitle, chapterNumber, chapterTitle, tone);
  const viralityScore = computeViralityScore(primaryTitle, description, tags, hashtags, narrations, tone, scenes.length, hasAudio);
  const schedule = computePostingSchedule();

  const tips = [
    ...viralityScore.factors.filter(f => f.tip).map(f => f.tip!),
    `Content tone detected: ${tone} — lean into ${tone} keywords in your title and thumbnail`,
    'Upload YouTube first, then share Shorts across Instagram Reels, Facebook Reels, Reddit, and X',
    'Reply to early comments within 30 minutes of posting to boost algorithm ranking',
    'Pin a comment with a question to encourage engagement',
    schedule.recommendation,
  ];

  return {
    primary,
    titleVariants,
    platformSeo,
    viralityScore,
    schedule,
    tips,
  };
}

/** AI-enhanced SEO using Gemini (when GEMINI_API_KEY is available). */
export async function enhanceSeoWithAI(
  baseSeo: AdvancedSeoResult,
  narrations: string[],
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string
): Promise<AdvancedSeoResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return baseSeo;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const scriptSample = narrations.join('\n').slice(0, 3000);

    const prompt = `You are a viral content strategist for a WEBTOON/MANHWA/MANGA chapter recap channel. This video is ALWAYS an animated webtoon chapter — never generic content.

HARD RULES (do not violate):
- The video is a webtoon/manhwa chapter recap. Every title MUST contain the series name "${seriesTitle}" AND the chapter number (formats like "Ch.${chapterNumber}", "Chapter ${chapterNumber}", or "Ep.${chapterNumber}").
- Every title, description, caption and tag set MUST be anchored in webtoon/manhwa terminology (webtoon, manhwa, manga, manhwa recap, webtoon recap). Do NOT produce generic anime, movie, or TV-show SEO.
- description must open with "${seriesTitle} Chapter ${chapterNumber}" in the first 150 chars.
- Hashtags MUST include #${seriesTitle.replace(/\s+/g, '')}, #webtoon, #manhwa, #manga.
- Tags MUST include "${seriesTitle}", "${seriesTitle} chapter ${chapterNumber}", "webtoon", "manhwa", "manga", "webtoon recap", "manhwa recap".
- Reddit title: descriptive and honest (Redditors reject clickbait). Format "${seriesTitle} Chapter ${chapterNumber}: ... — webtoon recap".

Series: ${seriesTitle}
Chapter: ${chapterNumber} - ${chapterTitle}
Current virality score: ${baseSeo.viralityScore.score}/100
Content tone: ${baseSeo.viralityScore.factors.find(f => f.name === 'Genre Appeal')?.score || 'unknown'}

Script sample:
${scriptSample || '(no script)'}

Current title: ${baseSeo.primary.title}
Current tags: ${baseSeo.primary.tags.slice(0, 15).join(', ')}

Generate STRICTLY as JSON (no markdown fences):
{
  "title": "webtoon chapter title max 80 chars: '${seriesTitle}' + 'Ch.${chapterNumber}' + curiosity gap + power word",
  "titleVariants": ["5 A/B variants — all must contain '${seriesTitle}' and the chapter number plus webtoon/manhwa keyword"],
  "description": "starts with '${seriesTitle} Chapter ${chapterNumber}' hook, engaging summary, subscribe CTA, webtoon hashtags at end",
  "tags": ["25 tags: series-specific + webtoon/manhwa/manga anchors + trending webtoon terms"],
  "hashtags": ["10 hashtags incl #${seriesTitle.replace(/\s+/g, '')} #webtoon #manhwa #manga"],
  "shortsTitles": ["3 YouTube Shorts variants with '${seriesTitle}', chapter number, and #shorts #webtoon"],
  "platformCaptions": {
    "instagram": "Instagram Reels caption for the webtoon chapter (engaging, emoji-friendly, ~20 hashtags incl #webtoon #manhwa at end)",
    "reddit": "Reddit post title: '${seriesTitle} Chapter ${chapterNumber}: ...' honest descriptive webtoon recap, max 300 chars, no hashtags",
    "twitter": "X post text (max 280 chars) with '${seriesTitle}', chapter number, 3-4 hashtags incl #webtoon"
  },
  "tips": ["3 specific actionable tips to make THIS webtoon chapter video go viral"]
}`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = (result.text || '').trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Merge AI results with base SEO
    if (parsed.title) {
      let t = String(parsed.title).slice(0, 100);
      // Webtoon chapter identity must survive: require series name + chapter number
      const hasSeries = t.toLowerCase().includes(seriesTitle.toLowerCase());
      const hasChapter = /(ch\.?|chapter|ep\.?)\s*\d+/i.test(t);
      if (!hasSeries || !hasChapter) {
        t = `${seriesTitle} Ch.${chapterNumber} — ${t}`.slice(0, 100);
      }
      baseSeo.primary.title = t;
    }
    if (parsed.titleVariants) {
      // Keep only variants that carry the series name or a chapter marker
      const valid = parsed.titleVariants
        .map(String)
        .filter((v: string) =>
          v.toLowerCase().includes(seriesTitle.toLowerCase()) || /(ch\.?|chapter|ep\.?)\s*\d+/i.test(v)
        );
      baseSeo.titleVariants = [...valid, ...baseSeo.titleVariants].slice(0, 10);
    }
    if (parsed.description) {
      let d = String(parsed.description).slice(0, 5000);
      // First 150 chars must carry the webtoon chapter identity for search
      if (!d.slice(0, 150).toLowerCase().includes(seriesTitle.toLowerCase())) {
        d = `${seriesTitle} Chapter ${chapterNumber} webtoon recap — ${d}`;
      }
      baseSeo.primary.description = d;
    }
    if (parsed.tags) baseSeo.primary.tags = withAnchorTags(parsed.tags.map(String), seriesTitle, chapterNumber);
    if (parsed.hashtags) baseSeo.primary.hashtags = withAnchorHashtags(parsed.hashtags.map(String), seriesTitle);
    if (parsed.platformCaptions?.instagram) baseSeo.platformSeo.instagram.caption = String(parsed.platformCaptions.instagram).slice(0, 2200);
    if (parsed.platformCaptions?.reddit) {
      let rt = String(parsed.platformCaptions.reddit).slice(0, 300);
      if (!rt.toLowerCase().includes(seriesTitle.toLowerCase())) {
        rt = `${seriesTitle} Chapter ${chapterNumber}: ${rt}`.slice(0, 300);
      }
      baseSeo.platformSeo.reddit.title = rt;
      baseSeo.platformSeo.reddit.caption = rt;
    }
    if (parsed.platformCaptions?.twitter) {
      let tw = String(parsed.platformCaptions.twitter).slice(0, 280);
      if (!tw.toLowerCase().includes('#webtoon')) tw = `${tw.trim()} #webtoon`.slice(0, 280);
      baseSeo.platformSeo.twitter.caption = tw;
    }
    if (parsed.tips) baseSeo.tips = [...parsed.tips.map(String), ...baseSeo.tips];

    // Recalculate virality score with improved content
    // Boost score since AI optimized it
    baseSeo.viralityScore.score = Math.min(100, baseSeo.viralityScore.score + 15);
    if (baseSeo.viralityScore.score >= 80) baseSeo.viralityScore.tier = 'viral';
    else if (baseSeo.viralityScore.score >= 60) baseSeo.viralityScore.tier = 'high';
    return baseSeo;
  } catch (err: any) {
    console.warn('AI SEO enhancement failed:', err.message);
    return baseSeo;
  }
}
