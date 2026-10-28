// HELIX AI Provider & Deterministic Scheduler Automated Test Suite
// Verifies provider selection, Ollama parsing/timeouts, schema validation, and scheduler invariants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiAdapter } from '../server/ai/adapters/geminiAdapter.js';
import { GroqAdapter } from '../server/ai/adapters/groqAdapter.js';
import { OllamaAdapter } from '../server/ai/adapters/ollamaAdapter.js';
import { getAiProvider, aiProviderFactory, generateWithAiFallback } from '../server/ai/providerFactory.js';
import { getAiConfig, getSanitizedAiConfig, setActiveProvider } from '../server/ai/config.js';
import {
  extractAndParseJson,
  validateSyllabusExtraction,
  validateTopicContent,
  validateQuizGeneration,
  validateReplanExplanation,
  SchemaValidationError,
} from '../server/ai/validator.js';
import { DeterministicPlanner } from '../server/planner/deterministicPlanner.js';

describe('1. Centralized Provider Selection & Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    setActiveProvider(null);
    aiProviderFactory.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setActiveProvider(null);
    aiProviderFactory.reset();
  });

  it('defaults to Ollama Qwen when AI_PROVIDER is unset', () => {
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    const config = getAiConfig();
    expect(config.provider).toBe('ollama');
    expect(config.ollama.model).toBe('qwen2.5-coder:3b');
  });

  it('supports runtime provider switching via setActiveProvider', () => {
    setActiveProvider('groq');
    expect(getAiConfig().provider).toBe('groq');

    setActiveProvider('ollama');
    expect(getAiConfig().provider).toBe('ollama');
  });

  it('selects Gemini when AI_PROVIDER=gemini', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const config = getAiConfig();
    expect(config.provider).toBe('gemini');

    const provider = getAiProvider('gemini');
    expect(provider.providerType).toBe('gemini');
  });

  it('selects Groq when AI_PROVIDER=groq', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk_test_key';
    const config = getAiConfig();
    expect(config.provider).toBe('groq');

    const provider = getAiProvider('groq');
    expect(provider.providerType).toBe('groq');
  });

  it('selects Ollama when AI_PROVIDER=ollama', () => {
    process.env.AI_PROVIDER = 'ollama';
    const config = getAiConfig();
    expect(config.provider).toBe('ollama');

    const provider = getAiProvider('ollama');
    expect(provider.providerType).toBe('ollama');
    expect(provider.model).toBe('qwen2.5-coder:3b');
  });

  it('sanitizes config and never exposes raw API keys', () => {
    process.env.GEMINI_API_KEY = 'super_secret_gemini';
    process.env.GROQ_API_KEY = 'super_secret_groq';
    const sanitized = getSanitizedAiConfig();

    const jsonString = JSON.stringify(sanitized);
    expect(jsonString).not.toContain('super_secret_gemini');
    expect(jsonString).not.toContain('super_secret_groq');
    expect(sanitized.providers.gemini.configured).toBe(true);
    expect(sanitized.providers.groq.configured).toBe(true);
    expect(sanitized.providers.ollama.configured).toBe(true);
  });
});

describe('2. Missing API Keys Enforcement', () => {
  it('GeminiAdapter throws clear error when GEMINI_API_KEY is absent', async () => {
    const adapter = new GeminiAdapter(undefined, 'gemini-1.5-flash');
    await expect(adapter.generateText('hello')).rejects.toThrow(
      /Gemini API key is not configured on the server/
    );
  });

  it('GroqAdapter throws clear error when GROQ_API_KEY is absent', async () => {
    const adapter = new GroqAdapter(undefined, 'openai/gpt-oss-120b');
    await expect(adapter.generateText('hello')).rejects.toThrow(
      /Groq API key is not configured on the server/
    );
  });
});

