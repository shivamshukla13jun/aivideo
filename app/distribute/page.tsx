'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useSearchParams } from 'next/navigation';
import {
  Globe,
  Loader2,
  PlusCircle,
  RefreshCw,
  Trash2,
  Users,
  Eye,
  Video,
  TrendingUp,
  ExternalLink,
  UploadCloud,
  Youtube,
  Instagram,
  Twitter,
  Facebook,
  MessagesSquare,
  Zap,
  BarChart3,
  CheckCircle2,
  Link2,
  Share2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Platform = 'youtube' | 'instagram' | 'reddit' | 'twitter' | 'facebook';

interface SocialAccountData {
  _id: string;
  platform: Platform;
  displayName: string;
  username?: string;
  profileImageUrl?: string;
  email?: string;
  connectedAt: string;
  stats?: {
    followers: number;
    totalPosts: number;
    totalViews: number;
    lastSyncedAt?: string;
  };
}

interface YouTubeAccountData {
  _id: string;
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnailUrl?: string;
  email?: string;
  connectedAt: string;
  stats?: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
    lastSyncedAt?: string;
  };
}

interface UploadData {
  _id: string;
  fileName: string;
  videoType: string;
  seo: { title: string };
  status: string;
  targets: { platform: string; displayName: string; status: string; postUrl?: string; error?: string }[];
  createdAt: string;
}

const PLATFORM_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  youtube: { label: 'YouTube', icon: <Youtube className="w-5 h-5 text-red-500" />, color: 'text-red-400', bg: 'bg-red-950/40 border-red-900/50' },
  instagram: { label: 'Instagram', icon: <Instagram className="w-5 h-5 text-pink-400" />, color: 'text-pink-400', bg: 'bg-pink-950/40 border-pink-900/50' },
  reddit: { label: 'Reddit', icon: <MessagesSquare className="w-5 h-5 text-orange-400" />, color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-900/50' },
  twitter: { label: 'X / Twitter', icon: <Twitter className="w-5 h-5 text-sky-400" />, color: 'text-sky-400', bg: 'bg-sky-950/40 border-sky-900/50' },
  facebook: { label: 'Facebook', icon: <Facebook className="w-5 h-5 text-blue-400" />, color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-900/50' },
};

function fmt(n?: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

export default function DistributePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
          <Navbar />
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        </div>
      }
    >
      <DistributeDashboard />
    </Suspense>
  );
}

