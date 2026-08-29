import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Briefcase,
  BookOpen,
  Bot,
  BarChart3,
  Settings,
  Plus,
  Clock,
  Sun,
  Moon,
  Eye,
  ArrowRight,
  Sparkles,
  Zap,
  X
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPomodoro?: () => void;
  onOpenUrgentModal?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenPomodoro,
  onOpenUrgentModal,
}) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useAuth();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global keydown listener for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'dash',
      title: 'Go to Dashboard',
      subtitle: 'Course roadmap, daily sessions & active tasks',
      icon: LayoutDashboard,
      category: 'Navigation',
      perform: () => navigate('/dashboard'),
    },
    {
      id: 'today',
      title: 'Go to Today Focus View',
      subtitle: 'Your daily focus timeline & active sessions',
      icon: CalendarCheck,
      category: 'Navigation',
      perform: () => navigate('/today'),
    },
    {
      id: 'week',
      title: 'Go to Week Planner Grid',
      subtitle: 'Deterministic 7-day 24h capacity grid',
      icon: CalendarDays,
      category: 'Navigation',
      perform: () => navigate('/week'),
    },
    {
      id: 'work',
      title: 'Go to Work & Projects Hub',
      subtitle: 'Manage assignments, milestones & deliverables',
      icon: Briefcase,
      category: 'Navigation',
      perform: () => navigate('/work'),
    },
    {
      id: 'study',
      title: 'Go to Study Hub & Syllabus',
      subtitle: 'AI-generated syllabus notes & lecture videos',
      icon: BookOpen,
      category: 'Navigation',
      perform: () => navigate('/study'),
    },
    {
      id: 'agent',
      title: 'Open Planning Agent Hub',
      subtitle: 'Autonomous AI assistant with workspace control',
      icon: Bot,
      category: 'AI Assistant',
      perform: () => navigate('/planning-agent'),
    },
    {
      id: 'analytics',
      title: 'Go to Progress Analytics',
      subtitle: 'Study hours, topic mastery & quiz trends',
      icon: BarChart3,
      category: 'Navigation',
      perform: () => navigate('/analytics'),
    },
    {
      id: 'pomo',
      title: 'Start 25m Pomodoro Focus Session',
      subtitle: 'Scientific study timer with ambient audio',
      icon: Clock,
      category: 'Study Tools',
      perform: () => onOpenPomodoro?.(),
    },
    {
      id: 'urgent',
      title: 'Quick Schedule Urgent Task',
      subtitle: 'Add a high-priority deliverable with AI decomposition',
      icon: Plus,
      category: 'Actions',
      perform: () => onOpenUrgentModal?.(),
    },
    {
      id: 'theme_eye',
      title: 'Toggle Eye Comfort Protection',
      subtitle: 'Warm 2700K optical blue-light filter shield',
      icon: Eye,
      category: 'Appearance',
      perform: () => setTheme(theme === 'eye-comfort' ? 'light' : 'eye-comfort'),
    },
    {
      id: 'theme_dark',
      title: 'Toggle Dark / Light Mode',
      subtitle: 'Switch application color palette',
      icon: theme === 'dark' ? Sun : Moon,
      category: 'Appearance',
      perform: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
  ];

  const filtered = actions.filter(
    a =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-indigo-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search (e.g. 'study', 'pomodoro', 'week')..."
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
          />
          <kbd className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Action List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching actions found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    action.perform();
                    onClose();
                  }}
                  className="w-full p-3 rounded-xl hover:bg-indigo-50/80 flex items-center justify-between transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 transition-colors shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 truncate">
                        {action.title}
                      </p>
                      <p className="text-[11px] text-slate-400 group-hover:text-indigo-700 truncate">
                        {action.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700 shrink-0 ml-2">
                    {action.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-400 px-4">
          <span>Tip: Press <strong>⌘K</strong> anywhere to open this spotlight menu</span>
          <span><strong>↵</strong> to select</span>
        </div>
      </div>
    </div>
  );
};
