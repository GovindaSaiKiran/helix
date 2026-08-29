// HELIX Client API Service for Backend Communication

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  aiEngine?: {
    geminiConfigured: boolean;
    groqConfigured: boolean;
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
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  url: string;
}

export class ApiClient {
  public static async checkHealth(): Promise<HealthCheckResponse> {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
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
  ) {
    const res = await fetch(`${BASE_URL}/api/ai/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitle, subjectName }),
    });
    if (!res.ok) throw new Error(`Quiz generation failed: HTTP ${res.status}`);
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
}
