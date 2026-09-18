import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { clearNotification, openAuthModal, showNotification } from '../redux/slices/uiSlice';
import { logout } from '../redux/slices/authSlice';
import { Bell, CheckCircle2, AlertCircle, Info, Sparkles, Film, User, LogIn, UserPlus, LogOut, ChevronDown } from 'lucide-react';

export const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeTab, notification } = useAppSelector((state) => state.ui);
  const { currentChapter } = useAppSelector((state) => state.chapter);
  const { selectedSeries } = useAppSelector((state) => state.series);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const formatTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Studio Overview';
      case 'series':
        return 'Series Library Management';
      case 'chapters':
        return 'Chapter CBZ & Image Upload';
      case 'reader':
        return 'Webtoon Reader & Scene Narration';
      case 'story-studio':
        return 'Story Scripting & Chapter Complete Story';
      case 'voice':
        return 'Reference Voice Manager (1-Voice Constraint)';
      case 'video-studio':
        return 'Professional Multi-Track Video Editor (NLE)';
      case 'assets':
        return 'Media Bin & Project Assets';
      case 'settings':
        return 'System & API Settings';
      default:
        return 'Webtoon Studio';
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    dispatch(showNotification({
      message: 'Logged out successfully. You can sign in or create an account anytime.',
      type: 'info'
    }));
    setUserMenuOpen(false);
  };

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">{formatTabTitle(activeTab)}</h2>
        {selectedSeries && (
          <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
            Series: <span className="text-zinc-200 font-medium">{selectedSeries.title}</span>
          </span>
        )}
        {currentChapter && (
          <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            Ch. {currentChapter.chapterNumber}: {currentChapter.title}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Toast Banner */}
        {notification && (
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs border ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : notification.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {notification.type === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
            {notification.type === 'info' && <Info className="w-3.5 h-3.5" />}
            <span>{notification.message}</span>
            <button
              onClick={() => dispatch(clearNotification())}
              className="ml-1 text-zinc-400 hover:text-zinc-200"
            >
              ×
            </button>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md">
          <Film className="w-3.5 h-3.5 text-indigo-400" />
          <span>Render Pipeline: Active</span>
        </div>

        {/* Auth / Account Controls */}
        <div className="relative">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                id="header-user-menu-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs text-zinc-200 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="font-medium max-w-[120px] truncate">{user.name || user.email}</span>
                {user.role === 'superadmin' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    SUPER ADMIN
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-1.5 z-50 animate-fade-in"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-zinc-800/80">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{user.name || 'Creator'}</p>
                      {user.role === 'superadmin' && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Super Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <button
                    id="menu-switch-account-btn"
                    onClick={() => {
                      setUserMenuOpen(false);
                      dispatch(openAuthModal('login'));
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 flex items-center gap-2"
                  >
                    <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                    Switch Account / Sign In
                  </button>
                  <button
                    id="menu-register-account-btn"
                    onClick={() => {
                      setUserMenuOpen(false);
                      dispatch(openAuthModal('register'));
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 flex items-center gap-2"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    Register New Account
                  </button>
                  <div className="border-t border-zinc-800/80 my-1"></div>
                  <button
                    id="menu-logout-btn"
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="header-login-btn"
                onClick={() => dispatch(openAuthModal('login'))}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                Sign In
              </button>
              <button
                id="header-register-btn"
                onClick={() => dispatch(openAuthModal('register'))}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
