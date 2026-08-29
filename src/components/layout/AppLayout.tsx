import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { UrgentTaskModal } from '../shared/UrgentTaskModal';
import { AgentChatbot } from '../shared/AgentChatbot';
import { CommandPalette } from '../shared/CommandPalette';
import { FloatingStudyTimer } from '../shared/FloatingStudyTimer';
import { useAuth } from '../../context/AuthContext';
import { Bot, Sparkles, X } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [urgentModalOpen, setUrgentModalOpen] = useState(false);
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 relative">
      {/* Sidebar */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenUrgentModal={() => setUrgentModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenPomodoro={() => setIsPomodoroOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ openUrgentModal: () => setUrgentModalOpen(true) }} />
        </main>
      </div>

      {/* Floating AI Agent Chatbot Trigger & Window */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isAgentChatOpen && (
          <div className="mb-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <AgentChatbot isFloating={true} onClose={() => setIsAgentChatOpen(false)} />
          </div>
        )}

        <button
          onClick={() => setIsAgentChatOpen(prev => !prev)}
          className={`px-4 py-3 rounded-full shadow-2xl flex items-center gap-2.5 font-bold text-xs transition-all transform hover:scale-105 cursor-pointer ${
            isAgentChatOpen
              ? 'bg-slate-900 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/40 ring-4 ring-indigo-500/20'
          }`}
          title="Chat with Helix Planning Agent"
        >
          {isAgentChatOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>Close Assistant</span>
            </>
          ) : (
            <>
              <div className="relative">
                <Bot className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <span>Ask Helix Agent</span>
            </>
          )}
        </button>
      </div>

      {/* Shared Modals */}
      <UrgentTaskModal
        isOpen={urgentModalOpen}
        onClose={() => setUrgentModalOpen(false)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenPomodoro={() => setIsPomodoroOpen(true)}
        onOpenUrgentModal={() => setUrgentModalOpen(true)}
      />

      <FloatingStudyTimer
        isOpen={isPomodoroOpen}
        onClose={() => setIsPomodoroOpen(false)}
        userId={user?.id}
      />
    </div>
  );
};
