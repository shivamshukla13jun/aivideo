import path from 'path';
import dotenv from 'dotenv';

dotenv.config();


function getEnvUrl(devKey: string, prodKey: string, fallbackKey?: string, defaultVal = ''): string {
  const isProd = (process.env.NODE_ENV || 'production').toLowerCase() === 'production';
  if (isProd) {
    return (
      process.env[prodKey] ||
      (fallbackKey ? process.env[fallbackKey] : undefined) ||
      process.env[devKey] ||
      defaultVal
    );
  }
  return (
    process.env[devKey] ||
    (fallbackKey ? process.env[fallbackKey] : undefined) ||
    process.env[prodKey] ||
    defaultVal
  );
}

export const config = {
  get nodeEnv(): string {
    return (process.env.NODE_ENV || 'production').toLowerCase();
  },
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
  get isDevelopment(): boolean {
    return !this.isProduction;
  },
  get port(): number {
    return parseInt(process.env.PORT || '5000', 10);
  },
  get clientUrl(): string {
    return getEnvUrl(
      'DEVELOPMENT_CLIENT_URL',
      'PRODUCTION_CLIENT_URL',
      'CLIENT_URL',
      this.isProduction ? 'http://localhost:5000' : 'http://localhost:5173'
    );
  },
  get serverUrl(): string {
    return getEnvUrl(
      'DEVELOPMENT_SERVER_URL',
      'PRODUCTION_SERVER_URL',
      'SERVER_URL',
      `http://localhost:${this.port}`
    );
  },
  get apiUrl(): string {
    return getEnvUrl(
      'DEVELOPMENT_API_URL',
      'PRODUCTION_API_URL',
      'API_URL',
      `${this.serverUrl}/api`
    );
  },
  get suwayomiUrl(): string {
    return getEnvUrl(
      'DEVELOPMENT_SUWAYOMI_URL',
      'PRODUCTION_SUWAYOMI_URL',
      'SUWAYOMI_URL',
      this.isProduction ? '' : 'http://127.0.0.1:4567'
    );
  },
  get ollamaBaseUrl(): string {
    return getEnvUrl(
      'DEVELOPMENT_OLLAMA_BASE_URL',
      'PRODUCTION_OLLAMA_BASE_URL',
      'OLLAMA_BASE_URL',
      this.isProduction ? 'http://ollama:11434' : 'http://127.0.0.1:11434'
    );
  },
  get urls() {
    return {
      clientUrl: this.clientUrl,
      serverUrl: this.serverUrl,
      apiUrl: this.apiUrl,
      suwayomiUrl: this.suwayomiUrl,
      ollamaBaseUrl: this.ollamaBaseUrl,
    };
  },
  get environmentUrls() {
    return {
      development: {
        clientUrl: process.env.DEVELOPMENT_CLIENT_URL || 'http://localhost:5173',
        serverUrl: process.env.DEVELOPMENT_SERVER_URL || `http://localhost:${this.port}`,
        apiUrl: process.env.DEVELOPMENT_API_URL || `http://localhost:${this.port}/api`,
        suwayomiUrl: process.env.DEVELOPMENT_SUWAYOMI_URL || 'http://127.0.0.1:4567',
        ollamaBaseUrl: process.env.DEVELOPMENT_OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      },
      production: {
        clientUrl: process.env.PRODUCTION_CLIENT_URL || '',
        serverUrl: process.env.PRODUCTION_SERVER_URL || '',
        apiUrl: process.env.PRODUCTION_API_URL || '',
        suwayomiUrl: process.env.PRODUCTION_SUWAYOMI_URL || '',
        ollamaBaseUrl: process.env.PRODUCTION_OLLAMA_BASE_URL || 'http://ollama:11434',
      },
    };
  },
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  },
  get mongoUri(): string {
    return (
      (this.isProduction ? process.env.PRODUCTION_MONGODB_URI : process.env.DEVELOPMENT_MONGODB_URI) ||
      process.env.MONGODB_URI ||
      'mongodb://127.0.0.1:27017/aivideo'
    );
  },
  get aiProvider(): string {
    return process.env.AI_PROVIDER || 'gemini';
  },
  get ollamaModel(): string {
    return process.env.OLLAMA_MODEL || 'llama3';
  },
  get ollamaVisionModel(): string {
    return process.env.OLLAMA_VISION_MODEL || 'llava';
  },
  get elevenLabsApiKey(): string {
    return process.env.ELEVENLABS_API_KEY || '';
  },
  storageDir: path.resolve(__dirname, '../../storage'),
  uploadsDir: path.resolve(__dirname, '../../storage/uploads'),
  videosDir: path.resolve(__dirname, '../../storage/videos'),
};
