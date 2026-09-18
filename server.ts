import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

import { config } from './server/src/config/index';
import { initSocketIO } from './server/src/sockets/socketHandler';

import authRoutes from './server/src/routes/authRoutes';
import seriesRoutes from './server/src/routes/seriesRoutes';
import chapterRoutes from './server/src/routes/chapterRoutes';
import uploadRoutes from './server/src/routes/uploadRoutes';
import sceneRoutes from './server/src/routes/sceneRoutes';
import scriptRoutes from './server/src/routes/scriptRoutes';
import referenceVoiceRoutes from './server/src/routes/referenceVoiceRoutes';
import narrationRoutes from './server/src/routes/narrationRoutes';
import assetRoutes from './server/src/routes/assetRoutes';
import videoProjectRoutes from './server/src/routes/videoProjectRoutes';
import renderRoutes from './server/src/routes/renderRoutes';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Initialize Socket.io
  initSocketIO(server);

  // Middlewares
  app.use(cors());
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Static uploads directory for fast and durable media serving
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/series', seriesRoutes);
  app.use('/api/chapters', chapterRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/scenes', sceneRoutes);
  app.use('/api/scripts', scriptRoutes);
  app.use('/api/reference-voice', referenceVoiceRoutes);
  app.use('/api/narration', narrationRoutes);
  app.use('/api/assets', assetRoutes);
  app.use('/api/video-projects', videoProjectRoutes);
  app.use('/api/render', renderRoutes);

  // Health route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite development middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = config.port || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Webtoon & Video Studio Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
