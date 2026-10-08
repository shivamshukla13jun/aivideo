/**
 * Shared Gemini text generation with a multi-key, multi-model fallback chain.
 *
 * API keys and the model chain are managed from the client at /settings
 * (GeminiKey collection + a 'geminiModels' Setting doc) — nothing is read
 * from env at runtime. For every enabled key the model chain is walked in
 * order; on quota errors (429) or auth failures the next KEY is tried, on
 * overloaded/unavailable models (503/404) the next MODEL. Auth errors abort
 * early — a rejected key fails every model — and auto-disable the key.\
 * no keys yet; env is never consulted after that.
 */

const DEFAULT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
];

export const DEFAULT_GEMINI_MODELS = DEFAULT_MODELS;

const MODELS_SETTING = 'geminiModels';

// Dynamic imports keep mongoose out of client bundles if this lib is ever
// pulled into a client component by accident.
async function db() {
  const { connectDB } = await import('@/lib/mongodb');
  const { GeminiKey } = await import('@/models/GeminiKey');
  const { Setting } = await import('@/models/Setting');
  await connectDB();
  return { GeminiKey, Setting };
}

/** Active model chain — client-managed list, or the defaults. */
export async function getGeminiModelChain(): Promise<string[]> {
  try {
    const { Setting } = await db();
    const doc = await Setting.findOne({ name: MODELS_SETTING }).lean();
    const list = Array.isArray(doc?.value) ? doc!.value.map(String).filter(Boolean) : [];
    return list.length ? list : DEFAULT_MODELS;
  } catch {
    return DEFAULT_MODELS;
  }
}

interface KeyRef {
  _id: any;
  key: string;
  lastError?: string;
}

async function getGeminiKeys(): Promise<KeyRef[]> {
  const { GeminiKey } = await db();
  const keys = await GeminiKey.find({ disabled: { $ne: true } })
    .sort({ createdAt: 1 })
    .lean();
  return keys as unknown as KeyRef[];
}

/** True when at least one enabled key is stored. */
export async function geminiConfigured(): Promise<boolean> {
  try {
    return (await getGeminiKeys()).length > 0;
  } catch {
    return false;
  }
}

const isAuthError = (e: any) => {
  const status = e?.status ?? e?.error?.code;
  const msg = String(e?.message || e);
  return (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED|invalid api key/i.test(msg)
  );
};

const isQuotaError = (e: any) =>
  (e?.status ?? e?.error?.code) === 429 ||
  /quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(e?.message || e));

/**
 * Generate text with Gemini, walking the key × model fallback chain.
 * Returns '' when no keys are configured; throws the last error when every
 * key/model fails (callers keep their existing fallbacks).
 */
export async function generateWithGemini(prompt: string): Promise<string> {
  const { GeminiKey } = await db();
  const keys = await getGeminiKeys();
  if (!keys.length) return '';
  const models = await getGeminiModelChain();
  const { GoogleGenAI } = await import('@google/genai');

  const mark = (id: any, patch: Record<string, any>) =>
    GeminiKey.updateOne({ _id: id }, { $set: patch }).catch(() => {});

  let lastErr: any = null;
  for (let ki = 0; ki < keys.length; ki++) {
    const k = keys[ki];
    const ai = new GoogleGenAI({ apiKey: k.key });
    const hasNextKey = ki < keys.length - 1;
    let nextKey = false;

    for (const model of models) {
      try {
        const res = await ai.models.generateContent({ model, contents: prompt });
        const text = (res.text || '').trim();
        if (text) {
          if (k.lastError) mark(k._id, { lastError: '', lastErrorAt: null });
          return text;
        }
      } catch (e: any) {
        lastErr = e;
        if (isAuthError(e)) {
          console.warn(`[Gemini] key ${ki + 1} rejected — disabling it`);
          mark(k._id, { disabled: true, lastError: 'invalid', lastErrorAt: new Date() });
          nextKey = true;
          break;
        }
        if (isQuotaError(e)) {
          mark(k._id, { lastError: 'quota', lastErrorAt: new Date() });
          if (hasNextKey) {
            console.warn(`[Gemini] key ${ki + 1} quota exceeded — trying next key`);
            nextKey = true;
            break;
          }
          // Last key: quotas are often per-model — keep walking the chain.
          console.warn(`[Gemini] ${model} quota exceeded on last key, trying next model`);
          continue;
        }
        const status = e?.status ?? e?.error?.code ?? e?.error?.status ?? 'error';
        console.warn(`[Gemini] ${model} failed (${status}), trying next model`);
      }
    }
    if (nextKey) continue;
  }
  throw lastErr || new Error('All Gemini keys/models returned empty responses');
}
