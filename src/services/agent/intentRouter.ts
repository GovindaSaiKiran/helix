/**
 * HELIX Agent Intent Router
 * Classifies user natural language input into structured action intents
 * and extracts validated parameters (dates, times, durations, priorities, queries).
 */

export type AgentIntent =
  // Tasks
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'COMPLETE_TASK'
  | 'LIST_TASKS'
  | 'GET_TODAY_TASKS'
  | 'GET_UPCOMING_TASKS'
  // Reminders
  | 'CREATE_REMINDER'
  | 'UPDATE_REMINDER'
  | 'DELETE_REMINDER'
  | 'LIST_REMINDERS'
  // Schedule
  | 'CREATE_SCHEDULE'
  | 'UPDATE_SCHEDULE'
  | 'DELETE_SCHEDULE'
  | 'GENERATE_TIMETABLE'
  | 'REPLAN'
  // Projects
  | 'CREATE_PROJECT'
  | 'ADD_MILESTONE'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'GET_PROJECT_STATUS'
  // Study & Subjects
  | 'ADD_SUBJECT'
  | 'DELETE_SUBJECT'
  | 'ADD_TOPIC'
  | 'EXTRACT_SYLLABUS'
  | 'GENERATE_TOPIC_CONTENT'
  | 'GENERATE_QUIZ'
  // Notifications
  | 'ENABLE_NOTIFICATIONS'
  | 'DISABLE_NOTIFICATIONS'
  | 'SEND_TEST_NOTIFICATION'
  // AI & Search
  | 'SEARCH_YOUTUBE'
  | 'EXPLAIN_TOPIC'
  | 'SUMMARIZE'
  | 'ANSWER_QUESTION'
  // Information & Navigation
  | 'SHOW_ANALYTICS'
  | 'SHOW_TODAY'
  | 'SHOW_WEEK'
  | 'SHOW_TASKS'
  | 'SHOW_PROJECTS'
  | 'UNKNOWN';

export interface ExtractedParameters {
  title?: string;
  targetTitle?: string;
  taskId?: string;
  subjectName?: string;
  projectName?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (24h) - only set if explicitly present in prompt
  endTime?: string; // HH:mm (24h)
  estimatedMinutes?: number;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  type?: 'study' | 'assignment' | 'project' | 'revision' | 'quiz' | 'break';
  reminder?: boolean;
  query?: string;
  page?: string;
  rawInput: string;
  missingRequired?: string[];
}

export interface ParsedActionItem {
  intent: AgentIntent;
  parameters: ExtractedParameters;
  requiresConfirmation?: boolean;
  confidence: number;
}

export class IntentRouter {
  /**
   * Parse user prompt into one or more sequential action items (supports multi-action commands).
   */
  public static parse(userPrompt: string): ParsedActionItem[] {
    const cleanPrompt = userPrompt.trim();
    if (!cleanPrompt) return [];

    // Check if the prompt has explicit compound conjunctions (e.g. "... and find me a video for ...")
    const subClauses = this.splitMultiActionPrompt(cleanPrompt);

    return subClauses.map(clause => this.parseSingleClause(clause, cleanPrompt));
  }

  /**
   * Split multi-action prompt into independent clauses if present.
   */
  private static splitMultiActionPrompt(prompt: string): string[] {
    // Look for explicit multi-action conjunctions like "and find", "and search", "and remind", "and also"
    const multiPattern = /\s+(?:and\s+(?:also\s+)?(?:find|search|give\s+me|get|remind|schedule|create|add))\s+/i;
    
    if (multiPattern.test(prompt)) {
      const match = prompt.match(multiPattern);
      if (match && match.index !== undefined) {
        const first = prompt.substring(0, match.index).trim();
        const second = prompt.substring(match.index + match[0].length).trim();
        
        // Ensure second clause retains the action verb
        const verbMatch = match[0].replace(/\s*and\s+(?:also\s+)?/i, '').trim();
        const fullSecond = verbMatch ? `${verbMatch} ${second}` : second;
        
        if (first.length > 5 && fullSecond.length > 5) {
          return [first, fullSecond];
        }
      }
    }

    return [prompt];
  }

