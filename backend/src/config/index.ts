import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  storageDir: path.resolve(__dirname, '../../storage'),
  uploadsDir: path.resolve(__dirname, '../../storage/uploads'),
  videosDir: path.resolve(__dirname, '../../storage/videos'),
};
