import React, { useState, useEffect, useRef } from 'react';
import { TaskService } from '../../services/taskService';
import { fireConfetti } from '../../utils/confettiHelper';
import { useNotifications } from '../../context/NotificationContext';
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
  Minimize2,
  Maximize2,
  X,
  Move,
  BellRing,
  Timer,
  TimerReset,
  Flag,
  Save,
  Sliders
} from 'lucide-react';

interface FloatingStudyTimerProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const FloatingStudyTimer: React.FC<FloatingStudyTimerProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const { addReminder } = useNotifications();

  // Timer Type: Countdown vs Stopwatch
  const [timerType, setTimerType] = useState<'countdown' | 'stopwatch'>('countdown');

  // Countdown State
  const [customMinutes, setCustomMinutes] = useState<number>(25);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [totalInitialDuration, setTotalInitialDuration] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [customInputVal, setCustomInputVal] = useState<string>('25');

  // Stopwatch State
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(false);
  const [laps, setLaps] = useState<number[]>([]);

  // Ambient Sounds & Sessions
  const [activeSound, setActiveSound] = useState<'none' | 'rain' | 'whitenoise' | 'binaural'>('none');
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [isShrunk, setIsShrunk] = useState<boolean>(false);

  // Dragging State
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: window.innerWidth - 380,
    y: window.innerHeight - 560,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<any>(null);

  // Set Custom Countdown Duration
  const setCountdownDuration = (mins: number) => {
    const validMins = Math.max(1, Math.min(720, mins));
    setCustomMinutes(validMins);
    setTimeLeft(validMins * 60);
    setTotalInitialDuration(validMins * 60);
    setIsRunning(false);
  };

  const handleApplyCustomMinutes = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customInputVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setCountdownDuration(parsed);
      setShowCustomInput(false);
    }
  };

  // Alarm sound synthesis (Bright, melodic academic bell alarm)
  const playAlarmSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.3);
      });
    } catch (e) {
      console.warn('Alarm audio synthesis notice:', e);
    }
  };

  // Countdown Interval
  useEffect(() => {
    let interval: number | undefined;
    if (timerType === 'countdown' && isRunning && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timerType === 'countdown' && isRunning && timeLeft === 0) {
      setIsRunning(false);
      stopAmbientSound();
      playAlarmSound();
      fireConfetti(2500);

      addReminder(
        '🔔 Study Timer Finished!',
        `Your ${customMinutes}-minute focus session is complete. Great work!`
      );

      setCompletedSessions(prev => prev + 1);
      TaskService.createTask(userId || 'usr_local', {
        title: `Custom Focus Session (${customMinutes}m)`,
        estimatedMinutes: customMinutes,
        completedMinutes: customMinutes,
        type: 'study',
        status: 'completed',
        progress: 100,
      });
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isRunning, timeLeft, timerType, customMinutes, userId]);

  // Stopwatch Interval
  useEffect(() => {
    let interval: number | undefined;
    if (timerType === 'stopwatch' && isStopwatchRunning) {
      interval = window.setInterval(() => {
        setStopwatchSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isStopwatchRunning, timerType]);

  const handleLap = () => {
    setLaps(prev => [stopwatchSeconds, ...prev]);
  };

  const handleResetStopwatch = () => {
    setIsStopwatchRunning(false);
    setStopwatchSeconds(0);
    setLaps([]);
  };

  const handleLogStopwatchTime = async () => {
    const elapsedMins = Math.max(1, Math.round(stopwatchSeconds / 60));
    setIsStopwatchRunning(false);
    fireConfetti(1800);
    await TaskService.createTask(userId || 'usr_local', {
      title: `Stopwatch Study Block (${elapsedMins}m)`,
      estimatedMinutes: elapsedMins,
      completedMinutes: elapsedMins,
      type: 'study',
      status: 'completed',
      progress: 100,
    });
    addReminder(
      '⏱ Study Time Logged',
      `Successfully logged ${elapsedMins} minute(s) to your weekly hours & analytics.`
    );
    setCompletedSessions(prev => prev + 1);
  };

  // Ambient Audio
  const startAmbientSound = (soundType: 'rain' | 'whitenoise' | 'binaural') => {
    stopAmbientSound();
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

  const stopAmbientSound = () => {
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
      stopAmbientSound();
    } else {
      startAmbientSound(soundType);
    }
  };

  // Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - (isShrunk ? 240 : 360), dragRef.current.initialX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - (isShrunk ? 70 : 520), dragRef.current.initialY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isShrunk]);

  if (!isOpen) return null;

  // Format Display Strings
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalInitialDuration > 0
    ? ((totalInitialDuration - timeLeft) / totalInitialDuration) * 100
    : 0;

  const currentDisplayTime = timerType === 'countdown' ? formatTime(timeLeft) : formatTime(stopwatchSeconds);

  // Mini Shrunk / Floating Pill Mode
  if (isShrunk) {
    return (
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="fixed z-50 select-none shadow-2xl animate-in fade-in"
      >
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-950/85 text-white border border-indigo-500/40 shadow-[0_0_25px_rgba(99,102,241,0.35)] backdrop-blur-xl hover:border-indigo-400 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all">
          {/* Drag Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="cursor-move text-slate-400 hover:text-white p-0.5"
            title="Drag anywhere"
          >
            <Move className="w-3.5 h-3.5" />
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-1.5 font-mono text-sm font-black text-indigo-300">
            <span
              className={`w-2 h-2 rounded-full ${
                (timerType === 'countdown' ? isRunning : isStopwatchRunning)
                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span>{currentDisplayTime}</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase">
              {timerType === 'countdown' ? `${customMinutes}m` : 'SW'}
            </span>
          </div>

          {/* Play / Pause Quick Toggle */}
          <button
            onClick={timerType === 'countdown' ? () => setIsRunning(p => !p) : () => setIsStopwatchRunning(p => !p)}
            className="p-1.5 hover:bg-indigo-600/60 rounded-full text-white transition-all cursor-pointer shadow-[0_0_10px_rgba(99,102,241,0.4)]"
            title={(timerType === 'countdown' ? isRunning : isStopwatchRunning) ? 'Pause' : 'Start'}
          >
            {(timerType === 'countdown' ? isRunning : isStopwatchRunning) ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Expand Button */}
          <button
            onClick={() => setIsShrunk(false)}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Expand window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close Button */}
          <button
            onClick={() => {
              stopAmbientSound();
              onClose();
            }}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close timer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded Floating Window
  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 select-none shadow-2xl animate-in fade-in zoom-in-95"
    >
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-[350px] sm:w-[370px] p-5 shadow-2xl border border-slate-200 hover:border-indigo-400/60 hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] flex flex-col relative overflow-hidden transition-all duration-300">
        
        {/* Floating Draggable Header Bar */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-move"
          title="Click and drag to place anywhere on screen"
        >
          <div className="flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-indigo-600" />
              Study Timer & Stopwatch
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Shrink / Mini Mode Button */}
            <button
              onClick={() => setIsShrunk(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Shrink into mini floating bar"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                stopAmbientSound();
                onClose();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Hide timer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher: Countdown Timer vs Stopwatch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 mt-3 mb-2">
          <button
            onClick={() => setTimerType('countdown')}
            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              timerType === 'countdown'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Countdown Timer</span>
          </button>

          <button
            onClick={() => setTimerType('stopwatch')}
            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              timerType === 'stopwatch'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Stopwatch</span>
          </button>
        </div>

        {/* COUNTDOWN TIMER VIEW */}
        {timerType === 'countdown' && (
          <div className="space-y-3">
            {/* Quick Duration Presets */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[15, 25, 45, 60, 90].map(mins => (
                <button
                  key={mins}
                  onClick={() => {
                    setCountdownDuration(mins);
                    setShowCustomInput(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    customMinutes === mins && !showCustomInput
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  {mins}m
                </button>
              ))}

              <button
                onClick={() => setShowCustomInput(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 border transition-all cursor-pointer ${
                  showCustomInput
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
                title="Set custom duration"
              >
                Custom ⚙
              </button>
            </div>

            {/* Custom Minutes Input Drawer */}
            {showCustomInput && (
              <form onSubmit={handleApplyCustomMinutes} className="flex items-center gap-2 p-2 bg-indigo-50/70 border border-indigo-200 rounded-xl animate-in fade-in">
                <span className="text-xs font-bold text-indigo-900">Set minutes:</span>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={customInputVal}
                  onChange={e => setCustomInputVal(e.target.value)}
                  className="w-16 px-2 py-1 text-xs font-bold rounded-lg border border-indigo-300 bg-white text-slate-900 focus:outline-hidden"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Set
                </button>
              </form>
            )}

            {/* Circular Visual Countdown */}
            <div className="flex flex-col items-center justify-center my-1">
              <div className="relative w-36 h-36 rounded-full border-4 border-slate-100 flex items-center justify-center shadow-inner">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    className="stroke-indigo-600 transition-all duration-500"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={402.12}
                    strokeDashoffset={402.12 - (402.12 * progressPercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>

                <div className="text-center z-10">
                  <span className="font-mono text-3xl font-black text-slate-900 tracking-tight">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-0.5 uppercase tracking-wider">
                    {isRunning ? `🔥 ${customMinutes}m Focus` : 'Paused'}
                  </span>
                </div>
              </div>
            </div>

            {/* Countdown Action Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCountdownDuration(customMinutes)}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsRunning(prev => !prev)}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all transform hover:scale-105 flex items-center gap-1.5 cursor-pointer ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isRunning ? 'Pause' : 'Start Timer'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STOPWATCH VIEW */}
        {timerType === 'stopwatch' && (
          <div className="space-y-3 py-1">
            {/* Big Stopwatch Digital Display */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white text-center shadow-inner">
              <span className="font-mono text-4xl font-black text-indigo-300 tracking-wider block">
                {formatTime(stopwatchSeconds)}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
                {isStopwatchRunning ? '⏱ Counting Up (Active Study)' : 'Stopwatch Paused'}
              </span>
            </div>

            {/* Stopwatch Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleResetStopwatch}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Reset Stopwatch"
              >
                <TimerReset className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsStopwatchRunning(prev => !prev)}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all transform hover:scale-105 flex items-center gap-1.5 cursor-pointer ${
                  isStopwatchRunning
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                {isStopwatchRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isStopwatchRunning ? 'Pause' : 'Start'}</span>
              </button>

              <button
                onClick={handleLap}
                disabled={!isStopwatchRunning}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 transition-colors cursor-pointer"
                title="Record Lap"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>

            {/* Log Study Time Action */}
            {stopwatchSeconds > 10 && (
              <button
                onClick={handleLogStopwatchTime}
                className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                <span>Log {Math.max(1, Math.round(stopwatchSeconds / 60))}m to Weekly Hours</span>
              </button>
            )}

            {/* Recorded Laps */}
            {laps.length > 0 && (
              <div className="max-h-20 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                {laps.map((lap, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-bold">Lap {laps.length - i}</span>
                    <span className="font-mono font-bold text-slate-800">{formatTime(lap)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ambient Audio Synth Controls */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 mt-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-indigo-600" />
              <span>Ambient Study Audio:</span>
            </span>
            {activeSound !== 'none' && (
              <span className="text-[9px] font-bold text-emerald-600 animate-pulse">Playing</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'rain', label: 'Rain', icon: CloudRain },
              { id: 'whitenoise', label: 'White Noise', icon: Radio },
              { id: 'binaural', label: '40Hz Tone', icon: Brain },
            ].map(snd => {
              const Icon = snd.icon;
              const isPlaying = activeSound === snd.id;

              return (
                <button
                  key={snd.id}
                  onClick={() => toggleSound(snd.id as any)}
                  className={`p-1.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    isPlaying
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{snd.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400 mt-2">
          <span>🔔 Alarm chime upon finish</span>
          <span>{completedSessions} sessions logged today</span>
        </div>
      </div>
    </div>
  );
};
