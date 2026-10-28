// HELIX Google Gemini Provider Adapter
// Securely encapsulates Google Generative AI API calls on the backend.

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AiProvider,
  AiProviderType,
  AiChatMessage,
  AiGenerateOptions,
  AiGenerateResult,
  AiDiagnosticResult,
} from '../types.js';

export class GeminiAdapter implements AiProvider {
  public readonly providerType: AiProviderType = 'gemini';
  public readonly model: string;
  private readonly apiKey?: string;
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string, model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    if (this.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
      } catch (err) {
        console.warn('[GeminiAdapter] Client init warning:', err);
      }
    }
  }

  public async generateText(prompt: string, options?: AiGenerateOptions): Promise<AiGenerateResult> {
    return this.generateChat([{ role: 'user', content: prompt }], options);
  }

  public async generateChat(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult> {
    if (!this.apiKey || !this.client) {
      throw new Error('Gemini API key is not configured on the server (GEMINI_API_KEY is missing).');
    }

    const startTime = Date.now();
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const userPrompt = messages
      .filter(m => m.role !== 'system')
      .map(m => (m.role === 'assistant' ? `Assistant: ${m.content}` : m.content))
      .join('\n\n');

    const promptWithSystem = systemMessage
      ? `${systemMessage}\n\nTask:\n${userPrompt}`
      : userPrompt;

    let responseText = '';
    let usedModel = this.model;

    try {
      const modelInstance = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens,
          responseMimeType: options?.responseFormat === 'json' ? 'application/json' : undefined,
        },
      });

      const result = await modelInstance.generateContent(promptWithSystem);
      responseText = result.response.text();
    } catch (primaryErr: any) {
      // Fallback model support (e.g. 1.5-pro if 1.5-flash encounters an issue)
      if (this.model !== 'gemini-1.5-pro') {
        try {
          usedModel = 'gemini-1.5-pro';
          const fallbackInstance = this.client.getGenerativeModel({
            model: usedModel,
            generationConfig: {
              temperature: options?.temperature ?? 0.2,
              maxOutputTokens: options?.maxTokens,
            },
          });
          const result = await fallbackInstance.generateContent(promptWithSystem);
          responseText = result.response.text();
        } catch {
          throw new Error(`Gemini generation error: ${primaryErr?.message || 'API request failed'}`);
        }
      } else {
        throw new Error(`Gemini generation error: ${primaryErr?.message || 'API request failed'}`);
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      text: responseText,
      provider: this.providerType,
      model: usedModel,
      durationMs,
    };
  }

  public async testConnection(): Promise<AiDiagnosticResult> {
    const startTime = Date.now();
    try {
      if (!this.apiKey) {
        return {
          provider: this.providerType,
          model: this.model,
          success: false,
          latencyMs: 0,
          error: 'GEMINI_API_KEY environment variable is not configured.',
          timestamp: new Date().toISOString(),
        };
      }

      const res = await this.generateText('Respond with valid JSON: {"ping": "pong"}', {
        responseFormat: 'json',
      });

      return {
        provider: this.providerType,
        model: res.model,
        success: true,
        latencyMs: res.durationMs,
        sampleResponse: res.text.slice(0, 150),
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        provider: this.providerType,
        model: this.model,
        success: false,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Gemini connectivity test failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
