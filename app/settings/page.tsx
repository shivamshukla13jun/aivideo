'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import {
  Key,
  Plus,
  Trash2,
  Loader2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  X,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Bot,
  Download,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface GeminiKeyRow {
  _id: string;
  label: string;
  hint: string;
  disabled: boolean;
  lastError: string;
  lastErrorAt: string | null;
  createdAt: string;
}

interface GeminiState {
  keys: GeminiKeyRow[];
  models: string[];
  customModels: boolean;
  defaultModels: string[];
}

interface PullInfo {
  status: string;
  done: number;
  total: number;
  error?: string;
}

interface OllamaState {
  reachable: boolean;
  pulled: string[];
  models: string[];
  defaultModel: string | null;
  customModels: boolean;
  defaultModels: string[];
  pulling: Record<string, PullInfo>;
}

const isPulled = (pulled: string[], model: string) =>
  pulled.some((p) => p === model || `${p}:latest` === model || p === `${model}:latest`);

const pullPct = (p?: PullInfo) =>
  p && p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : null;

export default function SettingsPage() {
  const [state, setState] = useState<GeminiState | null>(null);
  const [provider, setProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [ollama, setOllama] = useState<OllamaState | null>(null);
  const [pulling, setPulling] = useState<Record<string, PullInfo>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newOllamaModel, setNewOllamaModel] = useState('');

  const refreshOllama = async () => {
    try {
      const res = await fetch('/api/settings/ollama');
      const data = await res.json();
      if (data.success) {
        setOllama(data.data);
        setPulling(data.data.pulling || {});
      }
    } catch {}
  };

  const load = async () => {
    try {
      const [gRes, aiRes, oRes] = await Promise.all([
        fetch('/api/settings/gemini'),
        fetch('/api/settings/ai'),
        fetch('/api/settings/ollama'),
      ]);
      const gData = await gRes.json();
      if (gData.success) setState(gData.data);
      else setError(gData.error || 'Failed to load settings');
      const aiData = await aiRes.json();
      if (aiData.success) setProvider(aiData.data.provider);
      const oData = await oRes.json();
      if (oData.success) {
        setOllama(oData.data);
        setPulling(oData.data.pulling || {});
      }
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  // Poll Ollama status while any pull is in-flight (covers server-side pulls too)
  const anyPullActive = Object.values(pulling).some(
    (p) => p.status !== 'success' && p.status !== 'error'
  );
  useEffect(() => {
    if (!anyPullActive) return;
    const iv = setInterval(refreshOllama, 2000);
    return () => clearInterval(iv);
  }, [anyPullActive]);

  const act = async (body: Record<string, any>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) setState(data.data);
      else setError(data.error || 'Action failed');
    } catch {
      setError('Action failed');
    } finally {
      setBusy(false);
    }
  };

  const ollamaAct = async (body: Record<string, any>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/settings/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) setOllama(data.data);
      else setError(data.error || 'Action failed');
    } catch {
      setError('Action failed');
    } finally {
      setBusy(false);
    }
  };

  const switchProvider = async (p: 'gemini' | 'ollama') => {
    setProvider(p);
    try {
      await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p }),
      });
    } catch {
      setError('Failed to switch provider');
    }
  };

  const downloadModel = async (model: string) => {
    setPulling((p) => ({ ...p, [model]: { status: 'starting', done: 0, total: 0 } }));
    try {
      const res = await fetch('/api/settings/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      if (!res.ok || !res.body) throw new Error('pull request failed');
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
            setPulling((prev) => ({
              ...prev,
              [model]: {
                status: p.status || '',
                done: p.completed || 0,
                total: p.total || 0,
                error: p.error,
              },
            }));
          } catch {}
        }
      }
      await refreshOllama();
    } catch (e: any) {
      setPulling((p) => ({
        ...p,
        [model]: { status: 'error', done: 0, total: 0, error: e?.message || 'pull failed' },
      }));
    }
  };

  const addKey = async () => {
    if (!newKey.trim()) return;
    await act({ action: 'add-key', key: newKey.trim(), label: newLabel.trim() });
    setNewKey('');
    setNewLabel('');
  };

  const addModel = async () => {
    if (!newModel.trim()) return;
    await act({ action: 'add-model', model: newModel.trim() });
    setNewModel('');
  };

  const addOllamaModel = async () => {
    if (!newOllamaModel.trim()) return;
    await ollamaAct({ action: 'add-model', model: newOllamaModel.trim() });
    setNewOllamaModel('');
  };

  const fmtError = (k: GeminiKeyRow) => {
    if (k.lastError === 'quota') return 'quota exceeded';
    if (k.lastError === 'invalid') return 'invalid key — auto-disabled';
    return '';
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-sm text-neutral-500 mb-8">
          AI powers Hindi translation and AI SEO — pick a provider, add Gemini keys, or manage local
          Ollama models.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-sm text-red-300 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center space-x-2 text-neutral-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : state ? (
          <div className="space-y-8">
            {/* ---- AI Provider ---- */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-1">AI Provider</h2>
              <p className="text-xs text-neutral-500 mb-4">
                Used for Hindi translation and AI SEO. If the active provider fails, the other is
                tried automatically.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'gemini', label: 'Gemini', desc: 'Google API keys, automatic failover' },
                    { id: 'ollama', label: 'Ollama', desc: 'Local models, runs on your machine' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchProvider(p.id)}
                    className={`text-left border rounded-xl px-4 py-3 transition-colors ${
                      provider === p.id
                        ? 'border-indigo-500 bg-indigo-600/10'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          provider === p.id ? 'bg-indigo-400' : 'bg-neutral-700'
                        }`}
                      />
                      <span className="text-sm font-semibold">{p.label}</span>
                      {provider === p.id && (
                        <span className="text-[10px] text-indigo-300 font-medium">active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* ---- Ollama ---- */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Ollama Models</h2>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`flex items-center space-x-1.5 text-[10px] px-2 py-0.5 rounded-full border ${
                      ollama?.reachable
                        ? 'border-emerald-500/50 text-emerald-300'
                        : 'border-red-500/50 text-red-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        ollama?.reachable ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span>{ollama?.reachable ? 'connected' : 'offline'}</span>
                  </span>
                  {ollama?.customModels && (
                    <button
                      type="button"
                      onClick={() => ollamaAct({ action: 'reset-models' })}
                      disabled={busy}
                      className="flex items-center space-x-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
                      title="Restore the default model chain"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                Tried in order — the first model is the default. Models are downloaded automatically
                only when needed, or pull them manually below.
              </p>

              {ollama && !ollama.reachable && (
                <div className="mb-4 p-2.5 bg-amber-950/50 border border-amber-800/60 rounded-lg text-[11px] text-amber-300">
                  Ollama isn&apos;t reachable — start it with <code className="bg-neutral-800 px-1 rounded">ollama serve</code> or the desktop app.
                </div>
              )}

              {ollama && (
                <>
                  <ul className="space-y-1.5 mb-4">
                    {ollama.models.map((m, i) => {
                      const pulled = isPulled(ollama.pulled, m);
                      const pull = pulling[m];
                      const active = pull && pull.status !== 'success' && pull.status !== 'error';
                      const pct = pullPct(pull);
                      return (
                        <li
                          key={m}
                          className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 min-w-0">
                              <span className="text-[10px] text-neutral-600 font-mono w-4">{i + 1}</span>
                              <span className="text-sm font-mono truncate">{m}</span>
                              {i === 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/50 text-indigo-300 uppercase tracking-wide shrink-0">
                                  default
                                </span>
                              )}
                              {pulled ? (
                                <span className="flex items-center space-x-1 text-[10px] text-emerald-400 shrink-0">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>downloaded</span>
                                </span>
                              ) : active ? null : (
                                <span className="text-[10px] text-neutral-500 shrink-0">not downloaded</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              {!pulled && !active && ollama.reachable && (
                                <button
                                  type="button"
                                  onClick={() => downloadModel(m)}
                                  disabled={busy}
                                  className="flex items-center space-x-1 text-[11px] px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => ollamaAct({ action: 'move-model', model: m, dir: -1 })}
                                disabled={busy || i === 0 || !!active}
                                className="p-1 text-neutral-500 hover:text-white disabled:opacity-30 transition-colors"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => ollamaAct({ action: 'move-model', model: m, dir: 1 })}
                                disabled={busy || i === ollama.models.length - 1 || !!active}
                                className="p-1 text-neutral-500 hover:text-white disabled:opacity-30 transition-colors"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => ollamaAct({ action: 'remove-model', model: m })}
                                disabled={busy || ollama.models.length <= 1 || !!active}
                                className="p-1 text-neutral-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {pull && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className={pull.status === 'error' ? 'text-red-400' : 'text-neutral-400'}>
                                  {pull.status === 'error'
                                    ? `failed: ${pull.error || pull.status}`
                                    : pull.status === 'success'
                                      ? 'download complete'
                                      : pull.status || 'downloading…'}
                                </span>
                                {pct !== null && pull.status !== 'error' && (
                                  <span className="text-neutral-500 font-mono">
                                    {pct}% · {(pull.done / 1e9).toFixed(1)}/{(pull.total / 1e9).toFixed(1)} GB
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pull.status === 'error'
                                      ? 'bg-red-500'
                                      : pull.status === 'success'
                                        ? 'bg-emerald-500'
                                        : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${pull.status === 'success' ? 100 : (pct ?? 8)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newOllamaModel}
                      onChange={(e) => setNewOllamaModel(e.target.value)}
                      placeholder="e.g. qwen3:8b"
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={addOllamaModel}
                      disabled={busy || !newOllamaModel.trim()}
                      className="flex items-center space-x-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add model</span>
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* ---- API Keys ---- */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center space-x-2 mb-1">
                <Key className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">Gemini API Keys</h2>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                Add multiple keys — if one exceeds its quota or is rejected, the next is tried. Keys
                are stored in the database and never shown in full.
              </p>

              <div className="flex space-x-2 mb-4">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Paste a Gemini API key"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-36 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addKey}
                  disabled={busy || !newKey.trim()}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Add</span>
                </button>
              </div>

              {state.keys.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">
                  No keys yet — Hindi translation and AI SEO will use Ollama or free fallbacks until you add one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {state.keys.map((k, i) => (
                    <li
                      key={k._id}
                      className={`flex items-center justify-between bg-neutral-950 border rounded-lg px-3 py-2.5 ${
                        k.disabled ? 'border-neutral-800 opacity-50' : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="text-[10px] text-neutral-600 font-mono w-4">#{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-mono truncate">
                            {k.label ? <span className="font-sans font-medium mr-2">{k.label}</span> : null}
                            <span className="text-neutral-400">{k.hint}</span>
                          </div>
                          {fmtError(k) && (
                            <div className={`text-[11px] mt-0.5 ${k.lastError === 'invalid' ? 'text-red-400' : 'text-amber-400'}`}>
                              {fmtError(k)}
                              {k.lastErrorAt ? ` · ${new Date(k.lastErrorAt).toLocaleString()}` : ''}
                            </div>
                          )}
                          {k.disabled && !k.lastError && <div className="text-[11px] text-neutral-500 mt-0.5">disabled</div>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => act({ action: 'toggle-key', id: k._id, disabled: !k.disabled })}
                          disabled={busy}
                          title={k.disabled ? 'Enable key' : 'Disable key'}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                        >
                          {k.disabled ? <ToggleLeft className="w-4.5 h-4.5" /> : <ToggleRight className="w-4.5 h-4.5 text-emerald-400" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete key ${k.hint}?`)) act({ action: 'remove-key', id: k._id });
                          }}
                          disabled={busy}
                          className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ---- Gemini Model chain ---- */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Gemini Model Chain</h2>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${state.customModels ? 'border-indigo-500/50 text-indigo-300' : 'border-neutral-700 text-neutral-500'}`}>
                    {state.customModels ? 'custom' : 'defaults'}
                  </span>
                  {state.customModels && (
                    <button
                      type="button"
                      onClick={() => act({ action: 'reset-models' })}
                      disabled={busy}
                      className="flex items-center space-x-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
                      title="Restore the default model chain"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                Tried in order for each API key — move overloaded or slow models down, add new ones at the end.
              </p>

              <ul className="space-y-1.5 mb-4">
                {state.models.map((m, i) => (
                  <li key={m} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] text-neutral-600 font-mono w-4">{i + 1}</span>
                      <span className="text-sm font-mono">{m}</span>
                      {i === 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/50 text-indigo-300 uppercase tracking-wide">
                          default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => act({ action: 'move-model', model: m, dir: -1 })}
                        disabled={busy || i === 0}
                        className="p-1 text-neutral-500 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => act({ action: 'move-model', model: m, dir: 1 })}
                        disabled={busy || i === state.models.length - 1}
                        className="p-1 text-neutral-500 hover:text-white disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => act({ action: 'remove-model', model: m })}
                        disabled={busy || state.models.length <= 1}
                        className="p-1 text-neutral-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  placeholder="e.g. gemini-3.9-flash"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addModel}
                  disabled={busy || !newModel.trim()}
                  className="flex items-center space-x-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add model</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
