/**
 * Shorts/Reels generator — picks the best scenes from a chapter to
 * create short-form vertical video clips (< 60 seconds for YouTube Shorts,
 * < 90 seconds for Instagram Reels, < 140 seconds for X).
 *
 * The actual video rendering happens client-side via Remotion.
 * This module provides the scene selection and metadata logic.
 */

import { FPS } from '@/lib/video/camera';

export interface ShortClip {
  /** Unique clip ID */
  id: string;
  /** Display label (e.g. "Clip 1: Action Highlight") */
  label: string;
  /** Scene indices from the chapter */
  sceneIndices: number[];
  /** Total duration in seconds */
  durationSec: number;
  /** Suggested title for the short */
  suggestedTitle: string;
  /** Suggested hashtags */
  hashtags: string[];
  /** Strategy used for this clip */
  strategy: ClipStrategy;
}

export type ClipStrategy =
  | 'hook-highlight'    // Best opening scene + most dramatic scene
  | 'action-sequence'   // Consecutive high-energy scenes
  | 'cliffhanger'       // Build-up to cliffhanger ending
  | 'character-focus'   // Character introduction/development moments
  | 'best-moments'      // Top N scenes by engagement scoring
  | 'full-recap';       // Compressed version of entire chapter

interface SceneScore {
  index: number;
  score: number;
  narrationLength: number;
  hasAudio: boolean;
  durationSec: number;
  hasDialogue: boolean;
  isActionScene: boolean;
}

const ACTION_KEYWORDS = [
  'fight', 'attack', 'slash', 'punch', 'kick', 'explode', 'blast', 'kill',
  'die', 'death', 'destroy', 'crash', 'run', 'chase', 'escape', 'scream',
  'shock', 'surprise', 'reveal', 'transform', 'power', 'awaken', 'rage',
  'blood', 'battle', 'war', 'sword', 'strike', 'block', 'dodge',
];

const CLIFFHANGER_KEYWORDS = [
  'but', 'however', 'suddenly', 'wait', 'what', 'impossible', 'no way',
  'how', 'who', 'why', 'secret', 'truth', 'reveal', 'hidden', 'behind',
  'next', 'continue', 'find out', 'discover', 'realize', 'understand',
];

