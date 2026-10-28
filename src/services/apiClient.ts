// HELIX Client API Service for Backend Communication

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  aiEngine?: {
    activeProvider?: string;
    activeModel?: string;
    geminiConfigured: boolean;
    groqConfigured: boolean;
    ollamaConfigured: boolean;
    youtubeConfigured: boolean;
  };
}

export interface BackendPlanHealthResponse {
  score: number;
  status: 'healthy' | 'tight' | 'at_risk' | 'overloaded';
  label: string;
  totalAvailableHours: number;
  totalPlannedHours: number;
  bufferHours: number;
  conflictCount: number;
  recommendations: string[];
}

export interface TopicContentResponse {
  topicTitle: string;
  subjectName?: string;
  keyPoints: string[];
  simplifiedExplanation: string;
  fullExplanation: string;
  examples: string[];
  examTips: string[];
  provider?: string;
  model?: string;
  isFallback?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface QuizResponse {
  topicTitle: string;
  questions: QuizQuestion[];
  provider?: string;
  model?: string;
  isFallback?: boolean;
}

export interface SyllabusUnit {
  unitNumber: number;
  title: string;
  topics: Array<{ title: string; estimatedMinutes: number }>;
}

export interface SyllabusExtractResponse {
  subject: string;
  units: SyllabusUnit[];
  notice?: string;
  provider?: string;
  model?: string;
  isFallback?: boolean;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  url: string;
}

export interface AiDiagnosticResponse {
  status: 'ok' | 'degraded' | 'error';
  diagnostic: {
    provider: 'gemini' | 'groq' | 'ollama';
    model: string;
    success: boolean;
    latencyMs: number;
    sampleResponse?: string;
    error?: string;
    timestamp: string;
  };
  config: {
    activeProvider: string;
    activeModel: string;
    providers: Record<string, { configured: boolean; model: string; baseUrl?: string }>;
    timeoutMs: number;
  };
}

export class ApiClient {
  public static async checkHealth(): Promise<HealthCheckResponse> {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
    return res.json();
  }

  public static async getAiDiagnostic(provider?: string): Promise<AiDiagnosticResponse> {
    const url = provider
      ? `${BASE_URL}/api/ai/diagnostic?provider=${encodeURIComponent(provider)}`
      : `${BASE_URL}/api/ai/diagnostic`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI diagnostic failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  public static async calculatePlanHealth(
    availableHours: number,
    plannedHours: number,
    conflictCount: number = 0
  ): Promise<BackendPlanHealthResponse> {
    const res = await fetch(`${BASE_URL}/api/planner/calculate-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availableHours, plannedHours, conflictCount }),
    });
    if (!res.ok) throw new Error(`Planner calculation failed: HTTP ${res.status}`);
    return res.json();
  }

  public static async generateReplanningProposal(data: {
    event: any;
    currentSchedule: any[];
    availableHours: number;
  }) {
    const res = await fetch(`${BASE_URL}/api/planner/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Replanning failed: HTTP ${res.status}`);
    return res.json();
  }

  public static async extractSyllabus(
    syllabusText: string,
    subjectName?: string
  ): Promise<SyllabusExtractResponse> {
    const res = await fetch(`${BASE_URL}/api/ai/extract-syllabus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syllabusText, subjectName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Syllabus extraction failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  public static async generateTopicContent(
    topicTitle: string,
    subjectName?: string
  ): Promise<TopicContentResponse> {
    const res = await fetch(`${BASE_URL}/api/ai/topic-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitle, subjectName }),
    });
    if (!res.ok) throw new Error(`Topic content generation failed: HTTP ${res.status}`);
    return res.json();
  }

  public static async generateQuiz(
    topicTitle: string,
    subjectName?: string
  ): Promise<QuizResponse> {
    const res = await fetch(`${BASE_URL}/api/ai/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitle, subjectName }),
    });
    if (!res.ok) throw new Error(`Quiz generation failed: HTTP ${res.status}`);
    return res.json();
  }

  public static async generateRawText(
    prompt: string,
    options?: Record<string, any>
  ): Promise<{ text: string; provider: string; model: string; durationMs: number }> {
    const res = await fetch(`${BASE_URL}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, options }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI generation failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  public static async searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
    try {
      const res = await fetch(`${BASE_URL}/api/youtube/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    } catch {
      return [];
    }
  }

  public static async switchAiProvider(
    provider: 'ollama' | 'groq' | 'gemini'
  ): Promise<{ success: boolean; activeProvider: string; activeModel: string; isDefaultQwen: boolean }> {
    const res = await fetch(`${BASE_URL}/api/ai/switch-provider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to switch provider: HTTP ${res.status}`);
    }
    return res.json();
  }
}

