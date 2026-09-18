import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { toggleSidebar, openAuthModal } from '../redux/slices/uiSlice';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Mic,
  Video,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  LogIn,
  UserPlus
} from 'lucide-react';

interface NavItem {
  id: 'dashboard' | 'series' | 'chapters' | 'reader' | 'story-studio' | 'voice' | 'video-studio' | 'assets' | 'settings';
  label: string;
  icon: any;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { activeTab, sidebarOpen } = useAppSelector((state) => state.ui);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'series', label: 'Series Library', icon: BookOpen },
    { id: 'chapters', label: 'Chapter Upload', icon: Layers },
    { id: 'reader', label: 'Webtoon Reader', icon: BookOpen },
    { id: 'story-studio', label: 'Story Studio', icon: FileText },
    { id: 'voice', label: 'Reference Voice', icon: Mic },
    { id: 'video-studio', label: 'Video Studio (NLE)', icon: Video, badge: 'PRO' },
    { id: 'assets', label: 'Media Bin Assets', icon: FolderKanban },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <aside
      className={`bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-300 z-30 select-none ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4">
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h1 className="text-sm font-semibold text-zinc-100 tracking-tight leading-tight truncate">
                Webtoon Studio
              </h1>
              <p className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">
                Comic &amp; Video NLE
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto">
            <Sparkles className="w-4 h-4" />
          </div>
        )}

        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
              {sidebarOpen && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}
              {sidebarOpen && item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      {sidebarOpen && (
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/40">
          {isAuthenticated && user ? (
            <div
              id="sidebar-user-card"
              onClick={() => dispatch(openAuthModal('login'))}
              className="flex items-center gap-2.5 p-1.5 -m-1 rounded-xl hover:bg-zinc-800/60 cursor-pointer transition-colors group"
              title="Click to switch account or sign in"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 group-hover:border-indigo-500/50 flex items-center justify-center text-xs font-bold text-zinc-200 shrink-0 transition-colors">
                {user?.name?.[0]?.toUpperCase() || 'C'}
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">
                  {user?.name || 'Creator'}
                </p>
                <p className="text-[10px] text-zinc-500 truncate">{user?.email || 'creator@studio.com'}</p>
              </div>
              <LogIn className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                id="sidebar-signin-btn"
                onClick={() => dispatch(openAuthModal('login'))}
                className="w-full py-1.5 px-2.5 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                Sign In
              </button>
              <button
                id="sidebar-register-btn"
                onClick={() => dispatch(openAuthModal('register'))}
                className="w-full py-1.5 px-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create Account
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
