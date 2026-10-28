// HELIX Centralized AI Configuration
// Keeps provider selection, model names, and timeouts in one place.
// Defaults always to open-weight Qwen (Ollama) with automatic cloud fallback.

import { AiProviderType } from './types.js';

export interface AiConfig {
  provider: AiProviderType;
  gemini: {
    apiKey?: string;
    model: string;
  };
  groq: {
    apiKey?: string;
    model: string;
  };
  ollama: {
    baseUrl: string;
    model: string;
  };
  timeoutMs: number;
}

let activeRuntimeProvider: AiProviderType | null = null;

export function setActiveProvider(provider: AiProviderType | null) {
  if (provider === null || provider === 'gemini' || provider === 'groq' || provider === 'ollama') {
    activeRuntimeProvider = provider;
  }
}

export function getActiveProvider(): AiProviderType {
  if (activeRuntimeProvider) {
    return activeRuntimeProvider;
  }
  const envProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (envProvider === 'gemini' || envProvider === 'groq' || envProvider === 'ollama') {
    return envProvider as AiProviderType;
  }
  // Default is always Qwen (Ollama local inference)
  return 'ollama';
}

export function getAiConfig(): AiConfig {
  const selectedProvider = getActiveProvider();

  // Model names
  const rawGeminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const geminiModel = rawGeminiModel.toLowerCase().includes('gemini')
    ? rawGeminiModel.trim().toLowerCase().replace(/\s+/g, '-')
    : 'gemini-1.5-flash';

  const groqModel = (process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim();
  const ollamaModel = (process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b').trim();
  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');

  const timeoutMs = process.env.AI_TIMEOUT_MS ? Math.max(5000, parseInt(process.env.AI_TIMEOUT_MS, 10)) : 45000;

  return {
    provider: selectedProvider,
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: geminiModel,
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      model: groqModel,
    },
    ollama: {
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
    },
    timeoutMs,
  };
}

/**
 * Returns a sanitized, safe view of configuration for health and UI diagnostics.
 * Never exposes raw API keys, infrastructure secrets, or credentials.
 */
export function getSanitizedAiConfig() {
  const config = getAiConfig();
  return {
    activeProvider: config.provider,
    activeModel:
      config.provider === 'gemini'
        ? config.gemini.model
        : config.provider === 'groq'
        ? config.groq.model
        : config.ollama.model,
    isDefaultQwen: config.provider === 'ollama',
    autoOfflineFailover: true,
    providers: {
      gemini: {
        configured: Boolean(config.gemini.apiKey),
        model: config.gemini.model,
      },
      groq: {
        configured: Boolean(config.groq.apiKey),
        model: config.groq.model,
      },
      ollama: {
        configured: true,
        baseUrl: config.ollama.baseUrl,
        model: config.ollama.model,
      },
    },
    timeoutMs: config.timeoutMs,
  };
}
