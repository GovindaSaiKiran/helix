// HELIX Safe AI Diagnostic Runner
// Tests model inference live without exposing private keys or environment secrets.

import { AiProviderType, AiDiagnosticResult } from './types.js';
import { getAiConfig, getSanitizedAiConfig } from './config.js';
import { getAiProvider } from './providerFactory.js';

export async function runAiDiagnostic(targetProvider?: AiProviderType): Promise<AiDiagnosticResult> {
  const config = getAiConfig();
  const providerType = targetProvider || config.provider;

  try {
    const provider = getAiProvider(providerType);
    return await provider.testConnection();
  } catch (err: any) {
    const activeModel =
      providerType === 'gemini'
        ? config.gemini.model
        : providerType === 'groq'
        ? config.groq.model
        : config.ollama.model;

    return {
      provider: providerType,
      model: activeModel,
      success: false,
      latencyMs: 0,
      error: err.message || 'Diagnostic initialization error',
      timestamp: new Date().toISOString(),
    };
  }
}

export function getSafeDiagnosticSummary() {
  return getSanitizedAiConfig();
}
