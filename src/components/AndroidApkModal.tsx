import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle2, ShieldCheck, ExternalLink, X, Copy, QrCode, Sparkles } from 'lucide-react';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const currentAppUrl = window.location.origin;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install on Android:\n1. Open Chrome on your Android phone\n2. Tap the 3 dots (⋮) menu\n3. Tap "Add to Home screen" or "Install app"');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-zinc-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950 via-zinc-900 to-zinc-900 p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Download Android App / APK
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Android & Web
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Install Webtoon Studio directly on your phone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          {/* Method 1: Instant PWA Install Button */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 via-zinc-900 to-zinc-900 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" /> Method 1: Instant App Install (1-Click PWA)
              </span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono">Fastest</span>
            </div>
            <p className="text-xs text-zinc-300">
              Install the app directly on your Android phone's home screen with offline chapter caching, full screen reading, and studio tools.
            </p>
            <button
              onClick={handleInstallPwa}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isInstalled ? '✓ App Installed on Device' : 'Install Mobile App to Home Screen'}</span>
            </button>
          </div>

          {/* Method 2: Download TWA / APK Zip */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Method 2: Build / Download Native APK (Bubblewrap TWA)
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              To turn this project into an <strong className="text-zinc-200">Android .APK file</strong> using Bubblewrap or PWABuilder:
            </p>
            <ol className="list-decimal list-inside text-xs text-zinc-300 space-y-1.5 pl-1">
              <li>Copy your live App Web URL below</li>
              <li>Go to <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="text-rose-400 underline hover:text-rose-300">pwabuilder.com</a> or use Google's <code className="bg-zinc-900 px-1 py-0.5 rounded text-amber-300">bubblewrap build</code></li>
              <li>Enter the app URL and click <strong>"Package Android APK"</strong> to download your <strong className="text-emerald-400 font-mono">.apk</strong> file instantly!</li>
            </ol>

            {/* App URL Copy Box */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={currentAppUrl}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
