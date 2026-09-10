import express from 'express';
import cors from 'cors';
import path from 'path';
import { setGlobalDispatcher, Agent } from 'undici';
import { config } from './config';
import { connectDB } from './db/connection';
import videoRoutes from './routes/videoRoutes';

// Configure UNLIMITED timeouts for multimodal image uploads and Gemini AI API
setGlobalDispatcher(
  new Agent({
    headersTimeout: 0, // 0 = unlimited timeout (no headers timeout)
    bodyTimeout: 0,    // 0 = unlimited timeout (no body timeout)
    connectTimeout: 0, // 0 = unlimited connect timeout
    keepAliveTimeout: 600000,
    keepAliveMaxTimeout: 3600000,
  })
);

import http from 'http';
import { initSocket } from './socket';

const app = express();
const httpServer = http.createServer(app);

// Configure unlimited timeout on HTTP Server
httpServer.setTimeout(0);
httpServer.keepAliveTimeout = 0;

// Initialize Socket.IO for real-time progress updates
initSocket(httpServer);

// Unlimited timeout middleware for all Express API requests
app.use((req, res, next) => {
  req.setTimeout(0);
  res.setTimeout(0);
  if (req.socket) {
    req.socket.setTimeout(0);
    req.socket.setKeepAlive(true);
  }
  next();
});

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

// Start Server with Socket.IO
httpServer.listen(config.port, async () => {
  console.log(`=================================================`);
  console.log(`🎬 Gemini AI Slideshow Video Backend`);
  console.log(`🚀 Server running on http://localhost:${config.port}`);
  console.log(`📂 Storage uploads: ${config.uploadsDir}`);
  console.log(`📂 Storage videos:  ${config.videosDir}`);
  console.log(`🔑 Gemini Key status: ${config.geminiApiKey ? 'Configured ✅' : 'Not set (pass in UI) ⚠️'}`);
  await connectDB();
  console.log(`=================================================`);
});

export default app;
