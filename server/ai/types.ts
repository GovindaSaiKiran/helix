// HELIX Authoritative Server-side AI Provider Types

export type AiProviderType = 'gemini' | 'groq' | 'ollama';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}

export interface AiGenerateResult {
  text: string;
  provider: AiProviderType;
  model: string;
  durationMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AiDiagnosticResult {
  provider: AiProviderType;
  model: string;
  success: boolean;
  latencyMs: number;
  sampleResponse?: string;
  error?: string;
  timestamp: string;
}

export interface AiProvider {
  readonly providerType: AiProviderType;
  readonly model: string;
  generateText(prompt: string, options?: AiGenerateOptions): Promise<AiGenerateResult>;
  generateChat(messages: AiChatMessage[], options?: AiGenerateOptions): Promise<AiGenerateResult>;
  testConnection(): Promise<AiDiagnosticResult>;
}

// ---------------------------------------------------------------------------
// Domain Schemas matching HELIX contracts
// ---------------------------------------------------------------------------

export interface SyllabusTopicItem {
  title: string;
  estimatedMinutes: number;
}

export interface SyllabusUnitItem {
  unitNumber: number;
  title: string;
  topics: SyllabusTopicItem[];
}

export interface SyllabusExtractionPayload {
  subject: string;
  units: SyllabusUnitItem[];
  notice?: string;
  provider?: string;
  model?: string;
  isFallback?: boolean;
}

export interface TopicContentPayload {
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

export interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface QuizGenerationPayload {
  topicTitle: string;
  questions: QuizQuestionItem[];
  provider?: string;
  model?: string;
  isFallback?: boolean;
}

export interface ReplanExplanationPayload {
  summary: string;
  reasoning: string;
  prioritizedItems: string[];
  studyPacingTip: string;
}