describe('3. Ollama Adapter: Live Protocol, Parsing & Error Handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully parses non-streaming Ollama chat response', async () => {
    const mockOllamaResponse = {
      model: 'qwen2.5-coder:3b',
      message: {
        role: 'assistant',
        content: '{"status": "ok", "lesson": "Distributed Transactions"}',
      },
      done: true,
      prompt_eval_count: 24,
      eval_count: 18,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOllamaResponse,
    } as any);

    const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5-coder:3b');
    const result = await adapter.generateText('Explain 2PC in JSON', { responseFormat: 'json' });

    expect(result.text).toBe('{"status": "ok", "lesson": "Distributed Transactions"}');
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('qwen2.5-coder:3b');
    expect(result.usage?.totalTokens).toBe(42);
  });

  it('handles Ollama connection refusal gracefully without leaking internal secrets', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434'));

    const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5-coder:3b');
    await expect(adapter.generateText('test')).rejects.toThrow(
      /Unable to reach local Ollama daemon at http:\/\/localhost:11434/
    );
  });

  it('handles Ollama request timeout correctly', async () => {
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    const adapter = new OllamaAdapter('http://localhost:11434', 'qwen2.5-coder:3b');
    await expect(adapter.generateText('slow prompt', { timeoutMs: 50 })).rejects.toThrow(
      /Ollama generation timed out/
    );
  });

  it('handles 404 model not found status with actionable instruction', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "model 'unknown-model' not found" }),
    } as any);

    const adapter = new OllamaAdapter('http://localhost:11434', 'unknown-model');
    await expect(adapter.generateText('test')).rejects.toThrow(
      /Ollama model "unknown-model" is not installed/
    );
  });
});

describe('4. Strict Schema Validation & Malformed JSON Handling', () => {
  it('extracts JSON surrounded by markdown fences and preamble text', () => {
    const raw = `Here is your extracted curriculum:\n\`\`\`json\n{\n  "subject": "DBMS",\n  "units": [\n    {\n      "unitNumber": 1,\n      "title": "Unit 1",\n      "topics": [{ "title": "Indexing", "estimatedMinutes": 45 }]\n    }\n  ]\n}\n\`\`\`\nHope this helps!`;
    const parsed = extractAndParseJson(raw);
    expect(parsed.subject).toBe('DBMS');
    expect(parsed.units.length).toBe(1);
  });

  it('throws SchemaValidationError on totally malformed or non-JSON output', () => {
    expect(() => extractAndParseJson('Plain conversational text without any JSON structure.')).toThrow(
      SchemaValidationError
    );
  });

  it('validates Syllabus Extraction schema and enforces non-empty units and topics', () => {
    const valid = {
      subject: 'Operating Systems',
      units: [
        {
          unitNumber: 1,
          title: 'Memory Management',
          topics: [
            { title: 'Virtual Memory & Paging', estimatedMinutes: 60 },
          ],
        },
      ],
    };
    const validated = validateSyllabusExtraction(valid, 'OS');
    expect(validated.subject).toBe('Operating Systems');
    expect(validated.units[0].topics[0].title).toBe('Virtual Memory & Paging');

    // Missing topics throws error
    const invalid = { subject: 'OS', units: [{ unitNumber: 1, title: 'No topics', topics: [] }] };
    expect(() => validateSyllabusExtraction(invalid, 'OS')).toThrow(SchemaValidationError);
  });

  it('validates Topic Content schema and catches missing explanations or key points', () => {
    const valid = {
      topicTitle: 'B-Trees',
      keyPoints: ['Self-balancing search tree', 'Minimizes disk I/O operations'],
      simplifiedExplanation: 'Like a multi-level table of contents in a textbook.',
      fullExplanation: 'Formal tree invariants where each internal node has at most m children.',
      examples: ['Database index lookup for user ID 4501.'],
      examTips: ['Remember root can have fewer children than internal nodes.'],
    };
    const validated = validateTopicContent(valid, 'B-Trees');
    expect(validated.keyPoints.length).toBe(2);
    expect(validated.examples[0]).toContain('Database index lookup');

    // Empty key points throws error
    expect(() => validateTopicContent({ topicTitle: 'X', keyPoints: [] })).toThrow(SchemaValidationError);
  });

  it('validates Quiz Generation schema and ensures at least 2 options and correct answer index bounds', () => {
    const valid = {
      topicTitle: 'Sorting',
      questions: [
        {
          id: 'q1',
          question: 'What is the average time complexity of QuickSort?',
          options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(1)'],
          correctOptionIndex: 0,
          explanation: 'Partitioning divides array into two subproblems in O(n) yielding O(n log n) expected time.',
        },
      ],
    };
    const validated = validateQuizGeneration(valid, 'Sorting');
    expect(validated.questions[0].options.length).toBe(4);
    expect(validated.questions[0].correctOptionIndex).toBe(0);

    // Question with fewer than 2 options throws error
    const invalid = {
      topicTitle: 'Sorting',
      questions: [{ id: 'q1', question: 'Invalid?', options: ['One option only'] }],
    };
    expect(() => validateQuizGeneration(invalid)).toThrow(SchemaValidationError);
  });
});

