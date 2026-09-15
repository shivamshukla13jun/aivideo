import React from 'react';
import { X, Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { MongoStatus } from '../types.js';

interface MongoStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  mongoStatus: MongoStatus;
  onRefreshMongoStatus: () => void;
}

export const MongoStatusModal: React.FC<MongoStatusModalProps> = ({
  isOpen,
  onClose,
  mongoStatus,
  onRefreshMongoStatus,
}) => {
  if (!isOpen) return null;

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
              <h3 className="font-bold text-white text-base">MongoDB Status</h3>
              <p className="text-xs text-zinc-400">Database connection status</p>
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
            <span className="text-zinc-500 block mb-1">Connection Source:</span>
            <span className="font-mono text-[11px] text-zinc-400 break-all bg-zinc-950 px-2 py-1 rounded block border border-zinc-800">
              MONGODB_URI environment variable (server-side only)
            </span>
          </div>

          {mongoStatus.error && (
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              Note: {mongoStatus.error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onRefreshMongoStatus}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-2 py-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
