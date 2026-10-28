// HELIX AI Provider Factory
// Instantiates and manages unified AI provider adapters with centralized routing.
// Includes automated failover to on-device Qwen (Ollama) if cloud providers disconnect or go offline.

import { AiProvider, AiProviderType, AiGenerationOptions, AiGenerationResult } from './types.js';
import { getAiConfig } from './config.js';
import { GeminiAdapter } from './adapters/geminiAdapter.js';
import { GroqAdapter } from './adapters/groqAdapter.js';
import { OllamaAdapter } from './adapters/ollamaAdapter.js';

class ProviderFactory {
  private instances = new Map<AiProviderType, AiProvider>();

  public getProvider(overrideType?: AiProviderType): AiProvider {
    const config = getAiConfig();
    const type = overrideType || config.provider;

    const existing = this.instances.get(type);
    if (existing) {
      return existing;
    }

    let adapter: AiProvider;
    switch (type) {
      case 'gemini':
        adapter = new GeminiAdapter(config.gemini.apiKey, config.gemini.model);
        break;
      case 'groq':
        adapter = new GroqAdapter(config.groq.apiKey, config.groq.model);
        break;
      case 'ollama':
        adapter = new OllamaAdapter(config.ollama.baseUrl, config.ollama.model);
        break;
      default:
        throw new Error(`Unsupported AI provider type: "${type}"`);
    }

    this.instances.set(type, adapter);
    return adapter;
  }

  /**
   * Executes prompt generation with the active provider.
   * If a cloud provider (gemini/groq) encounters network loss, timeouts, or fails,
   * it automatically fails over to local Qwen (Ollama) so student workflows never halt.
   */
  public async generateWithFallback(
    prompt: string,
    options?: AiGenerationOptions,
    overrideType?: AiProviderType
  ): Promise<AiGenerationResult & { switchedToQwenOffline?: boolean }> {
    const config = getAiConfig();
    const primaryType = overrideType || config.provider;

    try {
      const primaryProvider = this.getProvider(primaryType);
      return await primaryProvider.generateText(prompt, options);
    } catch (primaryErr: any) {
      if (primaryType !== 'ollama') {
        console.warn(`[HELIX Gateway] Provider "${primaryType}" unavailable/offline: ${primaryErr.message}. Auto-failing over to local Qwen 2.5 Coder (Ollama)...`);
        try {
          const ollamaProvider = this.getProvider('ollama');
          const ollamaResult = await ollamaProvider.generateText(prompt, options);
          return {
            ...ollamaResult,
            switchedToQwenOffline: true,
          };
        } catch (ollamaErr: any) {
          console.error(`[HELIX Gateway] Both "${primaryType}" and local Ollama failover failed:`, ollamaErr.message);
          throw primaryErr;
        }
      }
      throw primaryErr;
    }
  }

  public reset() {
    this.instances.clear();
  }
}

export const aiProviderFactory = new ProviderFactory();

export function getAiProvider(type?: AiProviderType): AiProvider {
  return aiProviderFactory.getProvider(type);
}

export async function generateWithAiFallback(
  prompt: string,
  options?: AiGenerationOptions,
  type?: AiProviderType
) {
  return aiProviderFactory.generateWithFallback(prompt, options, type);
}
