import React from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { openAuthModal, showNotification } from '../redux/slices/uiSlice';
import { logout } from '../redux/slices/authSlice';
import { Settings, Shield, Cloud, Mic, Cpu, CheckCircle2, LogIn, UserPlus, LogOut } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(showNotification({
      message: 'Logged out successfully.',
      type: 'info'
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-2">
        <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" /> System Architecture &amp; Credentials
        </h1>
        <p className="text-xs text-zinc-400">
          Backend server settings, OAuth architecture status, user authentication, and AI storytelling configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" /> User &amp; JWT Profile
          </h3>
          <div className="space-y-1.5 text-xs">
            <p className="text-zinc-400">
              Status: <span className={`font-semibold ${isAuthenticated ? 'text-emerald-400' : 'text-amber-400'}`}>{isAuthenticated ? 'Authenticated' : 'Signed Out'}</span>
            </p>
            <p className="text-zinc-400">
              Name: <span className="text-zinc-100 font-semibold">{user?.name || 'Guest / Not Signed In'}</span>
            </p>
            <p className="text-zinc-400">
              Email: <span className="text-zinc-100 font-semibold">{user?.email || 'None'}</span>
            </p>
            <p className="text-zinc-400">
              Role:{' '}
              {user?.role === 'superadmin' ? (
                <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Super Administrator (Root Access)
                </span>
              ) : (
                <span className="text-indigo-400 font-semibold">Webtoon Author &amp; Video Director</span>
              )}
            </p>
          </div>

          <div className="p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl text-[11px] text-zinc-400 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-300">Super Admin Accounts:</span>
              <span className="text-emerald-400 text-[10px] bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">Active</span>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-zinc-300">
              <span>Default: <span className="text-indigo-300">admin@webtoonstudio.com</span></span>
              <span>Pass: <span className="text-indigo-300">Admin@12345</span></span>
            </div>
            <div className="flex justify-between font-mono text-[10px] text-zinc-300 pt-1 border-t border-zinc-800/60">
              <span>Custom: <span className="text-indigo-300">shivamshukla13jun@gmail.com</span></span>
              <span>Pass: <span className="text-indigo-300">Shivam@123</span></span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800 flex flex-wrap gap-2">
            <button
              id="settings-login-btn"
              onClick={() => dispatch(openAuthModal('login'))}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              {isAuthenticated ? 'Switch Account / Sign In' : 'Sign In'}
            </button>
            <button
              id="settings-register-btn"
              onClick={() => dispatch(openAuthModal('register'))}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register New
            </button>
            {isAuthenticated && (
              <button
                id="settings-logout-btn"
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Cloudinary Integration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-400" /> Cloudinary Media Storage
          </h3>
          <p className="text-xs text-zinc-400">
            Stores comic page images, narration audio, generated video clips, and rendered MP4 exports.
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Cloudinary CDN Active
          </div>
        </div>

        {/* Storytelling TTS Voice */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-pink-400" /> Storytelling Voice (1-Voice Constraint)
          </h3>
          <p className="text-xs text-zinc-400">
            Enforces exactly one reference storytelling voice per user. Automatically purges previous reference voice when replaced.
          </p>
          <div className="flex items-center gap-2 text-xs text-pink-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Single Voice Enforced
          </div>
        </div>

        {/* FFmpeg Video Render Engine */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" /> FFmpeg Multi-Track Video Render Engine
          </h3>
          <p className="text-xs text-zinc-400">
            Node.js backend rendering architecture for multi-track timeline, keyframe interpolation, audio mixing, and MP4 generation.
          </p>
          <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> FFmpeg Pipeline Loaded
          </div>
        </div>
      </div>
    </div>
  );
};