  /**
   * Classify a single clause into a typed action item.
   */
  private static parseSingleClause(clause: string, originalPrompt: string): ParsedActionItem {
    const lower = clause.toLowerCase();

    // 1. Explicit YouTube search (Strictly only when user specifically requests videos/tutorials/lectures to watch)
    if (this.isExplicitYouTubeRequest(lower)) {
      const query = this.extractSearchQuery(clause);
      return {
        intent: 'SEARCH_YOUTUBE',
        parameters: {
          query,
          rawInput: clause,
        },
        confidence: 0.95,
      };
    }

    // 2. Notification System Controls
    if (/\b(?:enable|turn\s+on|activate)\b.*\b(?:notifications?|push|alerts?)\b/i.test(lower)) {
      return {
        intent: 'ENABLE_NOTIFICATIONS',
        parameters: { rawInput: clause },
        confidence: 0.95,
      };
    }
    if (/\b(?:disable|turn\s+off|mute|deactivate)\b.*\b(?:notifications?|push|alerts?)\b/i.test(lower)) {
      return {
        intent: 'DISABLE_NOTIFICATIONS',
        parameters: { rawInput: clause },
        confidence: 0.95,
      };
    }
    if (/\b(?:send|test)\b.*\b(?:test\s+notification|push\s+notification|fcm\s+test)\b/i.test(lower)) {
      return {
        intent: 'SEND_TEST_NOTIFICATION',
        parameters: { rawInput: clause },
        confidence: 0.95,
      };
    }

    // 3. Reschedule / Move / Update Reminder
    if (/\b(?:reschedule|postpone|delay|move|shift|change\s+(?:the\s+)?time|update\s+(?:the\s+)?time|update\s+reminder|change\s+reminder)\b/i.test(lower)) {
      const parsedTask = this.extractTaskDetails(clause, true);
      const targetTitle = this.extractTaskTitleForAction(clause, [
        'reschedule my',
        'reschedule the',
        'reschedule',
        'postpone my',
        'postpone the',
        'postpone',
        'move my',
        'move the',
        'move',
        'change reminder for',
        'update reminder for',
        'change time for',
        'update time for',
        'change',
        'update',
      ]);

      const hasDateInClause = /\b(?:today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower);
      const missing: string[] = [];
      if (!targetTitle || targetTitle.length === 0 || ['reminder', 'task', 'time', 'session', 'to', 'for', 'my', 'class', 'assignment'].includes(targetTitle.toLowerCase())) {
        missing.push('title');
      }
      if (!parsedTask.startTime && !hasDateInClause) {
        missing.push('time');
      }

      return {
        intent: 'UPDATE_REMINDER',
        parameters: {
          ...parsedTask,
          targetTitle: targetTitle || parsedTask.title,
          title: targetTitle || parsedTask.title,
          missingRequired: missing.length > 0 ? missing : undefined,
          rawInput: clause,
        },
        confidence: 0.95,
      };
    }

    // 4. Mark / Complete Task
    if (/\b(?:mark|set|flag)\b.*\b(?:complete|completed|done|finished)\b/i.test(lower) || /\b(?:finish|completed?)\b/i.test(lower)) {
      const targetTitle = this.extractTaskTitleForAction(clause, ['mark as completed', 'mark', 'as completed', 'completed', 'done', 'finish']);
      return {
        intent: 'COMPLETE_TASK',
        parameters: {
          targetTitle,
          title: targetTitle,
          rawInput: clause,
        },
        confidence: 0.9,
      };
    }

    // 4. Delete Task / Project / Subject (Destructive -> requiresConfirmation)
    if (/\b(?:delete|remove|clear|cancel|drop)\b/i.test(lower)) {
      if (lower.includes('project')) {
        const title = this.extractTitleAfterWords(clause, ['delete project', 'remove project', 'delete', 'remove']);
        return {
          intent: 'DELETE_PROJECT',
          parameters: { targetTitle: title, title, rawInput: clause },
          requiresConfirmation: true,
          confidence: 0.9,
        };
      }
      if (lower.includes('subject') || lower.includes('course')) {
        const title = this.extractTitleAfterWords(clause, ['delete subject', 'remove subject', 'delete course', 'delete', 'remove']);
        return {
          intent: 'DELETE_SUBJECT',
          parameters: { targetTitle: title, title, rawInput: clause },
          requiresConfirmation: true,
          confidence: 0.9,
        };
      }

      const targetTitle = this.extractTaskTitleForAction(clause, ['delete my', 'delete the', 'delete', 'remove my', 'remove']);
      return {
        intent: 'DELETE_TASK',
        parameters: {
          targetTitle,
          title: targetTitle,
          rawInput: clause,
        },
        requiresConfirmation: true,
        confidence: 0.9,
      };
    }

    // 5. Queries: Read / List Tasks & Reminders
    if (
      /\b(?:what|show|list|get|view|tell\s+me)\b.*\b(?:tasks?|schedule|assignments?|agenda|todo|to-do|timetable|reminders?)\b/i.test(lower) ||
      lower === 'my tasks' ||
      lower === 'today tasks' ||
      lower === 'my reminders'
    ) {
      if (lower.includes('reminder')) {
        return {
          intent: 'LIST_REMINDERS',
          parameters: { rawInput: clause },
          confidence: 0.9,
        };
      }
      if (lower.includes('today') || lower.includes('tonight') || lower.includes('now')) {
        return {
          intent: 'GET_TODAY_TASKS',
          parameters: { rawInput: clause },
          confidence: 0.95,
        };
      }
      if (lower.includes('upcoming') || lower.includes('week') || lower.includes('tomorrow')) {
        return {
          intent: 'GET_UPCOMING_TASKS',
          parameters: { rawInput: clause },
          confidence: 0.9,
        };
      }
      return {
        intent: 'LIST_TASKS',
        parameters: { rawInput: clause },
        confidence: 0.9,
      };
    }

    // 6. Navigation / View Switches
    if (/\b(?:take\s+me\s+to|navigate\s+to|open|go\s+to|show\s+me)\b/i.test(lower)) {
      if (lower.includes('today') || lower.includes('daily')) {
        return { intent: 'SHOW_TODAY', parameters: { page: '/today', rawInput: clause }, confidence: 0.95 };
      }
      if (lower.includes('week') || lower.includes('timetable') || lower.includes('calendar')) {
        return { intent: 'SHOW_WEEK', parameters: { page: '/week', rawInput: clause }, confidence: 0.95 };
      }
      if (lower.includes('analytics') || lower.includes('stats') || lower.includes('progress')) {
        return { intent: 'SHOW_ANALYTICS', parameters: { page: '/analytics', rawInput: clause }, confidence: 0.95 };
      }
      if (lower.includes('project') || lower.includes('work')) {
        return { intent: 'SHOW_PROJECTS', parameters: { page: '/work', rawInput: clause }, confidence: 0.95 };
      }
      if (lower.includes('study') || lower.includes('subjects')) {
        return { intent: 'SHOW_TASKS', parameters: { page: '/study', rawInput: clause }, confidence: 0.95 };
      }
    }

    // 7. Educational AI: Topic explanation, Quiz, Syllabus extraction
    if (/\b(?:explain|what\s+is|tell\s+me\s+about|teach\s+me|how\s+does)\b/i.test(lower) && !this.isTaskCreation(lower)) {
      const topic = this.extractExplanationTopic(clause);
      return {
        intent: 'EXPLAIN_TOPIC',
        parameters: { title: topic, query: topic, rawInput: clause },
        confidence: 0.85,
      };
    }

    if (/\b(?:quiz|test|mcq|questions?)\b/i.test(lower) && /\b(?:generate|create|make|give|start)\b/i.test(lower)) {
      const topic = this.extractTopicFromPrompt(clause, ['generate a quiz about', 'generate quiz on', 'create quiz for', 'quiz on', 'quiz about']);
      return {
        intent: 'GENERATE_QUIZ',
        parameters: { title: topic, subjectName: topic, rawInput: clause },
        confidence: 0.9,
      };
    }

    if (/\b(?:extract|parse|analyze)\b.*\b(?:syllabus|pdf|document)\b/i.test(lower)) {
      return {
        intent: 'EXTRACT_SYLLABUS',
        parameters: { rawInput: clause },
        confidence: 0.9,
      };
    }

    // 8. Project Creation
    if (/\b(?:create|add|start|new)\b.*\b(?:project|coursework)\b/i.test(lower)) {
      const projectData = this.extractProjectData(clause);
      return {
        intent: 'CREATE_PROJECT',
        parameters: {
          ...projectData,
          rawInput: clause,
        },
        confidence: 0.9,
      };
    }

    // 9. Subject Creation
    if (/\b(?:add|create|enroll\s+in)\b.*\b(?:subject|course)\b/i.test(lower)) {
      const title = this.extractTitleAfterWords(clause, ['add subject', 'create subject', 'enroll in subject', 'add course', 'create course']);
      return {
        intent: 'ADD_SUBJECT',
        parameters: { title, subjectName: title, rawInput: clause },
        confidence: 0.9,
      };
    }

    // 10. Replan / Schedule Generation
    if (/\b(?:replan|optimize\s+schedule|generate\s+timetable|fix\s+my\s+schedule)\b/i.test(lower)) {
      return {
        intent: 'REPLAN',
        parameters: { rawInput: clause },
        confidence: 0.9,
      };
    }

    // 11. Reminders & Task Creation (Default Action Workflow)
    const isReminder = /\b(?:remind|reminder|alert|notify)\b/i.test(lower);
    const hasTimeOrDate = this.containsTimeOrDateKeywords(lower);
    const hasTaskIntent = this.isTaskCreation(lower) || hasTimeOrDate || isReminder;

    if (hasTaskIntent) {
      const parsedTask = this.extractTaskDetails(clause, isReminder);
      const intent: AgentIntent = isReminder ? 'CREATE_REMINDER' : 'CREATE_TASK';

      return {
        intent,
        parameters: {
          ...parsedTask,
          reminder: isReminder,
          rawInput: clause,
        },
        confidence: 0.9,
      };
    }

    // Fallback: General Academic Question Answering
    return {
      intent: 'ANSWER_QUESTION',
      parameters: {
        query: clause,
        rawInput: clause,
      },
      confidence: 0.7,
    };
  }

