import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { seriesService } from '../services/seriesService';
import { setSeriesList, addSeriesItem, updateSeriesItem, removeSeriesItem, setSelectedSeries } from '../redux/slices/seriesSlice';
import { useNavigate } from 'react-router-dom';
import { Series } from '../types';
import { Plus, Edit3, Trash2, BookOpen, Layers, X, Save, Image as ImageIcon } from 'lucide-react';

export const SeriesView: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: seriesList, selectedSeries } = useAppSelector((state) => state.series);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: '',
    author: '',
    genres: 'Action, Fantasy, Webtoon',
    status: 'ongoing' as 'ongoing' | 'completed' | 'hiatus'
  });

  useEffect(() => {
    seriesService.getSeriesList().then((data) => {
      dispatch(setSeriesList(data));
      if (data.length > 0 && !selectedSeries) {
        dispatch(setSelectedSeries(data[0]));
      }
    }).catch(console.error);
  }, [dispatch]);

  const handleOpenCreate = () => {
    setEditingSeries(null);
    setFormData({
      title: '',
      description: '',
      coverImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80',
      author: 'Comic Author',
      genres: 'Action, Webtoon, Fantasy',
      status: 'ongoing'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (series: Series) => {
    setEditingSeries(series);
    setFormData({
      title: series.title,
      description: series.description,
      coverImage: series.coverImage,
      author: series.author,
      genres: series.genres.join(', '),
      status: series.status
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const genresArray = formData.genres.split(',').map((g) => g.trim()).filter(Boolean);

    if (editingSeries) {
      const updated = await seriesService.updateSeries(editingSeries.id, {
        title: formData.title,
        description: formData.description,
        coverImage: formData.coverImage,
        author: formData.author,
        genres: genresArray,
        status: formData.status
      });
      dispatch(updateSeriesItem(updated));
    } else {
      const created = await seriesService.createSeries({
        title: formData.title,
        description: formData.description,
        coverImage: formData.coverImage,
        author: formData.author,
        genres: genresArray,
        status: formData.status
      });
      dispatch(addSeriesItem(created));
      dispatch(setSelectedSeries(created));
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this series?')) {
      await seriesService.deleteSeries(id);
      dispatch(removeSeriesItem(id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Series Library</h1>
          <p className="text-xs text-zinc-400">Organize webtoon titles, chapters, cover artwork, and genres.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" /> Create New Series
        </button>
      </div>

      {/* Series Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {seriesList.map((series) => (
          <div
            key={series.id}
            className={`bg-zinc-900 border rounded-xl overflow-hidden flex flex-col transition-all ${
              selectedSeries?.id === series.id
                ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="h-48 bg-zinc-950 relative overflow-hidden">
              <img
                src={series.coverImage}
                alt={series.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <button
                  onClick={() => handleOpenEdit(series)}
                  className="p-1.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700 backdrop-blur-md"
                  title="Edit Series"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(series.id)}
                  className="p-1.5 rounded-lg bg-zinc-950/80 hover:bg-rose-950 text-rose-400 border border-zinc-700 backdrop-blur-md"
                  title="Delete Series"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">{series.title}</h3>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{series.description}</p>
                <p className="text-[11px] text-zinc-500 mt-2">Author: {series.author}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {series.genres.map((g) => (
                    <span key={g} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {g}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-400">
                  {series.chapterCount || 3} Chapters
                </span>
                <button
                  onClick={() => {
                    dispatch(setSelectedSeries(series));
                    navigate('/chapters');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" /> Manage Chapters
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Create/Edit Series */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100">
                {editingSeries ? 'Edit Series Metadata' : 'Create New Webtoon Series'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Series Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Solo Leveling"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Series synopsis..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Author / Artist</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="hiatus">Hiatus</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Genres (comma separated)</label>
                <input
                  type="text"
                  value={formData.genres}
                  onChange={(e) => setFormData({ ...formData, genres: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Cover Image URL</label>
                <input
                  type="text"
                  value={formData.coverImage}
                  onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Series
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
