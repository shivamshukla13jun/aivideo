import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aivideo',
  suwayomiUrl: process.env.SUWAYOMI_URL || 'http://127.0.0.1:4567',
  storageDir: path.resolve(__dirname, '../../storage'),
  uploadsDir: path.resolve(__dirname, '../../storage/uploads'),
  videosDir: path.resolve(__dirname, '../../storage/videos'),
};