  /**
   * Determine if the user is explicitly requesting a YouTube video or tutorial.
   */
  private static isExplicitYouTubeRequest(lower: string): boolean {
    // If it's explicitly "video editing class/session", that's a task, not a YouTube search
    if ((lower.includes('video editing') || lower.includes('video production')) && !lower.includes('find') && !lower.includes('search') && !lower.includes('tutorial') && !lower.includes('youtube')) {
      return false;
    }

    // Explicit regex patterns for finding videos/tutorials
    if (/\b(?:find|search|give\s+me|watch|look\s+up)\s+.*(?:video|tutorial|lecture|course)s?\b/i.test(lower)) {
      return true;
    }

    // Explicit keywords
    const triggers = [
      'youtube',
      'find me a video',
      'find a video',
      'find video',
      'search video',
      'youtube video',
      'youtube lecture',
      'youtube tutorial',
      'find me a tutorial',
      'find a tutorial',
      'search for tutorial',
      'search tutorials',
      'give me study videos',
      'study videos for',
      'video lectures for',
      'video lectures on',
    ];

    return triggers.some(t => lower.includes(t));
  }

  private static isTaskCreation(lower: string): boolean {
    return (
      /\b(?:schedule|create|add|set|put|book|plan|assign)\b.*\b(?:task|session|class|study|slot|assignment|event|meeting|lecture)\b/i.test(lower) ||
      /\b(?:i\s+have|i've\s+got)\b.*\b(?:class|session|meeting|exam|assignment|lab)\b/i.test(lower) ||
      /\b(?:remind\s+me|set\s+a\s+reminder)\b/i.test(lower)
    );
  }

  private static containsTimeOrDateKeywords(lower: string): boolean {
    return /\b(?:today|tomorrow|tonight|this\s+evening|morning|afternoon|\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}\s*(?:hours?|hrs?|mins?|minutes?)|from\s+\d{1,2}.*to\s+\d{1,2}|at\s+\d{1,2})\b/i.test(lower);
  }