describe('5. Deterministic Scheduler Invariants (AI proposes, Deterministic logic validates)', () => {
  it('strictly computes plan health using mathematical capacity ratio', () => {
    // 10 planned hours out of 12 available hours -> healthy (ratio ~0.83)
    const healthy = DeterministicPlanner.calculateHealth(12, 10, 0);
    expect(healthy.status).toBe('healthy');
    expect(healthy.bufferHours).toBe(2);
    expect(healthy.conflictCount).toBe(0);

    // 15 planned hours out of 12 available hours -> overloaded
    const overloaded = DeterministicPlanner.calculateHealth(12, 15, 0);
    expect(overloaded.status).toBe('overloaded');
    expect(overloaded.score).toBe(63);

    // Conflict count overrides ratio into overloaded
    const conflict = DeterministicPlanner.calculateHealth(12, 6, 2);
    expect(conflict.status).toBe('overloaded');
    expect(conflict.conflictCount).toBe(2);
  });

  it('generates replanning proposal deterministically allocating urgent event while protecting capacity', () => {
    const proposal = DeterministicPlanner.generateReplanningProposal({
      event: {
        id: 'evt_urgent_midterm',
        title: 'Midterm Exam Preparation',
        type: 'exam_announced',
        urgency: 'urgent',
        remainingEffortHours: 3,
      },
      currentSchedule: [
        {
          id: 's1',
          timeSlot: '5:00 PM - 6:00 PM',
          startTime: '17:00',
          endTime: '18:00',
          durationMinutes: 60,
          title: 'Existing Homework',
          category: 'assignment',
          priority: 'medium',
        },
      ],
      availableHours: 12,
    });

    expect(proposal.eventId).toBe('evt_urgent_midterm');
    expect(proposal.proposedPlanSummary.availableHours).toBe(12);
    expect(proposal.proposedPlanSummary.shortageHours).toBe(0);
    expect(proposal.proposedPlanSummary.healthStatus).toBe('healthy');
    expect(proposal.proposedActions.length).toBeGreaterThanOrEqual(4);
  });

  it('fails over to Ollama Qwen when active cloud provider fails', async () => {
    setActiveProvider('gemini');
    process.env.GEMINI_API_KEY = 'mock_key';

    // Mock gemini to throw network/offline error
    const mockGemini = {
      providerType: 'gemini',
      model: 'gemini-1.5-flash',
      generateText: vi.fn().mockRejectedValue(new Error('Cloud connection failed / Network offline')),
    };

    // Mock ollama to succeed
    const mockOllama = {
      providerType: 'ollama',
      model: 'qwen2.5-coder:3b',
      generateText: vi.fn().mockResolvedValue({
        text: '{"topicTitle": "Fallback", "keyPoints": ["Works offline"], "simplifiedExplanation": "Done", "fullExplanation": "Detailed", "examples": ["Ex 1"], "examTips": ["Tip 1"]}',
        provider: 'ollama',
        model: 'qwen2.5-coder:3b',
      }),
    };

    vi.spyOn(aiProviderFactory, 'getProvider').mockImplementation((type?: string) => {
      if (type === 'ollama') return mockOllama as any;
      return mockGemini as any;
    });

    const result = await generateWithAiFallback('Explain fallback', {}, 'topicContent');
    expect(mockGemini.generateText).toHaveBeenCalled();
    expect(mockOllama.generateText).toHaveBeenCalled();
    expect(result.provider).toBe('ollama');
    expect(result.switchedToQwenOffline).toBe(true);

    vi.restoreAllMocks();
    setActiveProvider(null);
  });
});
