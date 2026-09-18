import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { assetService } from '../services/assetService';
import { setAssets, addAssetItem, removeAssetItem } from '../redux/slices/assetSlice';
import { showNotification } from '../redux/slices/uiSlice';
import { Asset } from '../types';
import { FolderKanban, Image as ImageIcon, Video, Mic, Music, Volume2, Sparkles, Trash2, Plus, Search } from 'lucide-react';

export const AssetsView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items: assets } = useAppSelector((state) => state.asset);

  const [activeFilter, setActiveFilter] = useState<Asset['type'] | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    assetService.getAssets().then((data) => {
      dispatch(setAssets(data));
    }).catch(console.error);
  }, [dispatch]);

  const filteredAssets = assets.filter((a) => {
    const matchesFilter = activeFilter === 'all' || a.type === activeFilter;
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleDelete = async (id: string) => {
    await assetService.deleteAsset(id);
    dispatch(removeAssetItem(id));
    dispatch(showNotification({ message: 'Asset deleted.', type: 'info' }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-400" />
            Media Bin Asset Manager
          </h1>
          <p className="text-xs text-zinc-400">
            Centralized library for comic pages, narration audio, video clips, BGM, and sound effects.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search media assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'comic_page', 'video', 'narration', 'bgm', 'sfx', 'graphic'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all shrink-0 ${
              activeFilter === filter
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {filter.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden flex flex-col justify-between group transition-all"
          >
            <div className="h-32 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
              {asset.type === 'comic_page' || asset.type === 'graphic' ? (
                <img src={asset.fileUrl} alt={asset.title} className="w-full h-full object-cover" />
              ) : asset.type === 'video' ? (
                <Video className="w-8 h-8 text-indigo-400" />
              ) : (
                <Music className="w-8 h-8 text-pink-400" />
              )}

              <button
                onClick={() => handleDelete(asset.id)}
                className="absolute top-2 right-2 p-1.5 rounded bg-zinc-950/80 hover:bg-rose-950 text-rose-400 border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-800 space-y-1">
              <h4 className="text-xs font-bold text-zinc-200 truncate">{asset.title}</h4>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span className="capitalize">{asset.type.replace('_', ' ')}</span>
                {asset.duration && <span>{asset.duration}s</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
