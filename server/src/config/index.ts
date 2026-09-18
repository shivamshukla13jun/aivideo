import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/webtoon_studio',
  jwtSecret: process.env.JWT_SECRET || 'webtoon-studio-jwt-secret-key-2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'webtoon-studio-refresh-secret-key-2026',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'demo_cloud',
    apiKey: process.env.CLOUDINARY_API_KEY || 'demo_key',
    apiSecret: process.env.CLOUDINARY_API_SECRET || 'demo_secret',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  ttsProviderKey: process.env.TTS_PROVIDER_API_KEY || process.env.GEMINI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  uploadConcurrency: parseInt(process.env.UPLOAD_CONCURRENCY || '4', 10),
};
