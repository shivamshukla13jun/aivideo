/**
 * Turn a scene narration into short caption chunks shown one after another
 * across the scene, timed by text length (a longer chunk stays longer).
 */

const SENTENCE_END = /(?<=[.!?…।|])\s+/;

function splitLong(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];
  const out: string[] = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    if (current && (current + ' ' + word).length > maxChars) {
      out.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) out.push(current);
  return out;
}

export function subtitleChunks(text: string, maxChars = 84): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const pieces = clean.split(SENTENCE_END).flatMap((s) => splitLong(s.trim(), maxChars));

  // Merge short neighbouring sentences so captions don't flash by
  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && (last + ' ' + p).length <= maxChars) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  return chunks;
}

/** Chunk visible at a given progress (0..1) through the scene. */
export function chunkAt(chunks: string[], progress: number): string {
  if (chunks.length === 0) return '';
  const total = chunks.reduce((s, c) => s + c.length, 0);
  let acc = 0;
  for (const c of chunks) {
    acc += c.length;
    if (progress * total < acc) return c;
  }
  return chunks[chunks.length - 1];
}
