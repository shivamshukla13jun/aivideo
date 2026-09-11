import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });


export const config = {
  get port(): number {
    return parseInt(process.env.PORT || '5000', 10);
  },
  get clientUrl(): string {
    return  process.env.CLIENT_URL || 'http://localhost:5173';
  },
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  },
  get mongoUri(): string {
    return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aivideo';
  },
  get suwayomiUrl(): string {
    return process.env.SUWAYOMI_URL as string;
  },
  get aiProvider(): string {
    return process.env.AI_PROVIDER || 'gemini'
  },
  get ollamaBaseUrl(): string {
    return  process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  },
  get ollamaModel(): string {
    return  process.env.OLLAMA_MODEL || 'llama3';
  },
  get ollamaVisionModel(): string {
    return process.env.OLLAMA_VISION_MODEL || 'llava';
  },
  get elevenLabsApiKey(): string {
    return process.env.ELEVENLABS_API_KEY || ''
  },
  storageDir: path.resolve(__dirname, '../../storage'),
  uploadsDir: path.resolve(__dirname, '../../storage/uploads'),
  videosDir: path.resolve(__dirname, '../../storage/videos'),
};