function DistributeDashboard() {
  const searchParams = useSearchParams();
  const [ytAccounts, setYtAccounts] = useState<YouTubeAccountData[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountData[]>([]);
  const [uploads, setUploads] = useState<UploadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');
  const platformParam = searchParams.get('platform');
  const topBanner =
    banner ||
    (connectedParam
      ? { type: 'ok' as const, text: `${platformParam ? PLATFORM_META[platformParam]?.label + ' — ' : ''}${connectedParam} connected!` }
      : errorParam
      ? { type: 'err' as const, text: `Connection failed: ${errorParam}` }
      : null);

  const loadAll = async () => {
    try {
      const [ytRes, socialRes, upRes] = await Promise.all([
        fetch('/api/youtube/accounts'),
        fetch('/api/social/accounts'),
        fetch('/api/social/uploads'),
      ]);
      const ytData = await ytRes.json();
      const socialData = await socialRes.json();
      const upData = await upRes.json();
      if (ytData.success) setYtAccounts(ytData.data);
      if (socialData.success) setSocialAccounts(socialData.data);
      if (upData.success) setUploads(upData.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadAll, 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  const handleConnect = async (platform: string) => {
    try {
      const endpoint = platform === 'youtube' ? '/api/youtube/auth' : `/api/social/auth?platform=${platform}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success && data.url) {
        window.location.assign(data.url);
      } else {
        setBanner({ type: 'err', text: data.error || `${platform} OAuth not configured` });
      }
    } catch {
      setBanner({ type: 'err', text: `Failed to start ${platform} connection` });
    }
  };

  const handleSyncYT = async (id: string) => {
    setSyncing(id);
    try {
      await fetch(`/api/youtube/accounts/${id}/sync`, { method: 'POST' });
      await loadAll();
    } catch {} finally { setSyncing(null); }
  };

  const handleSyncSocial = async (id: string) => {
    setSyncing(id);
    try {
      await fetch(`/api/social/accounts/${id}/sync`, { method: 'POST' });
      await loadAll();
    } catch {} finally { setSyncing(null); }
  };

  const handleDisconnectYT = async (id: string, title: string) => {
    if (!confirm(`Disconnect YouTube channel "${title}"?`)) return;
    await fetch(`/api/youtube/accounts?id=${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const handleDisconnectSocial = async (id: string, name: string) => {
    if (!confirm(`Disconnect "${name}"?`)) return;
    await fetch(`/api/social/accounts?id=${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const totalAccounts = ytAccounts.length + socialAccounts.length;
  const totalFollowers = (ytAccounts.reduce((s, a) => s + (a.stats?.subscribers || 0), 0) + socialAccounts.reduce((s, a) => s + (a.stats?.followers || 0), 0));
  const totalUploads = uploads.length;
  const successfulUploads = uploads.filter(u => u.status === 'done').length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2.5">
              <Globe className="w-7 h-7 text-indigo-400" />
              <span>Distribution Hub</span>
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Connect platforms, optimize SEO, generate Shorts, and publish everywhere to go viral.
            </p>
          </div>
        </div>

        {topBanner && (
          <div className={`p-3 rounded-xl text-sm border ${
            topBanner.type === 'ok' ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-red-950/50 border-red-800 text-red-300'
          }`}>
            {topBanner.text}
          </div>
        )}

        {/* Stats overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Link2, label: 'Connected Platforms', value: totalAccounts, color: 'text-indigo-400' },
            { icon: Users, label: 'Total Reach', value: fmt(totalFollowers), color: 'text-emerald-400' },
            { icon: UploadCloud, label: 'Total Uploads', value: totalUploads, color: 'text-purple-400' },
            { icon: CheckCircle2, label: 'Successful', value: successfulUploads, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Connect platforms */}
        <section>
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            <span>Connect Platforms</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(PLATFORM_META).map(([key, meta]) => {
              const connected = key === 'youtube'
                ? ytAccounts.length > 0
                : socialAccounts.some(a => a.platform === key);
              return (
                <button
                  key={key}
                  onClick={() => handleConnect(key)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center space-y-2 ${
                    connected
                      ? 'border-emerald-700/50 bg-emerald-950/20 hover:bg-emerald-950/30'
                      : 'border-dashed border-neutral-700 hover:border-indigo-500/60 hover:bg-neutral-900'
                  }`}
                >
                  {meta.icon}
                  <span className="text-xs font-bold text-white">{meta.label}</span>
                  {connected ? (
                    <span className="text-[9px] text-emerald-400 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-neutral-500">Click to connect</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Connected accounts */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : totalAccounts === 0 ? (
          <div className="p-10 rounded-2xl border-2 border-dashed border-neutral-800 text-center text-neutral-400 space-y-3">
            <Globe className="w-12 h-12 mx-auto text-indigo-500" />
            <p className="font-semibold">No platforms connected yet</p>
            <p className="text-xs">Connect YouTube, Instagram, Reddit, X, or Facebook above to start publishing.</p>
          </div>
        ) : (
          <section>
            <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Connected Accounts ({totalAccounts})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* YouTube accounts */}
              {ytAccounts.map(a => (
                <div key={a._id} className={`rounded-2xl border p-4 space-y-3 ${PLATFORM_META.youtube.bg}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {a.thumbnailUrl ? <img src={a.thumbnailUrl} alt="" className="w-10 h-10 rounded-full border border-neutral-700" /> : <Youtube className="w-10 h-10 text-red-500" />}
                      <div>
                        <p className="font-bold text-white text-sm">{a.channelTitle}</p>
                        <p className="text-[10px] text-neutral-500">{a.email || a.customUrl || a.channelId}</p>
                        <p className="text-[10px] text-red-400 font-semibold">YouTube</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleSyncYT(a._id)} disabled={syncing === a._id} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors" title="Sync">
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing === a._id ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => handleDisconnectYT(a._id, a.channelTitle)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800/60 transition-colors" title="Disconnect">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-neutral-950/60 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{fmt(a.stats?.subscribers)}</p>
                      <p className="text-[8px] text-neutral-500 uppercase">Subscribers</p>
                    </div>
                    <div className="bg-neutral-950/60 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{fmt(a.stats?.totalViews)}</p>
                      <p className="text-[8px] text-neutral-500 uppercase">Views</p>
                    </div>
                    <div className="bg-neutral-950/60 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-white">{fmt(a.stats?.videoCount)}</p>
                      <p className="text-[8px] text-neutral-500 uppercase">Videos</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Social accounts */}
              {socialAccounts.map(a => {
                const meta = PLATFORM_META[a.platform] || PLATFORM_META.youtube;
                return (
                  <div key={a._id} className={`rounded-2xl border p-4 space-y-3 ${meta.bg}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {a.profileImageUrl ? <img src={a.profileImageUrl} alt="" className="w-10 h-10 rounded-full border border-neutral-700" /> : meta.icon}
                        <div>
                          <p className="font-bold text-white text-sm">{a.displayName}</p>
                          <p className="text-[10px] text-neutral-500">{a.username ? `@${a.username}` : a.email || ''}</p>
                          <p className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button onClick={() => handleSyncSocial(a._id)} disabled={syncing === a._id} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors" title="Sync">
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing === a._id ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => handleDisconnectSocial(a._id, a.displayName)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800/60 transition-colors" title="Disconnect">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-neutral-950/60 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-white">{fmt(a.stats?.followers)}</p>
                        <p className="text-[8px] text-neutral-500 uppercase">Followers</p>
                      </div>
                      <div className="bg-neutral-950/60 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-white">{fmt(a.stats?.totalPosts)}</p>
                        <p className="text-[8px] text-neutral-500 uppercase">Posts</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Upload history */}
        <section>
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            <span>Cross-Platform Upload History ({uploads.length})</span>
          </h2>
          {uploads.length === 0 ? (
            <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500">
              No uploads yet. Open a chapter&apos;s Video Studio and use &quot;Publish Everywhere&quot; to distribute across all platforms.
            </div>
          ) : (
            <div className="space-y-3">
              {uploads.map(u => (
                <div key={u._id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-bold text-white truncate">{u.seo?.title || u.fileName}</p>
                      {u.videoType === 'short' && (
                        <span className="text-[9px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded-full font-bold uppercase">Short</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      u.status === 'done' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      u.status === 'failed' ? 'bg-red-950 text-red-400 border border-red-800' :
                      'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {u.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mb-2">
                    {new Date(u.createdAt).toLocaleString()} | {u.fileName}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {u.targets.map((t, i) => {
                      const pm = PLATFORM_META[t.platform] || PLATFORM_META.youtube;
                      return (
                        <span
                          key={i}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center space-x-1.5 ${
                            t.status === 'done' ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300' :
                            t.status === 'failed' ? 'bg-red-950/40 border-red-900/50 text-red-300' :
                            'bg-neutral-800 border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {pm.icon}
                          <span>{t.displayName}</span>
                          {t.postUrl && (
                            <a href={t.postUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Setup instructions */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Platform Setup Guide</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-400">
            <div className="space-y-2">
              <p className="font-bold text-white flex items-center space-x-1.5"><Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube</p>
              <p>Set <code className="bg-neutral-800 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-neutral-800 px-1 rounded">GOOGLE_CLIENT_SECRET</code> in .env</p>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-white flex items-center space-x-1.5"><Instagram className="w-3.5 h-3.5 text-pink-400" /> Instagram</p>
              <p>Set <code className="bg-neutral-800 px-1 rounded">FACEBOOK_APP_ID</code> and <code className="bg-neutral-800 px-1 rounded">FACEBOOK_APP_SECRET</code> (shared with Facebook)</p>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-white flex items-center space-x-1.5"><MessagesSquare className="w-3.5 h-3.5 text-orange-400" /> Reddit</p>
              <p>Set <code className="bg-neutral-800 px-1 rounded">REDDIT_CLIENT_ID</code> and <code className="bg-neutral-800 px-1 rounded">REDDIT_CLIENT_SECRET</code> (script app at reddit.com/prefs/apps)</p>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-white flex items-center space-x-1.5"><Twitter className="w-3.5 h-3.5 text-sky-400" /> X / Twitter</p>
              <p>Set <code className="bg-neutral-800 px-1 rounded">TWITTER_CLIENT_ID</code> and <code className="bg-neutral-800 px-1 rounded">TWITTER_CLIENT_SECRET</code> (OAuth 2.0)</p>
            </div>
          </div>
          <p className="text-[10px] text-neutral-600 mt-3">
            AI SEO requires <code className="bg-neutral-800 px-1 rounded">GEMINI_API_KEY</code>. Without it, the algorithm-based SEO engine will be used.
          </p>
        </section>
      </main>
    </div>
  );
}
