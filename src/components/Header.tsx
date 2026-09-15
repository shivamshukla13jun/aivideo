import React from 'react';
import {
  BookOpen,
  Compass,
  Clock,
  History,
  Settings,
  Download,
  Database,
  CheckCircle2,
  AlertCircle,
  FolderArchive,
  ArrowDownToLine,
  Flame,
  Zap,
  Sparkles,
  Film,
  Smartphone,
} from 'lucide-react';
import { NavigationTab, MongoStatus } from '../types.js';

interface HeaderProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  mongoStatus: MongoStatus;
  onOpenMongoModal: () => void;
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
  downloadCount?: number;
  onOpenApkModal?: () => void;
  onOpenUploadCbzModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  mongoStatus,
  onOpenMongoModal,
  onDownloadZip,
  isDownloadingZip,
  downloadCount = 0,
  onOpenApkModal,
  onOpenUploadCbzModal,
}) => {
  const isMongoConnected = mongoStatus.connected;

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onTabChange('library')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Suwayomi
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                TypeScript
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">Manga Server & Reader</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80 overflow-x-auto no-scrollbar">
          <button
            id="nav-tab-library"
            onClick={() => onTabChange('library')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer ${
              currentTab === 'library'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <BookOpen className="w-4 h-4 text-rose-400" />
            <span>Library</span>
          </button>



          <button
            id="nav-tab-downloads"
            onClick={() => onTabChange('downloads')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 relative cursor-pointer ${
              currentTab === 'downloads'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4 text-purple-400" />
            <span className="hidden lg:inline">Downloads</span>
            {downloadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse absolute top-1 right-1" />
            )}
          </button>

          <button
            id="nav-tab-ai-generator"
            onClick={() => onTabChange('ai_generator')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0 relative cursor-pointer ${
              currentTab === 'ai_generator'
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-rose-300 hover:bg-zinc-800/40'
            }`}
          >
            <Film className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>AI Generator</span>
          </button>

          <button
            id="nav-tab-ai-projects"
            onClick={() => onTabChange('ai_projects')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 relative cursor-pointer ${
              currentTab === 'ai_projects'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-amber-200 hover:bg-zinc-800/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Works DB</span>
          </button>

          <button
            id="nav-tab-history"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer ${
              currentTab === 'history'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span className="hidden lg:inline">History</span>
          </button>

        </nav>

        {/* Right Actions: Upload CBZ, Android APK, MongoDB status & Download Project ZIP */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Upload CBZ / Local Manga Button */}
          {onOpenUploadCbzModal && (
            <button
              id="btn-header-upload-cbz"
              onClick={onOpenUploadCbzModal}
              title="Upload local CBZ or ZIP manga files to database"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer shadow-sm"
            >
              <FolderArchive className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Upload CBZ</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

