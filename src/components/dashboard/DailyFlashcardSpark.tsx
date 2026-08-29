import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { fireConfetti } from '../../utils/confettiHelper';
import {
  Sparkles,
  RotateCw,
  CheckCircle2,
  Brain,
  Zap,
  BookOpen,
  ArrowRight,
  Award
} from 'lucide-react';

interface FlashcardItem {
  id: string;
  subject: string;
  question: string;
  answer: string;
  highYieldTip: string;
}

const DEFAULT_FLASHCARDS: FlashcardItem[] = [
  {
    id: 'fc_1',
    subject: 'Operating Systems',
    question: 'What are the 4 necessary conditions for a Deadlock to occur?',
    answer: '1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait (Coffman Conditions).',
    highYieldTip: 'Standard university exam question! Remember: breaking ANY one condition prevents deadlocks.',
  },
  {
    id: 'fc_2',
    subject: 'Database Systems',
    question: 'What is the ACID principle in transactional databases?',
    answer: 'Atomicity (all or nothing), Consistency (preserves constraints), Isolation (concurrent safety), and Durability (permanent persistence).',
    highYieldTip: 'Always contrast 2PL (Two-Phase Locking) concurrency with ACID isolation levels.',
  },
  {
    id: 'fc_3',
    subject: 'Data Structures & Algorithms',
    question: 'What is the worst-case and average-case time complexity of QuickSort?',
    answer: 'Average case: O(N log N)\nWorst case: O(N²) (when pivot selection consistently yields unbalanced partitions).',
    highYieldTip: 'Randomized pivot selection or 3-way partitioning prevents O(N²) worst-case degradation.',
  },
  {
    id: 'fc_4',
    subject: 'Computer Networks',
    question: 'How does the TCP 3-Way Handshake establish a reliable connection?',
    answer: '1. Client sends SYN\n2. Server responds with SYN-ACK\n3. Client acknowledges with ACK (Connection Established).',
    highYieldTip: 'Notice: Both sequence numbers are synchronized and acknowledged simultaneously.',
  },
];

export const DailyFlashcardSpark: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);

  const card = DEFAULT_FLASHCARDS[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % DEFAULT_FLASHCARDS.length);
    }, 150);
  };

  const handleMastered = () => {
    fireConfetti(1800);
    setEarnedXp(prev => prev + 15);
    setMasteredCount(prev => prev + 1);
    handleNext();
  };

  return (
    <Card className="p-6 bg-linear-to-br from-indigo-900 via-slate-900 to-slate-950 text-white border-indigo-800 shadow-xl overflow-hidden relative">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">Daily Memory Spark (Active Recall)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                +15 XP
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Daily high-yield flashcard micro-review</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-amber-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-current" />
            {earnedXp} XP Today
          </span>
        </div>
      </div>

      {/* Interactive Card Body */}
      <div className="py-6 relative z-10">
        <div
          onClick={() => setIsFlipped(prev => !prev)}
          className="min-h-[140px] p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-md">
                {card.subject}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 group-hover:text-indigo-300 transition-colors">
                <RotateCw className="w-3 h-3" />
                {isFlipped ? 'Click to show question' : 'Click to reveal answer'}
              </span>
            </div>

            {!isFlipped ? (
              <p className="text-base font-bold text-slate-100 leading-snug pt-1">
                {card.question}
              </p>
            ) : (
              <div className="space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <p className="text-sm font-semibold text-emerald-300 whitespace-pre-line leading-relaxed">
                  {card.answer}
                </p>
                <p className="text-[11px] text-slate-400 italic bg-black/20 p-2 rounded-lg border border-white/5">
                  💡 {card.highYieldTip}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Action Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 relative z-10">
        <span className="text-xs text-slate-400">
          Card {currentIndex + 1} of {DEFAULT_FLASHCARDS.length} ({masteredCount} Mastered)
        </span>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={handleNext}
          >
            Skip / Next
          </Button>

          <Button
            size="xs"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={handleMastered}
          >
            I Got It! (+15 XP)
          </Button>
        </div>
      </div>
    </Card>
  );
};