  /**
   * Extract YouTube search query from clause.
   */
  private static extractSearchQuery(clause: string): string {
    return clause
      .replace(/find\s+(?:me\s+)?(?:a\s+)?(?:good\s+)?(?:youtube\s+)?/gi, '')
      .replace(/search\s+(?:for\s+)?(?:youtube\s+)?/gi, '')
      .replace(/give\s+me\s+(?:study\s+)?/gi, '')
      .replace(/(?:video|tutorial|lecture)s?\s*(?:about|on|for)?/gi, '')
      .replace(/youtube/gi, '')
      .replace(/[\.\?!,;]+$/, '')
      .trim() || 'Computer Science Tutorial';
  }

  /**
   * Extract explanation topic.
   */
  private static extractExplanationTopic(clause: string): string {
    return clause
      .replace(/explain\s+(?:to\s+me\s+)?(?:what\s+is\s+)?(?:the\s+concept\s+of\s+)?/gi, '')
      .replace(/what\s+is\s+/gi, '')
      .replace(/tell\s+me\s+about\s+/gi, '')
      .replace(/teach\s+me\s+/gi, '')
      .replace(/[\.\?!,;]+$/, '')
      .trim();
  }

  private static extractTopicFromPrompt(clause: string, prefixes: string[]): string {
    let text = clause;
    for (const p of prefixes) {
      const idx = text.toLowerCase().indexOf(p);
      if (idx !== -1) {
        text = text.substring(idx + p.length);
        break;
      }
    }
    return text.replace(/[\.\?!,;]+$/, '').trim() || 'General Studies';
  }

