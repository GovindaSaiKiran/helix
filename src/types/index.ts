// HELIX Core Type Definitions

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';
export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'rescheduled' | 'cancelled';
export type PlanHealthStatus = 'healthy' | 'tight' | 'at_risk' | 'overloaded';
export type NotificationChannel = 'in_app' | 'fcm';

export type AppTheme = 'light' | 'dark' | 'eye-comfort';
export type EnergyPeak = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeSlotWindow {
  id: string;
  startTime: string; // "09:00"
  endTime: string;   // "13:00"
  label?: string;    // "Deep Focus Slot"
}

export interface DayPreference {
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  isEnabled: boolean;
  availableHours: number; // 0 to 24
  energyProfile: EnergyPeak;
  selectedHourBlocks: number[]; // Array of hours 0-23 selected
  timeSlots?: TimeSlotWindow[];
  notes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  course: string;
  stream: string;
  year: string;
  enrolledSubjects: string[];
  theme: AppTheme;
  eyeComfortWarmth?: number; // 0-100% warmth intensity
  reminderTimings: ('10_min' | '30_min' | 'at_start' | '1_hour')[];
  notificationPreferences: {
    inApp: boolean;
    fcmPush: boolean;
  };
  dayPreferences?: DayPreference[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  color: string;
  syllabusCoverage: number; // percentage 0-100
  totalUnits: number;
  completedUnits: number;
  targetGrade?: string;
  priority?: PriorityLevel;
}

export interface SyllabusTopic {
  id: string;
  unitId: string;
  title: string;
  description: string;
  order: number;
  status: ItemStatus;
  progress: number; // percentage 0-100
  estimatedMinutes: number;
  masteryScore?: number; // percentage 0-100
  keyPoints?: string[];
  simplifiedExplanation?: string;
  fullExplanation?: string;
  examples?: string[];
  examTips?: string[];
  youtubeRecommendations?: {
    id: string;
    title: string;
    channelName: string;
    duration: string;
    thumbnailUrl: string;
    url: string;
  }[];
}

export interface SyllabusUnit {
  id: string;
  subjectId: string;
  unitNumber: number;
  title: string;
  progress: number; // percentage 0-100
  status: ItemStatus;
  topics: SyllabusTopic[];
}

export interface StudyMaterial {
  id: string;
  subjectId: string;
  topicId?: string;
  title: string;
  fileType: 'pdf' | 'notes' | 'slides' | 'summary';
  fileSize: string;
  uploadedAt: string;
  fileUrl?: string;
  analysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';
  roadmapGenerated?: boolean;
}

export interface MCQOption {
  id: string;
  text: string;
}

export interface MCQQuestion {
  id: string;
  materialId: string;
  subjectId: string;
  questionText: string;
  options: MCQOption[];
  correctOptionId: string;
  explanation: string;
}

export interface MCQResult {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
}

export interface RoadmapModule {
  id: string;
  materialId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  subjectId?: string;
  projectId?: string;
  type: 'study' | 'assignment' | 'project' | 'revision' | 'quiz' | 'break';
  priority: PriorityLevel;
  status: ItemStatus;
  estimatedMinutes: number;
  completedMinutes: number;
  dueDate?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledStartTime: string; // HH:mm (24h)
  scheduledEndTime: string; // HH:mm (24h)
  isUrgent?: boolean;
  progress: number; // percentage 0-100
  difficulty?: 'easy' | 'medium' | 'hard';
  notes?: string;
}

export interface ProjectModule {
  id: string;
  name: string;
  progress: number;
  status: ItemStatus;
  estimatedHours: number;
}

export interface Project {
  id: string;
  title: string;
  category: 'assignment' | 'project' | 'goal' | 'exam_prep';
  priority: PriorityLevel;
  status: ItemStatus;
  progress: number; // percentage 0-100
  dueDate: string;
  createdDate: string;
  estimatedEffortHours: number;
  remainingEffortHours: number;
  dependencies?: string[];
  modules: ProjectModule[];
  notes?: string;
}

export interface Goal {
  id: string;
  title: string;
  targetDate: string;
  progress: number;
  type: 'academic' | 'skill' | 'exam';
  description: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  topicId: string;
}

export interface Quiz {
  id: string;
  title: string;
  subjectId: string;
  topicId: string;
  topicName: string;
  totalQuestions: number;
  durationMinutes: number;
  questions: QuizQuestion[];
}

export interface QuizResult {
  id: string;
  quizId: string;
  quizTitle: string;
  topicName: string;
  score: number;
  totalScore: number;
  percentage: number;
  status: 'passed' | 'needs_revision';
  strongTopics: string[];
  needsRevisionTopics: string[];
  recommendedAction: string;
  completedAt: string;
  userAnswers: {
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }[];
}

export interface ScheduleSlot {
  id: string;
  timeSlot: string; // e.g. "5:00 PM - 5:45 PM"
  startTime: string; // "17:00"
  endTime: string; // "17:45"
  durationMinutes: number;
  title: string;
  category: 'study' | 'assignment' | 'project' | 'break';
  subjectName?: string;
  priority: PriorityLevel;
  difficulty?: 'easy' | 'medium' | 'hard';
  progress: number;
  status: ItemStatus;
  dueInfo?: string;
}

export interface AvailabilityWindow {
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  availableHours: number;
  plannedHours: number;
  bufferHours: number;
  energyProfile: EnergyPeak;
  selectedHourBlocks?: number[];
}

export interface PlanVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  availableHours: number;
  plannedHours: number;
  bufferHours: number;
  healthStatus: PlanHealthStatus;
  healthPercentage: number;
  reason: string;
  appliedChanges: string[];
}

export interface ReplanningEvent {
  id: string;
  title: string;
  type: 'urgent_project' | 'exam_announced' | 'sick_day' | 'missed_deadline';
  urgency: PriorityLevel;
  deadlineDays: number;
  complexity: 'easy' | 'medium' | 'hard';
  progress: number;
  remainingEffortHours: number;
}

export interface ReplanningProposal {
  id: string;
  eventId: string;
  eventSummary: ReplanningEvent;
  currentPlanSummary: {
    availableHours: number;
    requiredHours: number;
    shortageHours: number;
    healthStatus: PlanHealthStatus;
    slots: { time: string; title: string; duration: string }[];
  };
  proposedPlanSummary: {
    availableHours: number;
    requiredHours: number;
    shortageHours: number;
    healthStatus: PlanHealthStatus;
    slots: { time: string; title: string; duration: string; actionTag?: string }[];
  };
  proposedActions: {
    id: string;
    description: string;
    impactType: 'postpone' | 'reduce' | 'allocate' | 'protect';
  }[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  type: 'reminder' | 'deadline' | 'replan' | 'achievement';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface ProgressAnalyticsData {
  totalStudyHours: number;
  studyHoursChangePercent: number;
  tasksCompleted: number;
  tasksCompletedChangePercent: number;
  syllabusCoveragePercent: number;
  syllabusCoverageChangePercent: number;
  quizAveragePercent: number;
  quizAverageChangePercent: number;
  subjectProgress: {
    subjectId: string;
    subjectName: string;
    progressPercent: number;
    color: string;
  }[];
  masteryBreakdown: {
    strongPercent: number;
    mediumPercent: number;
    needsRevisionPercent: number;
    overallAveragePercent: number;
  };
}
