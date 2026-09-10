import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const isProduction = process.env.NODE_ENV === 'production';
export const isAllInOne = process.env.IS_ALL_IN_ONE === 'true';

export const config = {
  isProduction,
  isAllInOne,
  environment: isProduction ? 'production' : 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || (isProduction ? '' : 'http://localhost:5173'),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  mongoUri:
    process.env.MONGODB_URI ||
    (isProduction && !isAllInOne
      ? 'mongodb://mongodb:27017/aivideo'
      : 'mongodb://127.0.0.1:27017/aivideo'),
  suwayomiUrl:
    process.env.SUWAYOMI_URL ||
    (isProduction && !isAllInOne
      ? 'http://suwayomi:4567'
      : 'http://127.0.0.1:4567'),
  storageDir: path.resolve(__dirname, '../../storage'),
  uploadsDir: path.resolve(__dirname, '../../storage/uploads'),
  videosDir: path.resolve(__dirname, '../../storage/videos'),
};

