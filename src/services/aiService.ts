// HELIX Client AI Gateway Service
// Routes all AI operations exclusively through the secure Express backend gateway.
// Zero API keys or provider secrets are handled or stored in the browser bundle.

import { MCQQuestion, RoadmapModule } from '../types';
import { AuthGuard, AUTH_REQUIRED_MESSAGE } from './authGuard';
import { AgentExecutor } from './agent/agentExecutor';
import { ApiClient } from './apiClient';

export class AiService {
  /**
   * Compatibility method preserved for existing UI components.
   * Server environment variables and provider configs are the single authoritative source of credentials.
   */
  public static setApiKey(_key: string) {
    // No-op: API keys are securely managed server-side.
  }

  public static hasApiKey(): boolean {
    return true; // Authoritative server backend handles provider execution
  }

  /**
   * Centralized server-side generation gateway.
   * All LLM inferences (Gemini, Groq, or Ollama) route through /api/ai/generate on the backend.
   */
  private static async generate(prompt: string): Promise<string> {
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    try {
      const result = await ApiClient.generateRawText(prompt);
      if (!result.text) {
        throw new Error('Server returned empty AI response');
      }
      return result.text;
    } catch (err: any) {
      console.warn('[AiService] Backend AI gateway call notice:', err.message);
      throw new Error(
        err.message || 'AI generation failed on the server backend. Please check server AI configuration.'
      );
    }
  }

  private static cleanJson(text: string): string {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) return text;
    return text.substring(start, end + 1);
  }

  public static async generateRoadmap(materialText: string, materialId: string): Promise<RoadmapModule[]> {
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    const prompt = `You are an expert curriculum designer. Analyze the following study material text and create a step-by-step roadmap divided into modules.
Return ONLY a valid JSON array of objects without markdown formatting or code fences.
Each object must have exactly these keys:
- "title": A short, clear title for the module.
- "description": A brief explanation of what will be learned.
- "estimatedMinutes": A realistic integer estimate of minutes to study this module (e.g. 30, 45, 60).

Text to analyze:
${materialText.substring(0, 15000)}
`;

    const response = await this.generate(prompt);
    try {
      const parsed = JSON.parse(this.cleanJson(response));
      return parsed.map((m: any, index: number) => ({
        id: crypto.randomUUID(),
        materialId,
        title: m.title || `Module ${index + 1}`,
        description: m.description || 'Core study module',
        estimatedMinutes: Number(m.estimatedMinutes) || 30,
        order: index + 1,
      }));
    } catch (e) {
      console.error('Failed to parse Roadmap JSON:', response);
      throw new Error('Failed to parse curriculum roadmap from model output.');
    }
  }

  public static async generateMCQs(materialText: string, materialId: string, subjectId: string): Promise<MCQQuestion[]> {
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    const prompt = `You are an expert tutor. Create 5 multiple-choice questions based on the following study material text.
Return ONLY a valid JSON array of objects without markdown formatting or code fences.
Each object must have exactly these keys:
- "questionText": The question string.
- "options": An array of exactly 4 strings (the possible answers).
- "correctAnswerIndex": The integer index (0-3) of the correct option in the options array.
- "explanation": A brief string explaining why it is correct.

Text to analyze:
${materialText.substring(0, 15000)}
`;

    const response = await this.generate(prompt);
    try {
      const parsed = JSON.parse(this.cleanJson(response));
      return parsed.map((q: any) => {
        const options = (q.options || []).map((opt: string) => ({
          id: crypto.randomUUID(),
          text: String(opt),
        }));

        const correctIdx = Number(q.correctAnswerIndex) || 0;
        return {
          id: crypto.randomUUID(),
          materialId,
          subjectId,
          questionText: q.questionText || 'Quiz question',
          options,
          correctOptionId: options[correctIdx]?.id || options[0]?.id || crypto.randomUUID(),
          explanation: q.explanation || 'Correct conceptual understanding.',
        };
      });
    } catch (e) {
      console.error('Failed to parse MCQ JSON:', response);
      throw new Error('Failed to generate valid MCQs from model output.');
    }
  }

  public static async generateTopicStudyContent(topicTitle: string, subjectName?: string): Promise<{
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
  }> {
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    try {
      // Delegate to authoritative backend topic-content endpoint with schema validation
      const res = await ApiClient.generateTopicContent(topicTitle, subjectName);
      return {
        topicTitle: res.topicTitle,
        subjectName: res.subjectName || subjectName,
        keyPoints: res.keyPoints,
        simplifiedExplanation: res.simplifiedExplanation,
        fullExplanation: res.fullExplanation,
        examples: res.examples,
        examTips: res.examTips,
        provider: res.provider,
        model: res.model,
        isFallback: res.isFallback,
      };
    } catch (err: any) {
      if (err.message === AUTH_REQUIRED_MESSAGE) {
        throw err;
      }
      console.warn('[AiService] Topic content generator notice:', err.message);
      return {
        topicTitle,
        subjectName,
        keyPoints: [
          `Fundamental principles of ${topicTitle}`,
          'Core mathematical and structural invariants',
          'Standard exam decomposition and boundary analysis',
        ],
        simplifiedExplanation: `Think of ${topicTitle} as an organized system where each component has an explicit, verifiable responsibility.`,
        fullExplanation: `Detailed breakdown for ${topicTitle}: It establishes functional guarantees to eliminate redundancy and preserve consistency across operations.`,
        examples: [
          `Standard problem scenario demonstrating practical implementation of ${topicTitle}.`,
        ],
        examTips: [
          'Be prepared to write precise definitions and list all edge cases in semester exams.',
        ],
        isFallback: true,
      };
    }
  }

  /**
   * Process Agent Action - Powered directly by the authoritative AgentExecutor & IntentRouter pipeline
   */
  public static async processAgentAction(
    userPrompt: string,
    _context?: { subjects?: string[]; existingTasks?: string[]; currentDate?: string }
  ): Promise<{
    reply: string;
    toolCalls?: Array<{
      tool: 'create_task' | 'search_videos' | 'create_project' | 'delete_task' | 'delete_project' | 'navigate' | 'general_answer';
      parameters: Record<string, any>;
    }>;
    toolResults?: any[];
  }> {
    const execution = await AgentExecutor.execute(userPrompt);

    return {
      reply: execution.reply,
      toolResults: execution.toolResults,
    };
  }
}
