// HELIX Groq Provider Adapter
// Integrates official Groq SDK for ultra-fast open-weight and frontier inference.

import Groq from 'groq-sdk';
import {
  AiProvider,
  AiProviderType,
  AiChatMessage,
  AiGenerateOptions,
  AiGenerateResult,
  AiDiagnosticResult,
} from '../types.js';

export class GroqAdapter implements AiProvider {
  public readonly providerType: AiProviderType = 'groq';
  public readonly model: string;
  private readonly apiKey?: string;
  private client: Groq | null = null;

  constructor(apiKey?: string, model: string = 'openai/gpt-oss-120b') {
    this.apiKey = apiKey;
    this.model = model;
    if (this.apiKey) {
      try {
        this.client = new Groq({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('[GroqAdapter] Groq SDK init warning:', err);
      }
    }
  }

  public async generateText(prompt: string, options?: AiGenerateOptions): Promise<AiGenerateResult> {
    return this.generateChat([{ role: 'user', content: prompt }], options);
  }

  public async generateChat(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult> {
    if (!this.apiKey || !this.client) {
      throw new Error('Groq API key is not configured on the server (GROQ_API_KEY is missing).');
    }

    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? 30000;

    const groqMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const completionPromise = this.client.chat.completions.create({
        model: this.model,
        messages: groqMessages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens,
        response_format: options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      });

      // Wrap with timeout safeguard
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Groq request timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const completion = await Promise.race([completionPromise, timeoutPromise]);
      const text = completion.choices?.[0]?.message?.content || '';
      const durationMs = Date.now() - startTime;

      return {
        text,
        provider: this.providerType,
        model: this.model,
        durationMs,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (err: any) {
      const sanitized = err.message || 'Groq request failed';
      throw new Error(`Groq API Error (${this.model}): ${sanitized}`);
    }
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
          error: 'GROQ_API_KEY environment variable is not configured.',
          timestamp: new Date().toISOString(),
        };
      }

      const res = await this.generateText('Respond with valid JSON: {"ping": "pong"}', {
        responseFormat: 'json',
        timeoutMs: 15000,
      });

      return {
        provider: this.providerType,
        model: this.model,
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
        error: err.message || 'Groq connectivity test failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
