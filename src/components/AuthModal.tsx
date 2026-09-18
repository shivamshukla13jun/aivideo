import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { closeAuthModal, setAuthModalMode, showNotification } from '../redux/slices/uiSlice';
import { setAuth } from '../redux/slices/authSlice';
import { authService } from '../services/authService';
import { Mail, Lock, User as UserIcon, Eye, EyeOff, X, LogIn, UserPlus, Sparkles, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { authModalOpen, authModalMode } = useAppSelector((state) => state.ui);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSuperAdminLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let response;
      try {
        response = await authService.login({
          email: 'admin@webtoonstudio.com',
          password: 'Admin@12345'
        });
      } catch {
        response = await authService.login({
          email: 'shivamshukla13jun@gmail.com',
          password: 'Shivam@123'
        });
      }

      dispatch(setAuth({
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken
      }));

      dispatch(showNotification({
        message: `Authenticated as Super Administrator (${response.user.name}) with full root privileges.`,
        type: 'success'
      }));
      dispatch(closeAuthModal());
    } catch (err: any) {
      setErrorMessage(err.message || 'Super admin login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (authModalMode === 'register') {
        const response = await authService.register({
          email,
          password,
          name: name.trim() || undefined
        });

        dispatch(setAuth({
          user: response.user,
          token: response.token,
          refreshToken: response.refreshToken
        }));

        dispatch(showNotification({
          message: `Welcome, ${response.user.name || 'Creator'}! Account created successfully.`,
          type: 'success'
        }));
        dispatch(closeAuthModal());
      } else {
        const response = await authService.login({
          email,
          password
        });

        dispatch(setAuth({
          user: response.user,
          token: response.token,
          refreshToken: response.refreshToken
        }));

        dispatch(showNotification({
          message: `Welcome back, ${response.user.name || 'Creator'}!`,
          type: 'success'
        }));
        dispatch(closeAuthModal());
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    dispatch(setAuth({
      user: {
        id: 'usr_demo123',
        email: 'creator@webtoonstudio.com',
        name: 'Demo Comic Creator',
        referenceVoice: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      token: 'demo-jwt-token-active',
      refreshToken: 'demo-refresh-token'
    }));

    dispatch(showNotification({
      message: 'Logged in as Demo Comic Creator',
      type: 'success'
    }));
    dispatch(closeAuthModal());
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch(closeAuthModal());
        }
      }}
    >
      <div
        id="auth-modal-card"
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative"
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {authModalMode === 'register' ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {authModalMode === 'register'
                  ? 'Join Webtoon Studio to produce cinematic stories'
                  : 'Sign in to access your comics, voice & video studio'}
              </p>
            </div>
          </div>
          <button
            id="close-auth-modal-btn"
            onClick={() => dispatch(closeAuthModal())}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1 gap-1 m-4 rounded-xl">
          <button
            id="tab-login-btn"
            type="button"
            onClick={() => {
              setErrorMessage(null);
              dispatch(setAuthModalMode('login'));
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              authModalMode === 'login'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            id="tab-register-btn"
            type="button"
            onClick={() => {
              setErrorMessage(null);
              dispatch(setAuthModalMode('register'));
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              authModalMode === 'register'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mx-6 mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {authModalMode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Creator / Author Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jin Woo"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@webtoonstudio.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{authModalMode === 'register' ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <>
                {authModalMode === 'register' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Free Account</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </>
            )}
          </button>

          {/* Quick Access Buttons */}
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <button
              id="super-admin-login-btn"
              type="button"
              onClick={handleSuperAdminLogin}
              className="w-full py-2 px-3 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Sign in as Super Admin (Default)
            </button>

            <button
              id="demo-login-btn"
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-2 px-3 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-medium rounded-xl border border-zinc-700/40 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Quick Demo Creator Access
            </button>

            <div className="p-2.5 bg-zinc-950/70 border border-zinc-800/70 rounded-xl text-[11px] text-zinc-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-300">Default Super Admin Credentials:</span>
                <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Ready</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-mono text-[10px]">
                <span>Email: <span className="text-zinc-200">admin@webtoonstudio.com</span></span>
                <span>Pass: <span className="text-zinc-200">Admin@12345</span></span>
              </div>
              <div className="flex justify-between text-zinc-400 font-mono text-[10px] pt-1 border-t border-zinc-800/60">
                <span>Email: <span className="text-zinc-200">shivamshukla13jun@gmail.com</span></span>
                <span>Pass: <span className="text-zinc-200">Shivam@123</span></span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
