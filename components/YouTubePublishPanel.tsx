'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Youtube,
  X,
  Loader2,
  Wand2,
  UploadCloud,
  FileVideo,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Share2,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  Clapperboard,
} from 'lucide-react';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { WebtoonVideo } from '@/components/video/WebtoonVideo';
import { Aspect, FPS, FRAME_SIZE } from '@/lib/video/camera';
import { buildVideoProps, computeTimeline } from '@/lib/video/project';

interface YouTubeAccountLite {
  _id: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  email?: string;
  stats?: { subscribers?: number };
}

interface UploadResult {
  channelId: string;
  channelTitle: string;
  success: boolean;
  videoId?: string;
  watchUrl?: string;
  error?: string;
}

interface Props {
  chapterId: string;
  chapterTitle?: string;
  scenes: any[];
  aspect: Aspect;
  showSubtitles: boolean;
  onClose: () => void;
}

export default function YouTubePublishPanel({ chapterId, chapterTitle, scenes, aspect, showSubtitles, onClose }: Props) {
  const [accounts, setAccounts] = useState<YouTubeAccountLite[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Video source
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoName, setVideoName] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderLabel, setRenderLabel] = useState('');
  const renderAbortRef = useRef<AbortController | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  // SEO fields
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const [seoSource, setSeoSource] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [madeForKids, setMadeForKids] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/youtube/accounts');
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
        setSelectedAccountIds(data.data.map((a: YouTubeAccountLite) => a._id));
      }
    } catch {} finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchAccounts, 0);
    return () => clearTimeout(t);
  }, []);

  const handleConnectAccount = async () => {
    try {
      const res = await fetch('/api/youtube/auth');
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
      } else {
        alert(data.error || 'YouTube OAuth not configured');
      }
    } catch {
      alert('Failed to start YouTube connection');
    }
  };

  const handleRenderVideo = async () => {
    if (scenes.length === 0) {
      alert('No scenes to render');
      return;
    }
    setRendering(true);
    setRenderProgress(0);
    setRenderLabel('Preparing render…');
    const controller = new AbortController();
    renderAbortRef.current = controller;
    try {
      const props = buildVideoProps(scenes, aspect, showSubtitles);
      const { durationInFrames } = computeTimeline(props.scenes);
      const { width, height } = FRAME_SIZE[aspect];
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: 'webtoon-video',
          component: WebtoonVideo,
          durationInFrames,
          fps: FPS,
          width,
          height,
          defaultProps: props,
        },
        inputProps: props,
        container: 'mp4',
        videoBitrate: 'high',
        signal: controller.signal,
        delayRenderTimeoutInMilliseconds: 120000,
        onProgress: ({ progress, encodedFrames }) => {
          setRenderProgress(Math.min(99, Math.round(progress * 100)));
          setRenderLabel(`Encoding frame ${encodedFrames}/${durationInFrames}`);
        },
      });
      const blob = await getBlob();
      setVideoBlob(blob);
      setVideoName(`${(chapterTitle || 'video').replace(/[^a-z0-9]+/gi, '_')}_${aspect.replace(':', 'x')}_${Date.now()}.mp4`);
      setDownloadUrl(URL.createObjectURL(blob));
      setError('');
    } catch (e: any) {
      if (!controller.signal.aborted) setError(e.message || 'Render failed');
    } finally {
      renderAbortRef.current = null;
      setRendering(false);
    }
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoBlob(file);
      setVideoName(file.name);
      setError('');
    }
  };

  const handleGenerateSeo = async () => {
    setGeneratingSeo(true);
    try {
      const res = await fetch('/api/youtube/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle(data.data.title);
        setDescription(data.data.description);
        setTagsText((data.data.tags || []).join(', '));
        setSeoSource(data.source === 'gemini' ? 'AI-generated (Gemini)' : 'Auto-generated');
      } else {
        alert(data.error || 'SEO generation failed');
      }
    } catch {
      alert('SEO generation failed');
    } finally {
      setGeneratingSeo(false);
    }
  };

  const handleUpload = async () => {
    if (!videoBlob) {
      setError('Render the video or pick a video file first');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (selectedAccountIds.length === 0) {
      setError('Select at least one channel');
      return;
    }
    setUploading(true);
    setError('');
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('video', videoBlob, videoName || 'video.webm');
      fd.append(
        'metadata',
        JSON.stringify({
          chapterId,
          accountIds: selectedAccountIds,
          title: title.trim(),
          description,
          tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
          privacyStatus: privacy,
          madeForKids,
        })
      );
      const res = await fetch('/api/youtube/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setResults(data.data.results);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  const shareLinks = (url: string, text: string) => ({
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <span>Publish to YouTube</span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Step 1: Video source */}
          <section>
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>1. Video Source</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleRenderVideo}
                disabled={rendering || scenes.length === 0}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 transition-all"
              >
                {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileVideo className="w-4 h-4" />}
                <span>{rendering ? 'Rendering…' : `Render MP4 ${aspect} (${scenes.length} scenes)`}</span>
              </button>
              <label className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>Choose Video File (mp4/webm)</span>
                <input type="file" accept="video/*" onChange={handlePickFile} className="hidden" />
              </label>
            </div>
            {rendering && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>{renderLabel || 'Rendering…'}</span>
                  <div className="flex items-center space-x-2">
                    <span>{renderProgress}%</span>
                    <button onClick={() => renderAbortRef.current?.abort()} className="text-red-400 hover:text-red-300 font-semibold">Cancel</button>
                  </div>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all" style={{ width: `${renderProgress}%` }} />
                </div>
                <p className="text-[10px] text-neutral-500">Rendering in your browser (WebCodecs) — keep this tab visible for best speed.</p>
              </div>
            )}
            {videoBlob && !rendering && (
              <div className="mt-3 flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-2.5">
                <CheckCircle2 className="w-4 h-4" />
                <span className="truncate flex-1">Ready: {videoName} ({(videoBlob.size / 1024 / 1024).toFixed(1)} MB)</span>
                {downloadUrl && (
                  <a href={downloadUrl} download={videoName} className="text-indigo-300 hover:text-indigo-200 font-semibold">
                    Download MP4
                  </a>
                )}
              </div>
            )}
          </section>

          {/* Step 2: SEO */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                <span>2. SEO Metadata</span>
              </h3>
              <button
                onClick={handleGenerateSeo}
                disabled={generatingSeo}
                className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1.5 disabled:opacity-50 transition-all"
              >
                {generatingSeo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                <span>{generatingSeo ? 'Generating…' : 'Auto-Generate SEO'}</span>
              </button>
            </div>
            {seoSource && <p className="text-[10px] text-purple-300 mb-2">{seoSource} — review before publishing.</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Title ({title.length}/100)</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Catchy title with main keywords first…"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Description (first 150 chars matter most)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Description with keywords, summary, CTA and hashtags…"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Tags (comma separated)</label>
                <textarea
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  rows={2}
                  placeholder="webtoon, manhwa recap, manga…"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Visibility</label>
                  <select
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="unlisted">Unlisted (test first)</option>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <label className="flex items-center space-x-2 text-xs text-neutral-300 pt-5 cursor-pointer">
                  <input type="checkbox" checked={madeForKids} onChange={(e) => setMadeForKids(e.target.checked)} className="accent-indigo-500" />
                  <span>Made for kids</span>
                </label>
              </div>
            </div>
          </section>

          {/* Step 3: Channels */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. Channels ({selectedAccountIds.length} selected)</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => { setAccountsLoading(true); fetchAccounts(); }} className="p-1.5 text-neutral-400 hover:text-white transition-colors" title="Refresh accounts">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleConnectAccount}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Connect Channel</span>
                </button>
              </div>
            </div>
            {accountsLoading ? (
              <div className="flex items-center justify-center py-4 text-neutral-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading channels…
              </div>
            ) : accounts.length === 0 ? (
              <button
                onClick={handleConnectAccount}
                className="w-full p-4 rounded-xl border border-dashed border-neutral-700 text-neutral-400 hover:text-white hover:border-indigo-500 text-xs transition-all flex items-center justify-center space-x-2"
              >
                <Youtube className="w-4 h-4 text-red-500" />
                <span>Connect your first YouTube channel</span>
              </button>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {accounts.map((a) => (
                  <label
                    key={a._id}
                    className={`flex items-center space-x-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedAccountIds.includes(a._id)
                        ? 'bg-indigo-600/15 border-indigo-500/60'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.includes(a._id)}
                      onChange={(e) =>
                        setSelectedAccountIds((prev) =>
                          e.target.checked ? [...prev, a._id] : prev.filter((id) => id !== a._id)
                        )
                      }
                      className="accent-indigo-500"
                    />
                    {a.thumbnailUrl ? (
                      <img src={a.thumbnailUrl} alt="" className="w-7 h-7 rounded-full" />
                    ) : (
                      <Youtube className="w-7 h-7 text-red-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{a.channelTitle}</p>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {a.email || a.channelId}
                        {a.stats?.subscribers != null && ` • ${a.stats.subscribers} subs`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="flex items-center space-x-2 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl p-3">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload results + share */}
          {results && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Upload Results</h3>
              {results.map((r) => (
                <div
                  key={r.channelId}
                  className={`p-3 rounded-xl border text-xs ${
                    r.success ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-red-950/30 border-red-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center space-x-2">
                      {r.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      <span>{r.channelTitle}</span>
                    </span>
                    {r.watchUrl && (
                      <a href={r.watchUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1">
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {r.error && <p className="text-red-400 mt-1">{r.error}</p>}
                  {r.watchUrl && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => copyLink(r.watchUrl!)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center space-x-1"
                      >
                        {copiedUrl === r.watchUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl === r.watchUrl ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                      {Object.entries(shareLinks(r.watchUrl, title)).map(([name, href]) => (
                        <a
                          key={name}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded-lg text-[10px] font-semibold capitalize"
                        >
                          {name === 'x' ? 'X / Twitter' : name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Publish button */}
          <button
            onClick={handleUpload}
            disabled={uploading || !videoBlob || selectedAccountIds.length === 0}
            className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-40 transition-all shadow-lg"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
            <span>
              {uploading
                ? 'Uploading to YouTube…'
                : `Publish to ${selectedAccountIds.length} Channel${selectedAccountIds.length === 1 ? '' : 's'}`}
            </span>
          </button>
          <p className="text-[10px] text-neutral-500 text-center">
            Note: uploading identical videos to many channels may be flagged as duplicate content by YouTube — vary titles/descriptions per channel if possible.
          </p>
        </div>
      </div>
    </div>
  );
}
