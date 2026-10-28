// HELIX Strict Output Validation & Safe JSON Extraction
// Prevents malformed, incomplete, or hallucinated AI responses from reaching the client without verification.

import {
  SyllabusExtractionPayload,
  TopicContentPayload,
  QuizGenerationPayload,
  ReplanExplanationPayload,
} from './types.js';

export class SchemaValidationError extends Error {
  public readonly rawText?: string;
  constructor(message: string, rawText?: string) {
    super(message);
    this.name = 'SchemaValidationError';
    this.rawText = rawText;
  }
}

/**
 * Extracts and parses a JSON payload from an LLM response string.
 * Strips markdown code blocks, preamble text, and trailing commentary.
 */
export function extractAndParseJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new SchemaValidationError('Empty or non-string response received from AI model');
  }

  // 1. Remove markdown fences (```json ... ``` or ``` ...)
  let cleaned = rawText
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '') // remove up to first fence
    .replace(/\s*```[\s\S]*$/i, '') // remove trailing fence
    .trim();

  // 2. Direct parse attempt
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue to bracket extraction if direct parse fails
  }

  // 3. Fallback: Find matching outermost { } or [ ]
  const firstBrace = rawText.indexOf('{');
  const firstBracket = rawText.indexOf('[');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = rawText.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = rawText.lastIndexOf(']');
  }

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new SchemaValidationError(
      'Model output does not contain a valid JSON object or array structure.',
      rawText.slice(0, 300)
    );
  }

  const candidate = rawText.substring(startIdx, endIdx + 1);
  try {
    return JSON.parse(candidate);
  } catch (err: any) {
    throw new SchemaValidationError(
      `Failed to parse extracted JSON candidate: ${err.message}`,
      rawText.slice(0, 300)
    );
  }
}

/**
 * Validates extracted syllabus structure against the HELIX syllabus schema.
 */
export function validateSyllabusExtraction(
  data: any,
  fallbackSubject: string = 'Course'
): SyllabusExtractionPayload {
  if (!data || typeof data !== 'object') {
    throw new SchemaValidationError('Syllabus payload must be a JSON object');
  }

  const subject = typeof data.subject === 'string' && data.subject.trim()
    ? data.subject.trim()
    : fallbackSubject;

  const rawUnits = Array.isArray(data.units) ? data.units : [];
  if (rawUnits.length === 0) {
    throw new SchemaValidationError('Syllabus must contain at least one unit with topics');
  }

  const units = rawUnits.map((u: any, uIdx: number) => {
    const unitNumber = typeof u.unitNumber === 'number' ? u.unitNumber : uIdx + 1;
    const title = typeof u.title === 'string' && u.title.trim()
      ? u.title.trim()
      : `Unit ${unitNumber}`;

    const rawTopics = Array.isArray(u.topics) ? u.topics : [];
    if (rawTopics.length === 0) {
      throw new SchemaValidationError(`Unit ${unitNumber} ("${title}") has no topics listed`);
    }

    const topics = rawTopics.map((t: any, tIdx: number) => {
      const topicTitle = typeof t.title === 'string' && t.title.trim()
        ? t.title.trim()
        : typeof t === 'string' && t.trim()
        ? t.trim()
        : `Topic ${tIdx + 1}`;

      const estimatedMinutes = typeof t.estimatedMinutes === 'number' && t.estimatedMinutes > 0
        ? Math.min(240, Math.max(15, Math.round(t.estimatedMinutes)))
        : 45;

      return {
        title: topicTitle,
        estimatedMinutes,
      };
    });

    return {
      unitNumber,
      title,
      topics,
    };
  });

  return {
    subject,
    units,
  };
}

/**
 * Validates topic study content schema.
 */
export function validateTopicContent(
  data: any,
  defaultTopicTitle: string = 'Topic'
): TopicContentPayload {
  if (!data || typeof data !== 'object') {
    throw new SchemaValidationError('Topic content payload must be a JSON object');
  }

  const topicTitle = typeof data.topicTitle === 'string' && data.topicTitle.trim()
    ? data.topicTitle.trim()
    : defaultTopicTitle;

  const keyPoints = Array.isArray(data.keyPoints) && data.keyPoints.length > 0
    ? data.keyPoints.map((p: any) => String(p).trim()).filter(Boolean)
    : [];

  if (keyPoints.length === 0) {
    throw new SchemaValidationError('Topic content must include at least one key point');
  }

  const simplifiedExplanation = typeof data.simplifiedExplanation === 'string' && data.simplifiedExplanation.trim()
    ? data.simplifiedExplanation.trim()
    : '';

  const fullExplanation = typeof data.fullExplanation === 'string' && data.fullExplanation.trim()
    ? data.fullExplanation.trim()
    : '';

  if (!simplifiedExplanation && !fullExplanation) {
    throw new SchemaValidationError('Topic content must include an explanation');
  }

  const examples = Array.isArray(data.examples)
    ? data.examples.map((e: any) => String(e).trim()).filter(Boolean)
    : [];

  const examTips = Array.isArray(data.examTips)
    ? data.examTips.map((tip: any) => String(tip).trim()).filter(Boolean)
    : [];

  return {
    topicTitle,
    subjectName: typeof data.subjectName === 'string' ? data.subjectName.trim() : undefined,
    keyPoints,
    simplifiedExplanation: simplifiedExplanation || 'Core conceptual overview for this topic.',
    fullExplanation: fullExplanation || simplifiedExplanation,
    examples: examples.length > 0 ? examples : ['Practical application scenario.'],
    examTips: examTips.length > 0 ? examTips : ['Review fundamental definitions and step-by-step proofs.'],
  };
}

/**
 * Validates generated quiz schema.
 */
export function validateQuizGeneration(
  data: any,
  defaultTopicTitle: string = 'Quiz'
): QuizGenerationPayload {
  if (!data || typeof data !== 'object') {
    throw new SchemaValidationError('Quiz payload must be a JSON object');
  }

  const topicTitle = typeof data.topicTitle === 'string' && data.topicTitle.trim()
    ? data.topicTitle.trim()
    : defaultTopicTitle;

  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  if (rawQuestions.length === 0) {
    throw new SchemaValidationError('Quiz must contain at least one question');
  }

  const questions = rawQuestions.map((q: any, idx: number) => {
    const id = q.id ? String(q.id) : `q_${Date.now()}_${idx + 1}`;
    const question = typeof q.question === 'string' && q.question.trim()
      ? q.question.trim()
      : typeof q.questionText === 'string' && q.questionText.trim()
      ? q.questionText.trim()
      : `Question ${idx + 1}`;

    const rawOptions = Array.isArray(q.options)
      ? q.options.map((opt: any) => (typeof opt === 'object' && opt?.text ? String(opt.text) : String(opt).trim()))
      : [];

    if (rawOptions.length < 2) {
      throw new SchemaValidationError(`Question ${idx + 1} must have at least 2 options`);
    }

    let correctOptionIndex = 0;
    if (typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex < rawOptions.length) {
      correctOptionIndex = q.correctOptionIndex;
    } else if (typeof q.correctAnswerIndex === 'number' && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < rawOptions.length) {
      correctOptionIndex = q.correctAnswerIndex;
    }

    const explanation = typeof q.explanation === 'string' && q.explanation.trim()
      ? q.explanation.trim()
      : 'Correct answer based on the core principles of this topic.';

    return {
      id,
      question,
      options: rawOptions,
      correctOptionIndex,
      explanation,
    };
  });

  return {
    topicTitle,
    questions,
  };
}

/**
 * Validates AI replanning explanation.
 */
export function validateReplanExplanation(data: any): ReplanExplanationPayload {
  if (!data || typeof data !== 'object') {
    throw new SchemaValidationError('Replanning explanation must be a JSON object');
  }

  return {
    summary: typeof data.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : 'Schedule adapted to incorporate urgent priorities while protecting existing milestones.',
    reasoning: typeof data.reasoning === 'string' && data.reasoning.trim()
      ? data.reasoning.trim()
      : 'Rebalanced focus blocks using deterministic available hours without dropping core deadlines.',
    prioritizedItems: Array.isArray(data.prioritizedItems)
      ? data.prioritizedItems.map((item: any) => String(item).trim()).filter(Boolean)
      : ['Urgent task allocation', 'Non-critical slot compression'],
    studyPacingTip: typeof data.studyPacingTip === 'string' && data.studyPacingTip.trim()
      ? data.studyPacingTip.trim()
      : 'Take a short 5-minute break between intense focus slots to maintain retention.',
  };
}
