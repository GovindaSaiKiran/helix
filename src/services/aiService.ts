import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCQQuestion, RoadmapModule } from '../types';
import { AuthGuard, AUTH_REQUIRED_MESSAGE } from './authGuard';
import { AgentExecutor } from './agent/agentExecutor';

export class AiService {
  private static getGeminiKey(): string | null {
    const local = localStorage.getItem('helix_ai_api_key');
    if (local && !local.startsWith('gsk_')) return local;
    return import.meta.env.VITE_GEMINI_API_KEY || null;
  }

  private static getGroqKey(): string | null {
    const local = localStorage.getItem('helix_ai_api_key');
    if (local && local.startsWith('gsk_')) return local;
    return import.meta.env.VITE_GROQ_API_KEY || null;
  }

  public static setApiKey(key: string) {
    if (key.startsWith('gsk_')) {
      localStorage.setItem('helix_ai_api_key', key.trim());
    } else {
      localStorage.setItem('helix_ai_api_key', key.trim());
    }
  }

  public static hasApiKey(): boolean {
    // True because /api/ai/generate is available on the server
    return true;
  }

  private static async callGroq(prompt: string, apiKey: string): Promise<string> {
    const modelsToTry = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an expert AI educational assistant. Output strictly valid JSON without markdown formatting or code fences when requested.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Groq API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to generate with Groq models');
  }

  private static async callGemini(prompt: string, apiKey: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e: any) {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
  }