function scoreScene(scene: any, index: number, totalScenes: number): SceneScore {
  const narration = (scene.narration || '').toLowerCase();
  const narrationLength = narration.length;
  const hasAudio = Boolean(scene.audio?.url || scene.audio?.cloudinaryUrl);
  const durationSec = scene.duration || 5;

  // Action scoring
  const actionHits = ACTION_KEYWORDS.filter(kw => narration.includes(kw)).length;
  const isActionScene = actionHits >= 2;

  // Dialogue detection (quotes or speech patterns)
  const hasDialogue = /["'].+["']/.test(scene.narration || '') || narration.includes('said') || narration.includes('asked');

  // Composite engagement score
  let score = 0;
  score += Math.min(narrationLength / 100, 3); // Longer narration = more content (up to 3 points)
  score += hasAudio ? 2 : 0;                    // Audio scenes are more engaging
  score += actionHits * 1.5;                     // Action scenes score higher
  score += hasDialogue ? 1.5 : 0;               // Dialogue is engaging
  score += index === 0 ? 1 : 0;                  // First scene bonus (good hook)
  score += index === totalScenes - 1 ? 2 : 0;    // Last scene bonus (cliffhanger)
  // Mid-story climax (around 60-80% mark)
  const progress = index / Math.max(1, totalScenes - 1);
  if (progress >= 0.6 && progress <= 0.85) score += 1.5;

  return { index, score, narrationLength, hasAudio, durationSec, hasDialogue, isActionScene };
}

function selectScenesForDuration(
  scored: SceneScore[],
  maxDurationSec: number,
  sortBy: 'score' | 'index'
): number[] {
  const sorted = [...scored].sort((a, b) =>
    sortBy === 'score' ? b.score - a.score : a.index - b.index
  );
  const selected: number[] = [];
  let totalDuration = 0;
  for (const s of sorted) {
    if (totalDuration + s.durationSec > maxDurationSec) continue;
    selected.push(s.index);
    totalDuration += s.durationSec;
  }
  // Return in chronological order
  return selected.sort((a, b) => a - b);
}

export function generateShortClips(
  scenes: any[],
  seriesTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  maxDurationSec: number = 58
): ShortClip[] {
  if (scenes.length === 0) return [];

  const scored = scenes.map((s, i) => scoreScene(s, i, scenes.length));
  const clips: ShortClip[] = [];
  let clipId = 0;

  // Strategy 1: Hook + Highlight (first scene + best scene)
  {
    const hookScene = scored[0];
    const best = [...scored].sort((a, b) => b.score - a.score)[0];
    const indices = hookScene.index === best.index
      ? [hookScene.index]
      : [hookScene.index, best.index].sort((a, b) => a - b);
    const dur = indices.reduce((sum, i) => sum + scored[i].durationSec, 0);
    if (dur <= maxDurationSec) {
      clips.push({
        id: `short-${clipId++}`,
        label: 'Hook + Best Moment',
        sceneIndices: indices,
        durationSec: dur,
        suggestedTitle: `${seriesTitle} Ch.${chapterNumber} — You Won't Believe This!`,
        hashtags: ['#webtoon', '#manhwa', `#${seriesTitle.replace(/\s+/g, '')}`, '#viral', '#anime'],
        strategy: 'hook-highlight',
      });
    }
  }

  // Strategy 2: Action Sequence (consecutive action scenes)
  {
    const actionScenes = scored.filter(s => s.isActionScene || s.score >= 5);
    if (actionScenes.length >= 2) {
      const indices = selectScenesForDuration(actionScenes, maxDurationSec, 'index');
      const dur = indices.reduce((sum, i) => sum + scored[i].durationSec, 0);
      if (indices.length >= 2 && dur <= maxDurationSec) {
        clips.push({
          id: `short-${clipId++}`,
          label: 'Action Highlights',
          sceneIndices: indices,
          durationSec: dur,
          suggestedTitle: `${seriesTitle} INSANE Fight Scene | Ch.${chapterNumber}`,
          hashtags: ['#webtoon', '#action', '#fight', `#${seriesTitle.replace(/\s+/g, '')}`, '#epic'],
          strategy: 'action-sequence',
        });
      }
    }
  }

  // Strategy 3: Cliffhanger (last 3-5 scenes)
  {
    const lastScenes = scored.slice(-Math.min(5, Math.ceil(scenes.length * 0.3)));
    const indices = selectScenesForDuration(lastScenes, maxDurationSec, 'index');
    const dur = indices.reduce((sum, i) => sum + scored[i].durationSec, 0);
    if (indices.length >= 2 && dur <= maxDurationSec) {
      clips.push({
        id: `short-${clipId++}`,
        label: 'Cliffhanger Ending',
        sceneIndices: indices,
        durationSec: dur,
        suggestedTitle: `${seriesTitle} Ch.${chapterNumber} Ending Will SHOCK You`,
        hashtags: ['#webtoon', '#cliffhanger', `#${seriesTitle.replace(/\s+/g, '')}`, '#mustwatch', '#manhwa'],
        strategy: 'cliffhanger',
      });
    }
  }

  // Strategy 4: Best Moments (top scenes by score)
  {
    const topScenes = [...scored].sort((a, b) => b.score - a.score);
    const indices = selectScenesForDuration(topScenes, maxDurationSec, 'score');
    const dur = indices.reduce((sum, i) => sum + scored[i].durationSec, 0);
    if (indices.length >= 2 && dur <= maxDurationSec) {
      clips.push({
        id: `short-${clipId++}`,
        label: 'Best Moments Compilation',
        sceneIndices: indices,
        durationSec: dur,
        suggestedTitle: `${seriesTitle} Ch.${chapterNumber} — Top Moments`,
        hashtags: ['#webtoon', '#recap', `#${seriesTitle.replace(/\s+/g, '')}`, '#bestmoments', '#manhwa'],
        strategy: 'best-moments',
      });
    }
  }

  // Strategy 5: Full Recap (compressed — pick every Nth scene to fit duration)
  {
    const step = Math.max(1, Math.ceil(scenes.length / Math.floor(maxDurationSec / 4)));
    const indices: number[] = [];
    let totalDur = 0;
    for (let i = 0; i < scenes.length; i += step) {
      const dur = scored[i].durationSec;
      if (totalDur + dur > maxDurationSec) break;
      indices.push(i);
      totalDur += dur;
    }
    // Always include last scene for cliffhanger
    const lastIdx = scenes.length - 1;
    if (!indices.includes(lastIdx) && totalDur + scored[lastIdx].durationSec <= maxDurationSec) {
      indices.push(lastIdx);
      totalDur += scored[lastIdx].durationSec;
    }
    if (indices.length >= 3) {
      clips.push({
        id: `short-${clipId++}`,
        label: 'Quick Recap',
        sceneIndices: indices,
        durationSec: totalDur,
        suggestedTitle: `${seriesTitle} Ch.${chapterNumber} in ${Math.round(totalDur)} seconds!`,
        hashtags: ['#webtoon', '#recap', `#${seriesTitle.replace(/\s+/g, '')}`, '#short', '#quick'],
        strategy: 'full-recap',
      });
    }
  }

  return clips;
}

/** Compute the right max duration for each target platform. */
export function platformMaxDuration(platforms: string[]): number {
  const limits: Record<string, number> = {
    youtube: 58,       // YouTube Shorts: 60s max, keep 2s margin
    instagram: 88,     // Instagram Reels: 90s max
    twitter: 138,      // Twitter/X: 2:20 max
    facebook: 58,      // Facebook Reels: 60s
    reddit: 58,        // Reddit: keep short-form for engagement
  };
  // Use the smallest limit across all target platforms
  const applicable = platforms.map(p => limits[p] || 58);
  return Math.min(...applicable);
}
