import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TaskService } from '../../services/taskService';
import { Play, Pause, RotateCcw, CheckCircle2, Clock, Zap } from 'lucide-react';

interface StudyTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskId?: string;
  targetMinutes?: number;
  onComplete?: (elapsedMinutes: number) => void;
}

export const StudyTimerModal: React.FC<StudyTimerModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  taskId,
  targetMinutes = 45,
  onComplete,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive && !isCompleted) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, isCompleted]);

  useEffect(() => {
    if (isOpen) {
      setSeconds(0);
      setIsActive(false);
      setIsCompleted(false);
    }
  }, [isOpen]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(0);
  };

  const handleFinishSession = async () => {
    setIsActive(false);
    setIsCompleted(true);
    const elapsedMins = Math.max(1, Math.round(seconds / 60));

    if (taskId) {
      await TaskService.updateTaskStatus(taskId, 'completed', 100);
    }

    if (onComplete) {
      onComplete(elapsedMins);
    }
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const targetSeconds = (targetMinutes || 45) * 60;
  const progressPercent = Math.min(100, Math.round((seconds / (targetSeconds || 1)) * 100));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Active Focus & Study Timer" size="md">
      <div className="text-center py-4 space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            Deep Work Focus Block
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-2 truncate px-4">
            {taskTitle || 'Study Session'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Target: {targetMinutes} minutes</p>
        </div>

        {/* Big Digital Timer Display */}
        <div className="relative w-48 h-48 mx-auto flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-slate-50 to-slate-100 border-4 border-indigo-500/20 shadow-inner">
          <div className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
            {formatTime(seconds)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {isActive ? '⚡ Session Active' : seconds > 0 ? '⏸ Paused' : 'Ready to Start'}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="max-w-xs mx-auto space-y-1">
          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {isCompleted && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Session complete! Actual duration recorded to database.</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={resetTimer}
            disabled={seconds === 0}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Reset
          </Button>

          <Button
            size="md"
            variant={isActive ? 'secondary' : 'primary'}
            onClick={toggleTimer}
            leftIcon={isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isActive ? 'Pause' : seconds > 0 ? 'Resume' : 'Start Focus Timer'}
          </Button>

          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleFinishSession}
            disabled={seconds < 5}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Complete Task
          </Button>
        </div>
      </div>
    </Modal>
  );
};
