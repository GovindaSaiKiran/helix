import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCQQuestion, RoadmapModule } from '../types';

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
    return !!(this.getGeminiKey() || this.getGroqKey());
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
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an expert AI educational assistant. Output strictly valid JSON without markdown formatting or code fences when requested.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
          })
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
    // Try modern gemini models with fallback
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

  private static async generate(prompt: string): Promise<string> {
    const groqKey = this.getGroqKey();
    const geminiKey = this.getGeminiKey();

    if (!groqKey && !geminiKey) {
      throw new Error('No valid Gemini or Groq API Key found. Please add one in settings or .env.local.');
    }

    // Try Groq first if available (or if Gemini key format is invalid)
    if (groqKey) {
      try {
        return await this.callGroq(prompt, groqKey);
      } catch (groqError: any) {
        console.warn('Groq generation failed, attempting Gemini if available:', groqError);
        if (geminiKey) {
          return await this.callGemini(prompt, geminiKey);
        }
        throw groqError;
      }
    }

    if (geminiKey) {
      try {
        return await this.callGemini(prompt, geminiKey);
      } catch (geminiError: any) {
        console.warn('Gemini generation failed:', geminiError);
        throw geminiError;
      }
    }

    throw new Error('Could not complete generation with configured keys.');
  }

  private static cleanJson(text: string): string {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) return text;
    return text.substring(start, end + 1);
  }

  public static async generateRoadmap(materialText: string, materialId: string): Promise<RoadmapModule[]> {
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

    const response = await this.generate(prompt);
    try {
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
    } catch (e) {
      console.warn('Failed to parse topic study content JSON:', response);
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

  public static async processAgentAction(
    userPrompt: string,
    context?: { subjects?: string[]; existingTasks?: string[]; currentDate?: string }
  ): Promise<{
    reply: string;
    toolCalls?: Array<{
      tool: 'create_task' | 'search_videos' | 'create_project' | 'delete_task' | 'delete_project' | 'navigate' | 'general_answer';
      parameters: Record<string, any>;
    }>;
  }> {
    const todayStr = context?.currentDate || new Date().toISOString().split('T')[0];
    const systemPrompt = `You are Helix Planning Agent, an intelligent autonomous educational assistant inside the Helix Student Planner web application.
Today's date is: ${todayStr}.
Enrolled subjects: ${context?.subjects?.join(', ') || 'General Courses'}.

You have direct control to execute actions on behalf of the student.
When the user asks you to schedule a task, search for videos, create a project, delete an item, navigate, or give advice, you must return a JSON object with:
- "reply": A friendly, helpful explanation of what you are doing or answering.
- "toolCalls": An array of tool calls to execute.

Available Tools:
1. tool: "create_task"
   parameters: {
     "title": string,
     "estimatedMinutes": number (default 45),
     "priority": "low" | "medium" | "high" | "urgent",
     "type": "study" | "assignment" | "project",
     "scheduledDate": "YYYY-MM-DD" (optional, default today or specified date)
   }
2. tool: "search_videos"
   parameters: {
     "query": string,
     "maxResults": number (default 4)
   }
3. tool: "create_project"
   parameters: {
     "title": string,
     "category": "project" | "assignment" | "goal",
     "priority": "low" | "medium" | "high",
     "estimatedEffortHours": number (default 10),
     "dueDate": "YYYY-MM-DD"
   }
4. tool: "delete_task"
   parameters: {
     "taskTitle": string
   }
5. tool: "delete_project"
   parameters: {
     "projectTitle": string
   }
6. tool: "navigate"
   parameters: {
     "page": "/study" | "/week" | "/today" | "/work" | "/analytics" | "/settings"
   }

Output strictly valid JSON only. Do not wrap in markdown or backticks.
JSON format:
{
  "reply": "...",
  "toolCalls": [ ... ]
}`;

    const prompt = `${systemPrompt}\n\nUser request: "${userPrompt}"`;

    try {
      const raw = await this.generate(prompt);
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
      cleaned = cleaned.trim();

      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleaned = cleaned.substring(start, end + 1);
      }

      const parsed = JSON.parse(cleaned);
      return {
        reply: parsed.reply || 'Task processed successfully.',
        toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls : []
      };
    } catch (e: any) {
      console.warn('Agent action fallback:', e);

      // Intelligent heuristics fallback if LLM is unavailable
      const lower = userPrompt.toLowerCase();
      if (lower.includes('video') || lower.includes('lecture') || lower.includes('youtube')) {
        const query = userPrompt.replace(/find|search|videos?|for|on|about|youtube/gi, '').trim() || 'computer science tutorial';
        return {
          reply: `I searched YouTube for study videos on "${query}".`,
          toolCalls: [{ tool: 'search_videos', parameters: { query, maxResults: 4 } }]
        };
      }
      if (lower.includes('schedule') || lower.includes('task') || lower.includes('study for')) {
        const title = userPrompt.replace(/schedule|add|task|study|for|tomorrow|today/gi, '').trim() || 'Focus Study Session';
        return {
          reply: `I scheduled "${title}" into your focus timetable.`,
          toolCalls: [{ tool: 'create_task', parameters: { title, estimatedMinutes: 45, priority: 'medium', type: 'study' } }]
        };
      }

      return {
        reply: `I analyzed your request: "${userPrompt}". How else can I assist with your study schedule, projects, or lecture search?`,
        toolCalls: []
      };
    }
  }
}
