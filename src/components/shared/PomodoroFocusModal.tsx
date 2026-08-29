import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../common/Button';
import { TaskService } from '../../services/taskService';
import { fireConfetti } from '../../utils/confettiHelper';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Coffee,
  Brain,
  CloudRain,
  Radio,
  X
} from 'lucide-react';

interface PomodoroFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const PomodoroFocusModal: React.FC<PomodoroFocusModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [mode, setMode] = useState<'pomodoro' | 'shortBreak' | 'longBreak'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [activeSound, setActiveSound] = useState<'none' | 'rain' | 'whitenoise' | 'binaural'>('none');
  const [completedSessions, setCompletedSessions] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<any>(null);

  const MODE_TIMES = {
    pomodoro: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
  };

  useEffect(() => {
    setTimeLeft(MODE_TIMES[mode]);
    setIsRunning(false);
  }, [mode]);

  useEffect(() => {
    let interval: number | undefined;
    if (isRunning && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      stopSound();
      fireConfetti();
      if (mode === 'pomodoro') {
        setCompletedSessions(prev => prev + 1);
        TaskService.createTask(userId || 'usr_local', {
          title: `Pomodoro Focus Session (${mode})`,
          estimatedMinutes: 25,
          completedMinutes: 25,
          type: 'study',
          status: 'completed',
          progress: 100,
        });
      }
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, userId]);

  // Web Audio Synth for Ambient Study Sounds
  const startSound = (soundType: 'rain' | 'whitenoise' | 'binaural') => {
    stopSound();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      if (soundType === 'whitenoise' || soundType === 'rain') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = soundType === 'rain' ? 'lowpass' : 'bandpass';
        filter.frequency.value = soundType === 'rain' ? 800 : 1000;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.08;

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        noise.start();
        soundNodeRef.current = noise;
      } else if (soundType === 'binaural') {
        // 40Hz Gamma Focus Tone
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.value = 0.05;

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        soundNodeRef.current = osc;
      }
      setActiveSound(soundType);
    } catch (e) {
      console.warn('Audio synthesis notice:', e);
    }
  };

  const stopSound = () => {
    try {
      if (soundNodeRef.current) {
        soundNodeRef.current.stop?.();
        soundNodeRef.current.disconnect?.();
        soundNodeRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    } catch (e) {
      // Ignore
    }
    setActiveSound('none');
  };

  const toggleSound = (soundType: 'rain' | 'whitenoise' | 'binaural') => {
    if (activeSound === soundType) {
      stopSound();
    } else {
      startSound(soundType);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progressPercent = ((MODE_TIMES[mode] - timeLeft) / MODE_TIMES[mode]) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => {
            stopSound();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2">
            <Brain className="w-3.5 h-3.5" />
            <span>Deep Focus Pomodoro Companion</span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">Study Session Timer</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Boost academic retention with scientific 25-minute focus intervals.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-slate-100 mb-6">
          {[
            { id: 'pomodoro', label: '25m Focus', icon: Brain },
            { id: 'shortBreak', label: '5m Break', icon: Coffee },
            { id: 'longBreak', label: '15m Rest', icon: Sparkles },
          ].map(t => {
            const Icon = t.icon;
            const isSel = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMode(t.id as any)}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isSel
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Big Interactive Circular Timer Display */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative w-48 h-48 rounded-full border-8 border-slate-100 flex items-center justify-center shadow-inner">
            {/* SVG Radial Indicator */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                className="stroke-indigo-600 transition-all duration-500"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={552.92}
                strokeDashoffset={552.92 - (552.92 * progressPercent) / 100}
                strokeLinecap="round"
              />
            </svg>

            <div className="text-center z-10">
              <span className="font-mono text-4xl font-black text-slate-900 tracking-tight">
                {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
              </span>
              <span className="text-[11px] font-bold text-slate-400 block mt-1 uppercase tracking-wider">
                {isRunning ? (mode === 'pomodoro' ? '🔥 Focus Time' : '☕ Relaxing') : 'Paused'}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Timer Controls */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setTimeLeft(MODE_TIMES[mode])}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            title="Reset interval"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsRunning(prev => !prev)}
            className={`px-8 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 cursor-pointer ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
            }`}
          >
            {isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            <span>{isRunning ? 'Pause Focus' : 'Start Focus'}</span>
          </button>
        </div>

        {/* Ambient Study Sound Synthesizer */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ambient Study Audio:</span>
            </span>
            {activeSound !== 'none' && (
              <span className="text-[10px] font-bold text-emerald-600 animate-pulse">Playing</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'rain', label: 'Rain Drops', icon: CloudRain },
              { id: 'whitenoise', label: 'White Noise', icon: Radio },
              { id: 'binaural', label: '40Hz Focus', icon: Brain },
            ].map(snd => {
              const Icon = snd.icon;
              const isPlaying = activeSound === snd.id;

              return (
                <button
                  key={snd.id}
                  onClick={() => toggleSound(snd.id as any)}
                  className={`p-2 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{snd.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Completed Count */}
        <div className="text-center mt-4 text-xs text-slate-400 font-semibold">
          Completed Today: <strong className="text-indigo-600">{completedSessions} sessions</strong> (~{completedSessions * 25}m study)
        </div>
      </div>
    </div>
  );
};
