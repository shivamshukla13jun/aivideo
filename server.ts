import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api.js';
import { swaggerRouter } from './server/routes/swagger.js';
import { initMongoDB } from './server/db/connection.js';
import { initStore } from './server/db/store.js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '7000', 10);

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Initialize MongoDB connection & store
  try {
    await initMongoDB();
    await initStore();
  } catch (err: any) {
    console.error('[Suwayomi Server] Startup DB initialization warning:', err.message);
  }



  // API Routes
  app.use('/api/v1/docs', swaggerRouter);
  app.use('/api/docs', swaggerRouter);
  app.use('/swagger', swaggerRouter);
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'suwayomi-server-typescript' });
  });

  // 404 for unhandled API routes so they return JSON rather than SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const htmlPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(htmlPath)) {
          let template = fs.readFileSync(htmlPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Suwayomi Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
