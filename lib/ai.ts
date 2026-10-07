/**
 * AI provider dispatch — routes text generation (Hindi translation, AI SEO)
 * to the active provider selected at /settings: 'gemini' (API keys in DB,
 * model fallback chain) or 'ollama' (local daemon, auto-pulls needed models).
 *
 * generateAIText tries the active provider first, then falls back to the
 * other one so existing graceful degradation keeps working.
 */

export type AiProvider = 'gemini' | 'ollama';

const PROVIDER_SETTING = 'aiProvider';

async function db() {
  const { connectDB } = await import('@/lib/mongodb');
  const { Setting } = await import('@/models/Setting');
  await connectDB();
  return { Setting };
}

export async function getAiProvider(): Promise<AiProvider> {
  try {
    const { Setting } = await db();
    const doc = await Setting.findOne({ name: PROVIDER_SETTING }).lean();
    return doc?.value === 'ollama' ? 'ollama' : 'gemini';
  } catch {
    return 'gemini';
  }
}

export async function setAiProvider(p: AiProvider): Promise<void> {
  const { Setting } = await db();
  await Setting.findOneAndUpdate(
    { name: PROVIDER_SETTING },
    { $set: { value: p === 'ollama' ? 'ollama' : 'gemini' } },
    { upsert: true }
  );
}

/** True when at least one provider can actually generate. */
export async function aiConfigured(): Promise<boolean> {
  const { geminiConfigured } = await import('@/lib/gemini');
  const { ollamaReachable } = await import('@/lib/ollama');
  return (await geminiConfigured()) || (await ollamaReachable());
}

/**
 * Generate text with the active provider; on failure or an empty result the
 * other provider is tried. Throws when both fail — callers keep their
 * existing fallbacks (free /translate, algorithmic SEO).
 */
export async function generateAIText(prompt: string): Promise<string> {
  const { generateWithGemini } = await import('@/lib/gemini');
  const { generateWithOllama } = await import('@/lib/ollama');

  const provider = await getAiProvider();
  const [first, second] =
    provider === 'ollama'
      ? ([generateWithOllama, generateWithGemini] as const)
      : ([generateWithGemini, generateWithOllama] as const);

  try {
    const text = await first(prompt);
    if (text) return text;
  } catch (e: any) {
    console.warn(`[AI] ${provider} failed, trying fallback provider:`, e?.message || e);
  }

  const text = await second(prompt);
  if (text) return text;
  throw new Error('All AI providers returned empty responses');
}