  /**
   * Extract Task details: Title, Date, Start Time, End Time, Duration, Priority.
   * Never invent default start/end times if not present.
   */
  private static extractTaskDetails(clause: string, isReminderRequested: boolean): Partial<ExtractedParameters> {
    const today = new Date();
    let scheduledDate = today.toISOString().split('T')[0];
    let startTime: string | undefined = undefined;
    let endTime: string | undefined = undefined;
    let estimatedMinutes = 45;
    let priority: 'urgent' | 'high' | 'medium' | 'low' = 'medium';
    let missingRequired: string[] = [];

    const lower = clause.toLowerCase();

    // 1. Date Extraction
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      scheduledDate = tomorrow.toISOString().split('T')[0];
    } else if (lower.includes('tonight') || lower.includes('this evening') || lower.includes('today')) {
      scheduledDate = today.toISOString().split('T')[0];
    } else {
      // Check day of week (e.g. "on Friday", "by Monday")
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
      };
      for (const [dayName, dayIndex] of Object.entries(dayMap)) {
        if (lower.includes(dayName)) {
          const currentDay = today.getDay();
          let diff = dayIndex - currentDay;
          if (diff <= 0) diff += 7;
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + diff);
          scheduledDate = targetDate.toISOString().split('T')[0];
          break;
        }
      }
    }

    // 2. Explicit Time Range Extraction (e.g. "from 8pm to 9pm", "from 20:00 to 21:00", "8:00 - 9:30 pm")
    const rangeMatch = lower.match(/(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    if (rangeMatch) {
      startTime = this.formatTo24Hour(rangeMatch[1]);
      endTime = this.formatTo24Hour(rangeMatch[2]);
      estimatedMinutes = this.calculateDurationMinutes(startTime, endTime);
    } else {
      // Single time match (e.g. "at 8pm", "to 9pm", "at 7:30 am", "for 7pm", "9pm")
      const singleTimeMatch = lower.match(/\b(?:at|by|for|to)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i) ||
        lower.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
      if (singleTimeMatch) {
        startTime = this.formatTo24Hour(singleTimeMatch[1]);
        const durationMatch = lower.match(/\b(?:for)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
        if (durationMatch) {
          const val = parseFloat(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          estimatedMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
        }
        endTime = this.addMinutesToTime(startTime, estimatedMinutes);
      } else {
        // Duration without specific start time (e.g. "Schedule 2 hours of DBMS")
        const durationMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
        if (durationMatch) {
          const val = parseFloat(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          estimatedMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
        }
      }
    }

    // If an explicit reminder was requested but NO time was specified, flag missing time
    if (isReminderRequested && !startTime) {
      missingRequired.push('time');
    }

    // 3. Priority Extraction
    if (lower.includes('urgent') || lower.includes('asap') || lower.includes('highest priority')) {
      priority = 'urgent';
    } else if (lower.includes('high priority') || lower.includes('important')) {
      priority = 'high';
    } else if (lower.includes('low priority')) {
      priority = 'low';
    }

    // 4. Clean Title Extraction
    let title = clause
      .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:i\s+have\s+|i've\s+got\s+)?/i, '')
      .replace(/^(?:create|schedule|add|set|plan)\s+(?:a\s+)?(?:task|session|reminder|event|focus\s+session)?(?:\s+called|\s+named)?\s+/i, '')
      .replace(/^(?:remind\s+me\s+(?:about|to|for)?)\s+/i, '')
      .replace(/\s+(?:from\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?).*/i, '')
      .replace(/\s+(?:at|by|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?.*/i, '')
      .replace(/\s+(?:today|tomorrow|tonight|this\s+evening|this\s+morning).*/i, '')
      .replace(/\s+(?:for\s+\d+\s*(?:hours?|hrs?|mins?|minutes?)).*/i, '')
      .replace(/[\.\?!,;]+$/, '')
      .trim();

    title = title.replace(/^(?:for|at|on|in|to|by)\s+/i, '').replace(/\s+(?:for|at|on|in|to|by)$/i, '').trim();

    const stopWords = ['for', 'to', 'at', 'on', 'in', 'a', 'an', 'the', 'my', 'me', 'task', 'session', 'event', 'tomorrow', 'today'];
    if (title.length === 0 || stopWords.includes(title.toLowerCase())) {
      missingRequired.push('title');
      title = 'Focus Session';
    } else {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    return {
      title,
      date: scheduledDate,
      startTime,
      endTime,
      estimatedMinutes,
      priority,
      type: lower.includes('assignment') ? 'assignment' : lower.includes('project') ? 'project' : 'study',
      missingRequired: missingRequired.length > 0 ? missingRequired : undefined,
    };
  }

  private static extractTaskTitleForAction(clause: string, stopPhrases: string[]): string {
    let clean = clause;
    for (const phrase of stopPhrases) {
      const idx = clean.toLowerCase().indexOf(phrase);
      if (idx !== -1) {
        clean = clean.substring(idx + phrase.length);
        break;
      }
    }
    return clean.replace(/^(?:task|the\s+task|assignment|the\s+assignment|project)\s+/i, '').replace(/[\.\?!,;]+$/, '').trim();
  }

  private static extractTitleAfterWords(clause: string, keywords: string[]): string {
    let text = clause;
    for (const kw of keywords) {
      const idx = text.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        text = text.substring(idx + kw.length);
        break;
      }
    }
    return text.replace(/[\.\?!,;]+$/, '').trim();
  }

  private static extractProjectData(clause: string): Partial<ExtractedParameters> {
    const title = this.extractTitleAfterWords(clause, ['create project', 'add project', 'start project', 'new project', 'create', 'add']);
    return {
      title: title || 'New Academic Project',
      type: 'project',
      priority: clause.toLowerCase().includes('high') ? 'high' : 'medium',
      estimatedMinutes: 480,
    };
  }

  private static formatTo24Hour(timeStr: string): string {
    const clean = timeStr.trim().toLowerCase();
    const isPM = clean.includes('pm');
    const isAM = clean.includes('am');
    const numericPart = clean.replace(/[^\d:]/g, '');

    let [hours, minutes] = numericPart.split(':').map(Number);
    if (isNaN(minutes)) minutes = 0;
    if (isNaN(hours)) hours = 12;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private static calculateDurationMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return Math.max(15, diff);
  }

  private static addMinutesToTime(start: string, mins: number): string {
    const [sh, sm] = start.split(':').map(Number);
    const totalMins = (sh * 60 + sm + mins) % (24 * 60);
    const eh = Math.floor(totalMins / 60);
    const em = totalMins % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }
}
