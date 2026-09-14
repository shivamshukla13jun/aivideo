import React, { useState } from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { MongoStatus } from '../types.js';

interface MongoStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  mongoStatus: MongoStatus;
  onConnectMongo: (uri: string) => Promise<void>;
  onRefreshMongoStatus: () => void;
}

export const MongoStatusModal: React.FC<MongoStatusModalProps> = ({
  isOpen,
  onClose,
  mongoStatus,
  onConnectMongo,
  onRefreshMongoStatus,
}) => {
  const [uri, setUri] = useState(mongoStatus.uri || 'mongodb://localhost:27017/suwayomi');
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uri.trim()) return;
    setIsConnecting(true);
    setStatusMsg(null);
    try {
      await onConnectMongo(uri.trim());
      setStatusMsg('Connected successfully or fallback activated.');
    } catch (err: any) {
      setStatusMsg(err.message || 'Connection failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">MongoDB Status &amp; Connection</h3>
              <p className="text-xs text-zinc-400">Database connection manager</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Connection State:</span>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                mongoStatus.connected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {mongoStatus.connected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>MongoDB Live</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>In-Memory Fallback</span>
                </>
              )}
            </div>
          </div>

          <div className="text-xs text-zinc-300">
            <span className="text-zinc-500 block mb-1">Configured URI:</span>
            <span className="font-mono text-[11px] text-zinc-400 break-all bg-zinc-950 px-2 py-1 rounded block border border-zinc-800">
              {mongoStatus.uri || 'mongodb://localhost:27017/suwayomi'}
            </span>
          </div>

          {mongoStatus.error && (
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              Note: {mongoStatus.error}
            </p>
          )}
        </div>

        {/* Connect Form */}
        <form onSubmit={handleConnect} className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-300">
            Switch MongoDB Connection String:
          </label>
          <input
            id="modal-input-mongo-uri"
            type="text"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="mongodb://localhost:27017/suwayomi"
            className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 focus:outline-none focus:border-rose-500"
          />

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onRefreshMongoStatus}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-2 py-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                type="submit"
                id="modal-btn-connect"
                disabled={isConnecting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
          {statusMsg && <p className="text-xs text-zinc-400 text-right">{statusMsg}</p>}
        </form>
      </div>
    </div>
  );
};
