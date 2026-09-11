import { config } from '../config';
import {
  geminiService,
  AISlideshowResult,
  GenerateSlideshowOptions,
  AnalyzeImagesOptions,
} from './geminiService';
import { ollamaService } from './ollamaService';

export type AIProvider = 'gemini' | 'ollama';

export class AIProviderService {
  /**
   * Returns the current active AI provider ('gemini' or 'ollama') strictly configured in .env.
   */
  getActiveProvider(): AIProvider {
    const envProvider = (config.aiProvider || 'gemini').trim().toLowerCase();
    if (envProvider === 'ollama') {
      return 'ollama';
    }
    return 'gemini';
  }

  /**
   * Generates slideshow storyboard using the active AI provider strictly from .env.
   */
  async generateSlideshow(
    options: GenerateSlideshowOptions
  ): Promise<AISlideshowResult> {
    const provider = this.getActiveProvider();

    if (provider === 'ollama') {
      return await ollamaService.generateSlideshow(options);
    }

    return await geminiService.generateSlideshow({
      ...options,
      apiKey: config.geminiApiKey,
    });
  }

  /**
   * Analyzes uploaded slide images or manga chapter panels using the active AI provider strictly from .env.
   */
  async analyzeImagesForSlideshow(
    options: AnalyzeImagesOptions
  ): Promise<AISlideshowResult> {
    const provider = this.getActiveProvider();

    if (provider === 'ollama') {
      return await ollamaService.analyzeImagesForSlideshow(options);
    }

    return await geminiService.analyzeImagesForSlideshow({
      ...options,
      apiKey: config.geminiApiKey,
    });
  }

  /**
   * Check status of both providers strictly based on server environment (.env)
   */
  async getStatus() {
    const activeProvider = this.getActiveProvider();
    const ollamaStatus = await ollamaService.checkConnection();

    const hasGeminiKey = Boolean(
      config.geminiApiKey &&
        !config.geminiApiKey.startsWith('AQ.') &&
        config.geminiApiKey.length > 10
    );

    return {
      activeProvider,
      configuredInEnv: config.aiProvider,
      gemini: {
        configured: hasGeminiKey,
        defaultModel: 'gemini-3.6-flash',
      },
      ollama: {
        connected: ollamaStatus.connected,
        baseUrl: config.ollamaBaseUrl,
        models: ollamaStatus.models,
        defaultModel: config.ollamaModel,
        visionModel: config.ollamaVisionModel,
        version: ollamaStatus.version,
        error: ollamaStatus.error,
      },
    };
  }
}

export const aiProviderService = new AIProviderService();
