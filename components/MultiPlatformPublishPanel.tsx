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
  TrendingUp,
  Clock,
  Zap,
  Scissors,
  Instagram,
  Twitter,
  Facebook,
  MessagesSquare,
  BarChart3,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { WebtoonVideo } from '@/components/video/WebtoonVideo';
import { Aspect, FPS, FRAME_SIZE } from '@/lib/video/camera';
import { buildVideoProps, computeTimeline } from '@/lib/video/project';

interface AccountLite {
  _id: string;
  platform: string;
  displayName: string;
  username?: string;
  profileImageUrl?: string;
  email?: string;
  stats?: { followers?: number; subscribers?: number };
}

interface YouTubeAccountLite {
  _id: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  email?: string;
  stats?: { subscribers?: number };
}

interface ShortClip {
  id: string;
  label: string;
  sceneIndices: number[];
  durationSec: number;
  suggestedTitle: string;
  hashtags: string[];
  strategy: string;
}

interface ViralityScore {
  score: number;
  factors: { name: string; score: number; weight: number; tip?: string }[];
  risks: string[];
  tier: string;
}

interface AdvancedSeo {
  primary: {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
    categoryId: string;
    thumbnailTips: string[];
  };
  titleVariants: string[];
  platformSeo: Record<string, { platform: string; title: string; caption: string; hashtags: string[] }>;
  viralityScore: ViralityScore;
  schedule: { bestHourUTC: number; bestDayOfWeek: number; recommendation: string; stagger: Record<string, number> };
  tips: string[];
}

interface UploadResult {
  platform: string;
  displayName: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
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

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  youtube: <Youtube className="w-4 h-4 text-red-500" />,
  instagram: <Instagram className="w-4 h-4 text-pink-500" />,
  reddit: <MessagesSquare className="w-4 h-4 text-orange-500" />,
  twitter: <Twitter className="w-4 h-4 text-sky-400" />,
  facebook: <Facebook className="w-4 h-4 text-blue-500" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'from-red-600 to-rose-600',
  instagram: 'from-pink-600 to-purple-600',
  reddit: 'from-orange-600 to-red-600',
  twitter: 'from-sky-500 to-blue-600',
  facebook: 'from-blue-600 to-indigo-600',
};

