import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import videoRoutes from './routes/videoRoutes';

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-key'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file storage for uploads and videos
app.use('/storage/uploads', express.static(config.uploadsDir));
app.use('/storage/videos', express.static(config.videosDir));

// API Routes
app.use('/api/video', videoRoutes);

// General Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gemini-video-backend', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(config.port, () => {
  console.log(`=================================================`);
  console.log(`🎬 Gemini AI Slideshow Video Backend`);
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📂 Storage uploads: ${config.uploadsDir}`);
  console.log(`📂 Storage videos:  ${config.videosDir}`);
  console.log(`🔑 Gemini Key status: ${config.geminiApiKey ? 'Configured ✅' : 'Not set (pass in UI) ⚠️'}`);
  console.log(`=================================================`);
});

export default app;
