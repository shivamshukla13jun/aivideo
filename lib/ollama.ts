/**
 * Ollama provider — local text generation for Hindi translation & AI SEO.
 *
 * The model chain is client-managed at /settings (Setting doc 'ollamaModels');
 * the first entry is the default model. Only needed models are downloaded —
 * when generation requires a model that isn't pulled yet, it is pulled on the
 * spot (POST /api/pull) with progress tracked in `pullProgress` so the
 * settings UI can show live updates even for server-triggered pulls.
 * OLLAMA_URL points at the daemon (default http://localhost:11434).
 */

const DEFAULT_OLLAMA_MODELS = ['llama3.2:latest', 'qwen3:4b', 'gemma3:4b'];
export const DEFAULT_OLLAMA_MODEL_LIST = DEFAULT_OLLAMA_MODELS;

export const OLLAMA_MODELS_SETTING = 'ollamaModels';

const ollamaUrl = () =>
  (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');

async function db() {
  const { connectDB } = await import('@/lib/mongodb');
  const { Setting } = await import('@/models/Setting');
  await connectDB();
  return { Setting };
}

/** Active Ollama model chain — client-managed list, or the defaults. */
export async function getOllamaModelChain(): Promise<string[]> {
  try {
    const { Setting } = await db();
    const doc = await Setting.findOne({ name: OLLAMA_MODELS_SETTING }).lean();
    const list = Array.isArray(doc?.value) ? doc!.value.map(String).filter(Boolean) : [];
    return list.length ? list : DEFAULT_OLLAMA_MODELS;
  } catch {
    return DEFAULT_OLLAMA_MODELS;
  }
}

/**
 * CPU generation and model pulls can run for many minutes — use an undici
 * dispatcher with all timeouts disabled so nothing aborts mid-run.
 * Falls back to default fetch limits if undici isn't resolvable.
 */
let noTimeoutAgent: any = undefined;
async function unlimitedFetchInit(): Promise<Record<string, any>> {
  if (noTimeoutAgent === undefined) {
    try {
      const { Agent } = await import('undici');
      noTimeoutAgent = new Agent({ connectTimeout: 30_000, headersTimeout: 0, bodyTimeout: 0 });
    } catch {
      noTimeoutAgent = null;
    }
  }
  return noTimeoutAgent ? { dispatcher: noTimeoutAgent } : {};
}

export async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl()}/api/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Models already pulled on the daemon. */
export async function listPulledModels(): Promise<string[]> {
  try {
    const res = await fetch(`${ollamaUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.models || []).map((m: any) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

/* ---------------- Pull progress tracking (shared with the API) ---------- */

export interface PullState {
  status: string;
  done: number;
  total: number;
  error?: string;
  startedAt: number;
}

const pullProgress = new Map<string, PullState>();
/** In-flight pulls so concurrent callers share one download. */
const pullInflight = new Map<string, Promise<void>>();

export const getPullProgress = () =>
  Object.fromEntries([...pullProgress.entries()].map(([m, p]) => [m, { ...p }]));

export function beginPull(model: string) {
  pullProgress.set(model, { status: 'starting', done: 0, total: 0, startedAt: Date.now() });
}

export function updatePull(model: string, parsed: { status?: string; completed?: number; total?: number; error?: string }) {
  const prev = pullProgress.get(model);
  pullProgress.set(model, {
    status: parsed.status || prev?.status || '',
    done: parsed.completed ?? prev?.done ?? 0,
    total: parsed.total ?? prev?.total ?? 0,
    error: parsed.error,
    startedAt: prev?.startedAt ?? Date.now(),
  });
}

export function endPull(model: string, error?: string) {
  const prev = pullProgress.get(model);
  pullProgress.set(model, {
    status: error ? 'error' : 'success',
    done: prev?.done ?? 0,
    total: prev?.total ?? 0,
    error,
    startedAt: prev?.startedAt ?? Date.now(),
  });
  // Keep the terminal state briefly so pollers see it, then clean up.
  setTimeout(() => pullProgress.delete(model), 60_000).unref?.();
}

/** True when the model exists locally (accepts 'name' and 'name:latest'). */
const isPulled = (pulled: string[], model: string) =>
  pulled.some((p) => p === model || `${p}:latest` === model || p === `${model}:latest`);

/** Pull a model from the Ollama registry, tracking progress for the UI. */
export async function pullOllamaModel(model: string): Promise<void> {
  const existing = pullInflight.get(model);
  if (existing) return existing;

  const job = (async () => {
    beginPull(model);
    try {
      const res = await fetch(`${ollamaUrl()}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true }),
        ...(await unlimitedFetchInit()),
      });
      if (!res.ok || !res.body) throw new Error(`pull failed (${res.status})`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const p = JSON.parse(line);
            updatePull(model, p);
            if (p.error) throw new Error(p.error);
          } catch (e: any) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
      endPull(model);
    } catch (e: any) {
      endPull(model, e?.message || String(e));
      throw e;
    } finally {
      pullInflight.delete(model);
    }
  })();

  pullInflight.set(model, job);
  return job;
}

/** Download the model if it isn't pulled yet. */
export async function ensureOllamaModel(model: string): Promise<void> {
  const pulled = await listPulledModels();
  if (isPulled(pulled, model)) return;
  await pullOllamaModel(model);
  const after = await listPulledModels();
  if (!isPulled(after, model)) throw new Error(`model ${model} did not finish downloading`);
}

/**
 * Generate text with Ollama, walking the model chain. Missing models are
 * pulled automatically. Returns '' when the daemon is unreachable; throws the
 * last error when every model fails (callers keep their own fallbacks).
 */
export async function generateWithOllama(prompt: string): Promise<string> {
  if (!(await ollamaReachable())) return '';
  const models = await getOllamaModelChain();

  let lastErr: any = null;
  for (const model of models) {
    try {
      await ensureOllamaModel(model);
      // Streamed + no timeouts: token chunks keep the connection alive and a
      // slow CPU model can take as long as it needs.
      const res = await fetch(`${ollamaUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: true }),
        ...(await unlimitedFetchInit()),
      });
      if (!res.ok || !res.body) throw new Error(`ollama generate ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = '';
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            text += JSON.parse(line).response || '';
          } catch {}
        }
      }
      const out = text.trim();
      if (out) return out;
    } catch (e: any) {
      lastErr = e;
      console.warn(`[Ollama] ${model} failed:`, e?.message || e);
    }
  }
  throw lastErr || new Error('All Ollama models returned empty responses');
}