function ViralityMeter({ score, tier }: { score: number; tier: string }) {
  const color = tier === 'viral' ? 'from-emerald-500 to-cyan-400' :
    tier === 'high' ? 'from-blue-500 to-indigo-400' :
    tier === 'medium' ? 'from-amber-500 to-yellow-400' :
    'from-red-500 to-orange-400';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-300 flex items-center space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span>Virality Score</span>
        </span>
        <span className={`text-sm font-black ${
          tier === 'viral' ? 'text-emerald-400' : tier === 'high' ? 'text-blue-400' : tier === 'medium' ? 'text-amber-400' : 'text-red-400'
        }`}>
          {score}/100 — {tier.toUpperCase()}
        </span>
      </div>
      <div className="w-full bg-neutral-800 h-3 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function MultiPlatformPublishPanel({ chapterId, chapterTitle, scenes, aspect, showSubtitles, onClose }: Props) {
  // YouTube accounts
  const [ytAccounts, setYtAccounts] = useState<YouTubeAccountLite[]>([]);
  const [selectedYtIds, setSelectedYtIds] = useState<string[]>([]);
  // Social accounts
  const [socialAccounts, setSocialAccounts] = useState<AccountLite[]>([]);
  const [selectedSocialTargets, setSelectedSocialTargets] = useState<{ platform: string; accountId: string }[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Video source
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoName, setVideoName] = useState('');
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderLabel, setRenderLabel] = useState('');
  const renderAbortRef = useRef<AbortController | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  // Shorts
  const [shortsClips, setShortsClips] = useState<ShortClip[]>([]);
  const [selectedShort, setSelectedShort] = useState<string | null>(null);
  const [loadingShorts, setLoadingShorts] = useState(false);
  const [showShorts, setShowShorts] = useState(false);

  // Advanced SEO
  const [seo, setSeo] = useState<AdvancedSeo | null>(null);
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const [seoSource, setSeoSource] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [madeForKids, setMadeForKids] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showTitleVariants, setShowTitleVariants] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<'full' | 'shorts'>('full');

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const fetchAccounts = async () => {
    try {
      const [ytRes, socialRes] = await Promise.all([
        fetch('/api/youtube/accounts'),
        fetch('/api/social/accounts'),
      ]);
      const ytData = await ytRes.json();
      const socialData = await socialRes.json();
      if (ytData.success) {
        setYtAccounts(ytData.data);
        setSelectedYtIds(ytData.data.map((a: YouTubeAccountLite) => a._id));
      }
      if (socialData.success) {
        setSocialAccounts(socialData.data);
        setSelectedSocialTargets(socialData.data.map((a: AccountLite) => ({ platform: a.platform, accountId: a._id })));
      }
    } catch {} finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchAccounts, 0);
    return () => clearTimeout(t);
  }, []);

  const handleConnectPlatform = async (platform: string) => {
    try {
      const endpoint = platform === 'youtube' ? '/api/youtube/auth' : `/api/social/auth?platform=${platform}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
      } else {
        alert(data.error || `${platform} OAuth not configured`);
      }
    } catch {
      alert(`Failed to start ${platform} connection`);
    }
  };

  const handleRenderVideo = async () => {
    if (scenes.length === 0) { alert('No scenes to render'); return; }
    // When a short clip is selected, render only its scenes in vertical 9:16
    const clip = activeTab === 'shorts' ? shortsClips.find(c => c.id === selectedShort) : undefined;
    const renderScenes = clip ? clip.sceneIndices.map(i => scenes[i]).filter(Boolean) : scenes;
    if (clip && renderScenes.length === 0) { alert('Selected clip has no valid scenes'); return; }
    const renderAspect: Aspect = clip ? '9:16' : aspect;
    setRendering(true);
    setRenderProgress(0);
    setRenderLabel('Preparing render...');
    const controller = new AbortController();
    renderAbortRef.current = controller;
    try {
      const props = buildVideoProps(renderScenes, renderAspect, showSubtitles);
      const { durationInFrames } = computeTimeline(props.scenes);
      const { width, height } = FRAME_SIZE[renderAspect];
      const { getBlob } = await renderMediaOnWeb({
        composition: { id: 'webtoon-video', component: WebtoonVideo, durationInFrames, fps: FPS, width, height, defaultProps: props },
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
      const label = clip ? `short_${clip.strategy}` : 'video';
      setVideoName(`${(chapterTitle || label).replace(/[^a-z0-9]+/gi, '_')}_${renderAspect.replace(':', 'x')}_${Date.now()}.mp4`);
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
    if (file) { setVideoBlob(file); setVideoName(file.name); setError(''); }
  };

  const handleGenerateAdvancedSeo = async () => {
    setGeneratingSeo(true);
    try {
      const res = await fetch('/api/social/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, isShort: activeTab === 'shorts', useAI: true }),
      });
      const data = await res.json();
      if (data.success) {
        const seoData: AdvancedSeo = data.data;
        setSeo(seoData);
        setTitle(seoData.primary.title);
        setDescription(seoData.primary.description);
        setTagsText(seoData.primary.tags.join(', '));
        setHashtagsText(seoData.primary.hashtags.join(' '));
        setSeoSource(data.source === 'ai-enhanced' ? 'AI-Enhanced (Gemini)' : 'Advanced Algorithm');
      } else {
        alert(data.error || 'SEO generation failed');
      }
    } catch {
      alert('SEO generation failed');
    } finally {
      setGeneratingSeo(false);
    }
  };

  const handleGenerateShorts = async () => {
    setLoadingShorts(true);
    try {
      const platforms = [
        ...selectedYtIds.length > 0 ? ['youtube'] : [],
        ...selectedSocialTargets.map(t => t.platform),
      ];
      const res = await fetch('/api/social/shorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, platforms: platforms.length ? platforms : ['youtube'] }),
      });
      const data = await res.json();
      if (data.success) {
        setShortsClips(data.data.clips);
        setShowShorts(true);
      } else {
        alert(data.error || 'Shorts generation failed');
      }
    } catch {
      alert('Shorts generation failed');
    } finally {
      setLoadingShorts(false);
    }
  };

  const handleUpload = async () => {
    if (!videoBlob) { setError('Render the video or pick a video file first'); return; }
    if (!title.trim()) { setError('Title is required'); return; }
    if (selectedYtIds.length === 0 && selectedSocialTargets.length === 0) { setError('Select at least one platform'); return; }
    setUploading(true);
    setError('');
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('video', videoBlob, videoName || 'video.mp4');
      fd.append('metadata', JSON.stringify({
        chapterId,
        youtubeAccountIds: selectedYtIds,
        socialTargets: selectedSocialTargets,
        videoType: activeTab === 'shorts' ? 'short' : 'full',
        title: title.trim(),
        description,
        tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
        hashtags: hashtagsText.split(/[\s,]+/).map(h => h.trim()).filter(Boolean),
        privacyStatus: privacy,
        madeForKids,
        categoryId: seo?.primary.categoryId || '24',
        platformSeo: seo?.platformSeo,
      }));
      const res = await fetch('/api/social/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) setResults(data.data.results);
      else setError(data.error || 'Upload failed');
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
    reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  });

  const toggleSocialTarget = (platform: string, accountId: string, checked: boolean) => {
    setSelectedSocialTargets(prev =>
      checked
        ? [...prev, { platform, accountId }]
        : prev.filter(t => !(t.platform === platform && t.accountId === accountId))
    );
  };

  const totalTargets = selectedYtIds.length + selectedSocialTargets.length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <span>Publish Everywhere</span>
            <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
              {totalTargets} platform{totalTargets !== 1 ? 's' : ''}
            </span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Tab: Full Video vs Shorts */}
          <div className="flex bg-neutral-950 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('full')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'full' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileVideo className="w-3.5 h-3.5" />
              <span>Full Video</span>
            </button>
            <button
              onClick={() => { setActiveTab('shorts'); if (shortsClips.length === 0) handleGenerateShorts(); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'shorts' ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Shorts / Reels</span>
            </button>
          </div>

          {/* Shorts clips selector */}
          {activeTab === 'shorts' && (
            <section>
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                <Scissors className="w-3.5 h-3.5 text-purple-400" />
                <span>Auto-Generated Short Clips</span>
              </h3>
              {loadingShorts ? (
                <div className="flex items-center justify-center py-4 text-neutral-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing scenes for best clips...
                </div>
              ) : shortsClips.length === 0 ? (
                <button
                  onClick={handleGenerateShorts}
                  className="w-full p-4 rounded-xl border border-dashed border-neutral-700 text-neutral-400 hover:text-white hover:border-purple-500 text-xs transition-all"
                >
                  Generate Short Clips from your video
                </button>
              ) : (
                <div className="space-y-2">
                  {shortsClips.map(clip => (
                    <label
                      key={clip.id}
                      className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedShort === clip.id
                          ? 'bg-purple-600/15 border-purple-500/60'
                          : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shortClip"
                        checked={selectedShort === clip.id}
                        onChange={() => {
                          setSelectedShort(clip.id);
                          setTitle(clip.suggestedTitle);
                          setHashtagsText(clip.hashtags.join(' '));
                        }}
                        className="accent-purple-500 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white">{clip.label}</p>
                        <p className="text-[10px] text-neutral-500">
                          {clip.sceneIndices.length} scenes, ~{clip.durationSec}s | Strategy: {clip.strategy}
                        </p>
                        <p className="text-[10px] text-purple-300 truncate mt-0.5">{clip.suggestedTitle}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Step 1: Video source */}
          <section>
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
              <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>1. Video Source</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleRenderVideo}
                disabled={rendering || scenes.length === 0 || (activeTab === 'shorts' && !selectedShort)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 transition-all"
              >
                {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileVideo className="w-4 h-4" />}
                <span>
                  {rendering
                    ? 'Rendering...'
                    : activeTab === 'shorts'
                    ? selectedShort
                      ? `Render Short 9:16 (${shortsClips.find(c => c.id === selectedShort)?.sceneIndices.length || 0} scenes)`
                      : 'Select a clip first'
                    : `Render MP4 ${aspect} (${scenes.length} scenes)`}
                </span>
              </button>
              <label className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <span>Choose Video File</span>
                <input type="file" accept="video/*" onChange={handlePickFile} className="hidden" />
              </label>
            </div>
            {rendering && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>{renderLabel}</span>
                  <div className="flex items-center space-x-2">
                    <span>{renderProgress}%</span>
                    <button onClick={() => renderAbortRef.current?.abort()} className="text-red-400 hover:text-red-300 font-semibold">Cancel</button>
                  </div>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all" style={{ width: `${renderProgress}%` }} />
                </div>
              </div>
            )}
            {videoBlob && !rendering && (
              <div className="mt-3 flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-2.5">
                <CheckCircle2 className="w-4 h-4" />
                <span className="truncate flex-1">Ready: {videoName} ({(videoBlob.size / 1024 / 1024).toFixed(1)} MB)</span>
                {downloadUrl && (
                  <a href={downloadUrl} download={videoName} className="text-indigo-300 hover:text-indigo-200 font-semibold">Download</a>
                )}
              </div>
            )}
          </section>

          {/* Step 2: Advanced SEO */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span>2. Advanced SEO & Virality Optimizer</span>
              </h3>
              <button
                onClick={handleGenerateAdvancedSeo}
                disabled={generatingSeo}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center space-x-1.5 disabled:opacity-50 transition-all"
              >
                {generatingSeo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                <span>{generatingSeo ? 'Optimizing...' : 'Generate Viral SEO'}</span>
              </button>
            </div>
            {seoSource && <p className="text-[10px] text-purple-300 mb-2">{seoSource} — review & customize before publishing.</p>}

            {/* Virality Score */}
            {seo && <ViralityMeter score={seo.viralityScore.score} tier={seo.viralityScore.tier} />}

            {/* Virality factors */}
            {seo && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {seo.viralityScore.factors.slice(0, 4).map(f => (
                  <div key={f.name} className="bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-center" title={f.tip}>
                    <p className="text-sm font-bold text-white">{f.score}</p>
                    <p className="text-[9px] text-neutral-500 uppercase">{f.name}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tips toggle */}
            {seo && seo.tips.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setShowTips(!showTips)}
                  className="flex items-center space-x-1.5 text-[11px] text-yellow-400 hover:text-yellow-300 font-semibold"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{showTips ? 'Hide' : 'Show'} Virality Tips ({seo.tips.length})</span>
                  {showTips ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showTips && (
                  <ul className="mt-2 space-y-1.5 text-[11px] text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                    {seo.tips.map((tip, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <Zap className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Posting schedule */}
            {seo && (
              <div className="mt-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-3 text-[11px] text-indigo-200">
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-bold">Optimal Posting Schedule</span>
                </div>
                <p>{seo.schedule.recommendation}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(seo.schedule.stagger).map(([platform, hours]) => (
                    <span key={platform} className="bg-indigo-900/40 px-2 py-0.5 rounded text-[10px] capitalize">
                      {platform}: +{hours}h
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SEO fields */}
            <div className="space-y-3 mt-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase">Title ({title.length}/100)</label>
                  {seo && seo.titleVariants.length > 0 && (
                    <button
                      onClick={() => setShowTitleVariants(!showTitleVariants)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold"
                    >
                      {showTitleVariants ? 'Hide' : 'Show'} A/B Variants ({seo.titleVariants.length})
                    </button>
                  )}
                </div>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Viral title with keywords..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                />
                {showTitleVariants && seo && (
                  <div className="mt-2 space-y-1">
                    {seo.titleVariants.map((variant, i) => (
                      <button
                        key={i}
                        onClick={() => { setTitle(variant); setShowTitleVariants(false); }}
                        className="w-full text-left text-[11px] text-neutral-300 bg-neutral-950 border border-neutral-800 hover:border-purple-500 rounded-lg p-2 transition-colors truncate"
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Engaging description..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Tags (comma separated)</label>
                  <textarea
                    value={tagsText}
                    onChange={e => setTagsText(e.target.value)}
                    rows={2}
                    placeholder="webtoon, manhwa, manga..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Hashtags</label>
                  <textarea
                    value={hashtagsText}
                    onChange={e => setHashtagsText(e.target.value)}
                    rows={2}
                    placeholder="#webtoon #manhwa #viral..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">Visibility</label>
                  <select
                    value={privacy}
                    onChange={e => setPrivacy(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="unlisted">Unlisted (test first)</option>
                    <option value="public">Public (go viral!)</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <label className="flex items-center space-x-2 text-xs text-neutral-300 pt-5 cursor-pointer">
                  <input type="checkbox" checked={madeForKids} onChange={e => setMadeForKids(e.target.checked)} className="accent-indigo-500" />
                  <span>Made for kids</span>
                </label>
              </div>
            </div>

            {/* Risks */}
            {seo && seo.viralityScore.risks.length > 0 && (
              <div className="mt-3 bg-amber-950/30 border border-amber-900/40 rounded-xl p-2.5">
                <p className="text-[10px] font-bold text-amber-400 flex items-center space-x-1 mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Reach Risks</span>
                </p>
                {seo.viralityScore.risks.map((risk, i) => (
                  <p key={i} className="text-[10px] text-amber-200/80">- {risk}</p>
                ))}
              </div>
            )}
          </section>

          {/* Step 3: Platform Selection */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. Platforms ({totalTargets} selected)</span>
              </h3>
              <button onClick={() => { setAccountsLoading(true); fetchAccounts(); }} className="p-1.5 text-neutral-400 hover:text-white transition-colors" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {accountsLoading ? (
              <div className="flex items-center justify-center py-4 text-neutral-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading accounts...
              </div>
            ) : (
              <div className="space-y-3">
                {/* YouTube accounts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-neutral-400 flex items-center space-x-1.5">
                      <Youtube className="w-3.5 h-3.5 text-red-500" />
                      <span>YouTube</span>
                    </span>
                    <button onClick={() => handleConnectPlatform('youtube')} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1">
                      <PlusCircle className="w-3 h-3" />
                      <span>Connect</span>
                    </button>
                  </div>
                  {ytAccounts.length === 0 ? (
                    <p className="text-[10px] text-neutral-600 pl-5">No YouTube channels connected</p>
                  ) : (
                    <div className="space-y-1.5 pl-1">
                      {ytAccounts.map(a => (
                        <label
                          key={a._id}
                          className={`flex items-center space-x-2.5 p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                            selectedYtIds.includes(a._id) ? 'bg-red-600/10 border-red-500/40' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedYtIds.includes(a._id)}
                            onChange={e => setSelectedYtIds(prev => e.target.checked ? [...prev, a._id] : prev.filter(id => id !== a._id))}
                            className="accent-red-500"
                          />
                          {a.thumbnailUrl ? <img src={a.thumbnailUrl} alt="" className="w-6 h-6 rounded-full" /> : <Youtube className="w-6 h-6 text-red-500" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{a.channelTitle}</p>
                            <p className="text-[10px] text-neutral-500 truncate">{a.email || a.channelId}{a.stats?.subscribers != null && ` | ${a.stats.subscribers} subs`}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Social platform accounts */}
                {(['instagram', 'reddit', 'twitter', 'facebook'] as const).map(platform => {
                  const accs = socialAccounts.filter(a => a.platform === platform);
                  const platformLabel = platform === 'twitter' ? 'X / Twitter' : platform.charAt(0).toUpperCase() + platform.slice(1);
                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-neutral-400 flex items-center space-x-1.5">
                          {PLATFORM_ICONS[platform]}
                          <span>{platformLabel}</span>
                        </span>
                        <button onClick={() => handleConnectPlatform(platform)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1">
                          <PlusCircle className="w-3 h-3" />
                          <span>Connect</span>
                        </button>
                      </div>
                      {accs.length === 0 ? (
                        <p className="text-[10px] text-neutral-600 pl-5">No {platformLabel} accounts connected</p>
                      ) : (
                        <div className="space-y-1.5 pl-1">
                          {accs.map(a => {
                            const isSelected = selectedSocialTargets.some(t => t.platform === platform && t.accountId === a._id);
                            return (
                              <label
                                key={a._id}
                                className={`flex items-center space-x-2.5 p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                                  isSelected ? `bg-neutral-800/50 border-neutral-600` : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => toggleSocialTarget(platform, a._id, e.target.checked)}
                                  className="accent-indigo-500"
                                />
                                {a.profileImageUrl ? <img src={a.profileImageUrl} alt="" className="w-6 h-6 rounded-full" /> : PLATFORM_ICONS[platform]}
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-white truncate">{a.displayName}</p>
                                  <p className="text-[10px] text-neutral-500 truncate">
                                    {a.username ? `@${a.username}` : a.email || ''}
                                    {a.stats?.followers != null && ` | ${a.stats.followers} followers`}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload Results</span>
              </h3>
              {results.map((r, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs ${
                    r.success ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-red-950/30 border-red-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center space-x-2">
                      {r.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      {PLATFORM_ICONS[r.platform]}
                      <span>{r.displayName}</span>
                    </span>
                    {r.postUrl && (
                      <a href={r.postUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center space-x-1">
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  {r.error && <p className="text-red-400 mt-1">{r.error}</p>}
                  {r.postUrl && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => copyLink(r.postUrl!)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center space-x-1"
                      >
                        {copiedUrl === r.postUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedUrl === r.postUrl ? 'Copied!' : 'Copy'}</span>
                      </button>
                      {Object.entries(shareLinks(r.postUrl, title)).map(([name, href]) => (
                        <a
                          key={name}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded-lg text-[10px] font-semibold capitalize"
                        >
                          {name === 'x' ? 'X' : name}
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
            disabled={uploading || !videoBlob || totalTargets === 0}
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white text-sm font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-40 transition-all shadow-lg"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            <span>
              {uploading
                ? 'Publishing across platforms...'
                : `Publish to ${totalTargets} Platform${totalTargets !== 1 ? 's' : ''}`}
            </span>
          </button>

          {/* Thumbnail tips */}
          {seo && seo.primary.thumbnailTips.length > 0 && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
              <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5">Thumbnail Tips for Higher CTR</p>
              {seo.primary.thumbnailTips.map((tip, i) => (
                <p key={i} className="text-[10px] text-neutral-500">- {tip}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
