import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { store } from './redux/store';
import { useAppDispatch } from './redux/hooks';
import { setActiveTab } from './redux/slices/uiSlice';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

import { DashboardView } from './components/DashboardView';
import { SeriesView } from './components/SeriesView';
import { ChaptersView } from './components/ChaptersView';
import { ReaderView } from './components/ReaderView';
import { StoryStudioView } from './components/StoryStudioView';
import { VoiceView } from './components/VoiceView';
import { VideoStudioView } from './components/VideoStudioView';
import { AssetsView } from './components/AssetsView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';

const VALID_TABS = ['dashboard', 'series', 'chapters', 'reader', 'story-studio', 'voice', 'video-studio', 'assets', 'settings'] as const;

const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();

  // Keep redux activeTab in sync with the URL for Header/Sidebar labels
  useEffect(() => {
    const tab = location.pathname.replace(/^\//, '') || 'dashboard';
    if ((VALID_TABS as readonly string[]).includes(tab)) {
      dispatch(setActiveTab(tab as (typeof VALID_TABS)[number]));
    }
  }, [location.pathname, dispatch]);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto relative">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/series" element={<SeriesView />} />
            <Route path="/chapters" element={<ChaptersView />} />
            <Route path="/reader" element={<ReaderView />} />
            <Route path="/story-studio" element={<StoryStudioView />} />
            <Route path="/voice" element={<VoiceView />} />
            <Route path="/video-studio" element={<VideoStudioView />} />
            <Route path="/assets" element={<AssetsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <AuthModal />
    </div>
  );
};

export function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