  private static async callServerApi(prompt: string): Promise<string> {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server AI API Error (${response.status})`);
    }

    const data = await response.json();
    if (!data.text) {
      throw new Error('Server returned empty AI response');
    }

    return data.text;
  }

  private static async generate(prompt: string): Promise<string> {
    // 1. Mandatory Centralized Authentication Check
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    const groqKey = this.getGroqKey();
    const geminiKey = this.getGeminiKey();

    // 2. Try Client-Side Direct Keys (if user provided in Settings/localStorage or VITE_ env)
    if (groqKey) {
      try {
        return await this.callGroq(prompt, groqKey);
      } catch (groqError: any) {
        console.warn('Groq generation failed, attempting Gemini if available:', groqError);
        if (geminiKey) {
          return await this.callGemini(prompt, geminiKey);
        }
      }
    }

    if (geminiKey) {
      try {
        return await this.callGemini(prompt, geminiKey);
      } catch (geminiError: any) {
        console.warn('Gemini generation failed, attempting server endpoint:', geminiError);
      }
    }

    // 3. Authoritative Default: Call Secure Server-Side Vercel API Endpoint
    try {
      return await this.callServerApi(prompt);
    } catch (serverErr: any) {
      console.error('[AiService] Server API failed:', serverErr);
      throw new Error(
        serverErr.message ||
        'AI generation failed. Please ensure GEMINI_API_KEY or GROQ_API_KEY is configured in Vercel environment variables or enter your key in settings.'
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
    // Auth guard check
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    const prompt = `
You are an expert curriculum designer. Analyze the following study material text and create a step-by-step roadmap divided into modules.
Return ONLY a valid JSON array of objects. Do not include markdown formatting or backticks.
Each object must have exactly these keys:
- "title": A short, clear title for the module.
- "description": A brief explanation of what will be learned.
- "estimatedMinutes": A realistic integer estimate of minutes to study this module.

Text to analyze:
${materialText.substring(0, 15000)}
`;

    const response = await this.generate(prompt);
    try {
      const parsed = JSON.parse(this.cleanJson(response));
      return parsed.map((m: any, index: number) => ({
        id: crypto.randomUUID(),
        materialId,
        title: m.title,
        description: m.description,
        estimatedMinutes: m.estimatedMinutes || 30,
        order: index + 1
      }));
    } catch (e) {
      console.error('Failed to parse Roadmap JSON:', response);
      throw new Error('Failed to generate a valid roadmap.');
    }
  }

  public static async generateMCQs(materialText: string, materialId: string, subjectId: string): Promise<MCQQuestion[]> {
    // Auth guard check
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    const prompt = `
You are an expert tutor. Create 5 multiple-choice questions based on the following study material text.
Return ONLY a valid JSON array of objects. Do not include markdown formatting or backticks.
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
        const options = q.options.map((opt: string) => ({
          id: crypto.randomUUID(),
          text: opt
        }));
        
        return {
          id: crypto.randomUUID(),
          materialId,
          subjectId,
          questionText: q.questionText,
          options,
          correctOptionId: options[q.correctAnswerIndex]?.id || options[0].id,
          explanation: q.explanation
        };
      });
    } catch (e) {
      console.error('Failed to parse MCQ JSON:', response);
      throw new Error('Failed to generate valid MCQs.');
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
  }> {
    // Auth guard check
    const auth = await AuthGuard.checkAuth();
    if (!auth.isAuthenticated) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }

    const prompt = `
You are a university professor and expert tutor. Create complete, high-quality study content for the following academic topic:
Topic: "${topicTitle}"
Course/Subject: "${subjectName || 'Academic Course'}"

Return ONLY a valid JSON object with no markdown fences, no backticks, and exactly these keys:
{
  "topicTitle": "${topicTitle}",
  "subjectName": "${subjectName || 'Academic Course'}",
  "keyPoints": [
    "Key definition or rule 1",
    "Key definition or rule 2",
    "Key definition or rule 3",
    "Key definition or rule 4"
  ],
  "simplifiedExplanation": "A clear, intuitive analogy and simple conceptual explanation that anyone can understand in 2 paragraphs.",
  "fullExplanation": "A thorough, rigorous academic explanation covering core principles, formulas/architecture, and theoretical foundations.",
  "examples": [
    "Concrete real-world or worked numerical example 1 with explanation",
    "Concrete real-world or worked numerical example 2 with explanation"
  ],
  "examTips": [
    "High-yield exam tip or common student pitfall 1",
    "High-yield exam tip or common student pitfall 2",
    "Important formula or proof reminder 3"
  ]
}
`;

    try {
      const response = await this.generate(prompt);
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');
      const parsed = JSON.parse(response.substring(start, end + 1));
      return {
        topicTitle: parsed.topicTitle || topicTitle,
        subjectName: parsed.subjectName || subjectName,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ["Comprehensive topic coverage", "Core theoretical foundations"],
        simplifiedExplanation: parsed.simplifiedExplanation || "This topic focuses on fundamental principles and standard domain techniques.",
        fullExplanation: parsed.fullExplanation || "In-depth theoretical breakdown of the module concepts, architectures, and standard methodologies.",
        examples: Array.isArray(parsed.examples) ? parsed.examples : ["Standard illustrative scenario applying the foundational concepts."],
        examTips: Array.isArray(parsed.examTips) ? parsed.examTips : ["Focus on core definitions and standard calculation steps."]
      };
    } catch (e: any) {
      if (e.message === AUTH_REQUIRED_MESSAGE) {
        throw e;
      }
      console.warn('Fallback topic study content generator:', e);
      return {
        topicTitle,
        subjectName,
        keyPoints: [
          `Fundamental concepts of ${topicTitle}`,
          "Core mathematical / logical principles",
          "Standard industry and academic application scenarios"
        ],
        simplifiedExplanation: `Think of ${topicTitle} as a structured approach to solving foundational problems in ${subjectName || 'this subject'}. It provides the necessary tools and methodologies.`,
        fullExplanation: `Detailed breakdown for ${topicTitle}: This area encompasses key principles, analytical formulations, and formal requirements for academic mastery.`,
        examples: [
          `Example scenario illustrating practical application of ${topicTitle}.`
        ],
        examTips: [
          "Be prepared to define key terminology and show intermediate derivation steps."
        ]
      };
    }
  }

  /**
   * Process Agent Action - Powered directly by the authoritative AgentExecutor & IntentRouter pipeline
   */
  public static async processAgentAction(
    userPrompt: string,
    context?: { subjects?: string[]; existingTasks?: string[]; currentDate?: string }
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
