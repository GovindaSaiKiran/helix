// HELIX Ollama Local Inference Provider Adapter
// High-performance open-weight model integration for local student privacy and zero API fee operation.

import {
  AiProvider,
  AiProviderType,
  AiChatMessage,
  AiGenerateOptions,
  AiGenerateResult,
  AiDiagnosticResult,
} from '../types.js';

export class OllamaAdapter implements AiProvider {
  public readonly providerType: AiProviderType = 'ollama';
  public readonly model: string;
  public readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'qwen2.5-coder:3b') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  public async generateText(prompt: string, options?: AiGenerateOptions): Promise<AiGenerateResult> {
    return this.generateChat([{ role: 'user', content: prompt }], options);
  }

  public async generateChat(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? 60000; // Local models may take longer on modest hardware

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const payload = {
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      format: options?.responseFormat === 'json' ? 'json' : undefined,
      options: {
        temperature: options?.temperature ?? 0.2,
      },
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutHandle);
      if (fetchErr.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(
          `Ollama generation timed out after ${timeoutMs}ms. For large local models, please check hardware load or increase timeout.`
        );
      }
      throw new Error(
        `Unable to reach local Ollama daemon at ${this.baseUrl}. Please ensure Ollama is running (e.g. check Windows taskbar or run 'ollama serve').`
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

    // Validate HTTP status
    if (!res.ok) {
      let errorBody = '';
      try {
        const errJson = await res.json();
        errorBody = errJson.error || JSON.stringify(errJson);
      } catch {
        errorBody = await res.text().catch(() => '');
      }

      if (res.status === 404) {
        throw new Error(
          `Ollama model "${this.model}" is not installed. Please run "ollama run ${this.model}" in your terminal to download and install it.`
        );
      }

      throw new Error(`Ollama HTTP Error (${res.status}): ${errorBody || 'Server error'}`);
    }

    // Validate Response Shape
    let data: any;
    try {
      data = await res.json();
    } catch (parseErr: any) {
      throw new Error(`Invalid JSON response from Ollama daemon: ${parseErr.message}`);
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Malformed response from Ollama: expected an object.');
    }

    const content = data.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Ollama response missing message.content string.');
    }

    const durationMs = Date.now() - startTime;
    return {
      text: content,
      provider: this.providerType,
      model: this.model,
      durationMs,
      usage: {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  public async testConnection(): Promise<AiDiagnosticResult> {
    const startTime = Date.now();
    try {
      // 1. Verify Ollama HTTP API connectivity & installed models
      const tagsRes = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      }).catch(err => {
        throw new Error(
          `Cannot reach Ollama at ${this.baseUrl}: ${err.message}. Ensure Ollama is running.`
        );
      });

      if (!tagsRes.ok) {
        throw new Error(`Ollama health check returned HTTP ${tagsRes.status}`);
      }

      const tagsData: any = await tagsRes.json();
      const availableModels: string[] = (tagsData.models || []).map((m: any) => m.name || m.model);

      const hasModel = availableModels.some(m =>
        m === this.model || m.startsWith(`${this.model}:`) || this.model.startsWith(`${m}:`)
      );

      if (!hasModel && availableModels.length > 0) {
        return {
          provider: this.providerType,
          model: this.model,
          success: false,
          latencyMs: Date.now() - startTime,
          error: `Ollama is running, but configured model "${this.model}" is not installed. Installed models: [${availableModels.join(', ')}]. Run "ollama run ${this.model}".`,
          timestamp: new Date().toISOString(),
        };
      }

      // 2. Perform live inference test with strict JSON format
      const res = await this.generateText('Respond with valid JSON: {"status": "ok", "ping": "pong"}', {
        responseFormat: 'json',
        timeoutMs: 45000,
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
        error: err.message || 'Ollama connection test failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
