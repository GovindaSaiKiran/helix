import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ScheduleSlot } from '../../types';
import { PriorityBadge } from './StatusBadge';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { AiService } from '../../services/aiService';
import {
  CheckCircle2,
  Play,
  Circle,
  Pause,
  Check,
  Trash2,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Lightbulb,
  GraduationCap
} from 'lucide-react';
import { clsx } from 'clsx';

export interface TimelineItemProps {
  slot: ScheduleSlot;
  onComplete?: (id: string, elapsedMinutes?: number) => void;
  onStart?: (id: string) => void;
  onPause?: (id: string, elapsedMinutes: number) => void;
  onDelete?: (id: string) => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ slot, onComplete, onStart, onPause, onDelete }) => {
  const isBreak = slot.category === 'break';
  const isCompleted = slot.status === 'completed';
  const isInProgress = slot.status === 'in_progress';

  const [activeSeconds, setActiveSeconds] = useState(0);
  const [showStudyContent, setShowStudyContent] = useState(false);
  const [studyContent, setStudyContent] = useState<{
    keyPoints: string[];
    simplifiedExplanation: string;
    fullExplanation: string;
    examTips: string[];
  } | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Auto-expand study content when task starts
  useEffect(() => {
    if (isInProgress) {
      setShowStudyContent(true);
    }
  }, [isInProgress]);

  // Load study content when expanded
  useEffect(() => {
    if (showStudyContent && !studyContent && !isBreak && !isLoadingContent) {
      const loadContent = async () => {
        setIsLoadingContent(true);
        try {
          const res = await AiService.generateTopicStudyContent(slot.title, slot.subjectName);
          setStudyContent(res);
        } catch (err) {
          console.warn('Failed to load study content for slot:', err);
        } finally {
          setIsLoadingContent(false);
        }
      };
      loadContent();
    }
  }, [showStudyContent, studyContent, slot.title, slot.subjectName, isBreak]);

  useEffect(() => {
    let interval: number | undefined;
    if (isInProgress) {
      interval = window.setInterval(() => {
        setActiveSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (interval) window.clearInterval(interval);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isInProgress]);

  // Reset local timer if task switches back to pending externally
  useEffect(() => {
    if (!isInProgress && !isCompleted && activeSeconds > 0) {
      setActiveSeconds(0);
    }
  }, [isInProgress, isCompleted]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePause = () => {
    const elapsedMinutes = Math.round(activeSeconds / 60);
    onPause?.(slot.id, elapsedMinutes);
    setActiveSeconds(0);
  };

  const handleComplete = () => {
    const elapsedMinutes = Math.round(activeSeconds / 60);
    try {
      import('../../utils/confettiHelper').then(({ fireConfetti }) => fireConfetti(2000));
    } catch (e) {
      // Ignore
    }
    onComplete?.(slot.id, elapsedMinutes);
    setActiveSeconds(0);
  };

  if (isBreak) {
    return (
      <div className="flex items-center gap-4 py-2.5 px-4 bg-slate-50/80 rounded-lg border border-slate-200/60 text-slate-500 text-xs">
        <span className="font-semibold text-slate-600 min-w-28">{slot.timeSlot}</span>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span>☕ {slot.title}</span>
          <span>({slot.durationMinutes} min)</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all duration-150 overflow-hidden',
        isInProgress
          ? 'bg-indigo-50/40 border-indigo-300 shadow-sm ring-2 ring-indigo-500/20'
          : isCompleted
          ? 'bg-slate-50/60 border-slate-200 opacity-75'
          : 'bg-white border-slate-200 hover:border-slate-300'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
        <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
          <button
            onClick={handleComplete}
            className="mt-0.5 sm:mt-0 text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
            title={isCompleted ? 'Completed' : 'Mark as complete'}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold text-slate-700">{slot.timeSlot}</span>
              <span className="text-xs text-slate-400">({slot.durationMinutes} min)</span>
              <PriorityBadge priority={slot.priority} />
              {slot.dueInfo && (
                <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                  {slot.dueInfo}
                </span>
              )}
              {isInProgress && (
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md animate-pulse flex items-center gap-1">
                  ⏱ {formatTime(activeSeconds)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h4
                className={clsx(
                  'text-sm font-semibold text-slate-900 truncate',
                  isCompleted && 'line-through text-slate-400'
                )}
              >
                {slot.title}
              </h4>
            </div>

            {slot.progress !== undefined && !isBreak && (
              <div className="mt-2 max-w-xs">
                <ProgressBar value={slot.progress} showPercentage size="xs" color="primary" />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
          {!isBreak && (
            <button
              onClick={() => {
                if (!showStudyContent) {
                  // Opening notes: automatically start timer if not already in progress
                  setShowStudyContent(true);
                  if (!isInProgress && !isCompleted) {
                    onStart?.(slot.id);
                  }
                } else {
                  // Closing notes: stop timer and save elapsed minutes
                  setShowStudyContent(false);
                  if (isInProgress) {
                    handlePause();
                  }
                }
              }}
              className={clsx(
                'px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border',
                showStudyContent
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              )}
              title="Toggle AI Study Notes (Tracks Active Study Time)"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{showStudyContent ? 'Hide Notes (Save)' : 'Study Notes'}</span>
              {showStudyContent ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {!isCompleted && !isInProgress && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              onClick={() => {
                onStart?.(slot.id);
                setShowStudyContent(true);
              }}
            >
              Start
            </Button>
          )}
          
          {isInProgress && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                leftIcon={<Pause className="w-3.5 h-3.5 fill-current" />}
                onClick={handlePause}
              >
                Stop
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700"
                leftIcon={<Check className="w-3.5 h-3.5" />}
                onClick={handleComplete}
              >
                Finish
              </Button>
            </>
          )}
          
          {onDelete && (
            <button
              onClick={() => onDelete(slot.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Module Study Content Panel */}
      {showStudyContent && !isBreak && (
        <div className="bg-slate-50/90 border-t border-indigo-100 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Module Study Material: {slot.title}
              </h5>
            </div>
            <NavLink
              to={`/study/topic/${encodeURIComponent(slot.title)}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <span>Open Interactive Study Room</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          {isLoadingContent ? (
            <div className="py-6 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Generating module explanation, analogies, and exam points with AI...
              </p>
            </div>
          ) : studyContent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Analogy & Intuition */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>Intuitive Analogy & Summary</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {studyContent.simplifiedExplanation}
                </p>
              </div>

              {/* Exam Focus Tips */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exam Focus & Key Tips</span>
                </div>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  {studyContent.examTips.map((tip, idx) => (
                    <li key={idx} className="leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>

              {/* Core Concepts */}
              <div className="md:col-span-2 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Key Principles & Definitions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {studyContent.keyPoints.map((point, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span className="leading-snug">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-2">
              Click &quot;Open Interactive Study Room&quot; above to load full notes, videos, and quizzes for this module.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
