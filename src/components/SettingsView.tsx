import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  FolderArchive,
  RefreshCw,
  Server,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ShieldCheck,
  HardDrive,
  Terminal,
  Code2,
  Play,
  Copy,
  Check,
  Cloud,
} from 'lucide-react';
import { MongoStatus } from '../types.js';

interface SettingsViewProps {
  mongoStatus: MongoStatus;
  onRefreshMongoStatus: () => void;
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  mongoStatus,
  onRefreshMongoStatus,
  onDownloadZip,
  isDownloadingZip,
}) => {
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{ configured: boolean; cloudName?: string } | null>(null);

  useEffect(() => {
    fetch('/api/v1/cloudinary/status')
      .then((res) => res.json())
      .then((data) => setCloudinaryStatus(data))
      .catch(() => {});
  }, []);

  const handleExportBackup = () => {
    window.open('/api/v1/backup/export', '_blank');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        const res = await fetch('/api/v1/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });
        if (res.ok) {
          const data = await res.json();
          alert(`Backup restored successfully! Imported ${data.imported?.mangasCount || 0} mangas.`);
          window.location.reload();
        } else {
          alert('Failed to restore backup.');
        }
      } catch (err) {
        alert('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Server className="w-5 h-5 text-rose-500" />
          <span>Server & Database Configuration</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage your Suwayomi TypeScript server, MongoDB connection, JSON backup/restore, and project export
        </p>
      </div>

      {/* 1. Download Overall Project ZIP Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-rose-950/20 border border-rose-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Ready for Export
              </span>
              <h3 className="text-lg font-bold text-white">Download Overall Project ZIP</h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">
              Download the entire converted TypeScript &amp; MongoDB Suwayomi Server as a complete,
              self-contained ZIP archive. Includes backend Express server, MongoDB schemas, React reader UI,
              Docker configuration, and installation scripts.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-2">
              <span className="flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5 text-rose-400" /> TypeScript + Node.js 22
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-400" /> MongoDB / Mongoose
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-amber-400" /> Docker Compose Ready
              </span>
            </div>
          </div>

          <button
            id="btn-settings-download-zip"
            onClick={onDownloadZip}
            disabled={isDownloadingZip}
            className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-rose-950/50 flex items-center gap-2.5 transition-all shrink-0 cursor-pointer"
          >
            <FolderArchive className="w-4 h-4" />
            <span>{isDownloadingZip ? 'Packaging ZIP...' : 'Download Project ZIP'}</span>
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MongoDB Database Integration */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">MongoDB Database Connection</h3>
              <p className="text-xs text-zinc-400">
                Replaces Kotlin SQLite / Exposed ORM with high-performance MongoDB persistence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-refresh-mongo"
              onClick={onRefreshMongoStatus}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              title="Refresh Connection"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${
                mongoStatus.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {mongoStatus.connected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>MongoDB Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>In-Memory Fallback Mode</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status explanation */}
        <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/80 text-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-zinc-500">Active Connection Mode:</span>
            <span className="font-mono font-medium">
              {mongoStatus.connected ? 'MongoDB Live Driver' : 'In-Memory Store (Resilient Fallback)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-zinc-300">
            <span className="text-zinc-500">Connection Source:</span>
            <span className="font-mono font-medium">MONGODB_URI environment variable</span>
          </div>
          {mongoStatus.error && (
            <p className="text-amber-400/90 pt-1 text-[11px] leading-relaxed">
              Note: {mongoStatus.error} The app remains fully functional with its built-in memory store.
            </p>
          )}
        </div>

        {/* Database Collection Metrics */}
        {mongoStatus.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-medium">Manga Titles</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {mongoStatus.stats.mangaCount}
              </p>
            </div>
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-medium">Total Chapters</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {mongoStatus.stats.chapterCount}
              </p>
            </div>
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-medium">Categories</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {mongoStatus.stats.categoryCount}
              </p>
            </div>
            <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <span className="text-[11px] text-zinc-500 font-medium">History Records</span>
              <p className="text-lg font-bold text-white mt-0.5">
                {mongoStatus.stats.historyCount}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cloudinary Image Storage Configuration */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cloudinary Image Storage</h3>
              <p className="text-xs text-zinc-400">
                Cloud-hosted image storage and CDN optimization for manga covers and chapter pages
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${
              cloudinaryStatus?.configured
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {cloudinaryStatus?.configured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Cloudinary Connected ({cloudinaryStatus.cloudName})</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Local Fallback Mode</span>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          When Cloudinary is configured via environment variables (<code className="text-sky-400 font-mono">CLOUDINARY_CLOUD_NAME</code>, <code className="text-sky-400 font-mono">CLOUDINARY_API_KEY</code>, <code className="text-sky-400 font-mono">CLOUDINARY_API_SECRET</code>),
          all uploaded CBZ and chapter pages are automatically uploaded to Cloudinary, ensuring tiny MongoDB documents and fast CDN delivery.
        </p>
      </div>
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Backup &amp; Library Restore</h3>
            <p className="text-xs text-zinc-400">Export or restore library state in JSON format</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            id="btn-export-backup"
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Restore JSON Backup</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>
        </div>
      </div>

      {/* 5. About Suwayomi Server TypeScript */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 text-xs text-zinc-400 space-y-3">
        <h4 className="font-semibold text-zinc-200 text-sm">About Suwayomi Server (TypeScript Edition)</h4>
        <p className="leading-relaxed">
          This application is a complete TypeScript/Node.js rewrite of{' '}
          <a
            href="https://github.com/Suwayomi/Suwayomi-Server.git"
            target="_blank"
            rel="noreferrer"
            className="text-rose-400 hover:underline"
          >
            Suwayomi/Suwayomi-Server
          </a>
          . It preserves the core REST API contract (`/api/v1/...`), GraphQL API (`/graphql`), replaces SQLite/Exposed ORM with MongoDB,
          bundles a modern responsive web manga reader, extension manager, chapter downloader, and is container-ready.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-[11px] text-zinc-500">
          <span>Port: 3000</span>
          <span>•</span>
          <span>Backend: Express 4 + TypeScript</span>
          <span>•</span>
          <span>Database: MongoDB + Resilient Memory Fallback</span>
          <span>•</span>
          <span>Frontend: React 19 + Tailwind CSS</span>
        </div>
      </div>
    </div>
  );
};
