import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AgentExecutor, AgentExecutionResult } from '../../services/agent/agentExecutor';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../context/PlanContext';
import { YouTubeVideo } from '../../services/youtubeService';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Trash2,
  RefreshCw,
  Clock,
  BookOpen,
  User,
  Zap,
  Video,
  AlertTriangle,
  LogIn,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import { Button } from '../common/Button';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  toolResults?: AgentExecutionResult['toolResults'];
  trace?: AgentExecutionResult['trace'];
}

interface AgentChatbotProps {
  isFloating?: boolean;
  onClose?: () => void;
}

export const AgentChatbot: React.FC<AgentChatbotProps> = ({ isFloating = false, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const { refreshPlan } = usePlan();
  const navigate = useNavigate();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDebugTrace, setShowDebugTrace] = useState(false);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'agent',
      text: "👋 Hi! I'm Helix, your autonomous planning and study agent. I can directly schedule your focus sessions, find video lectures on YouTube, create academic projects, and manage your weekly timetable. What would you like me to do?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const toggleTrace = (msgId: string) => {
    setExpandedTraces(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputPrompt('');
    setIsProcessing(true);

    try {
      // Execute through Authoritative AgentExecutor Pipeline
      const executionResult = await AgentExecutor.execute(textToSend, {
        activeUserId: user?.id,
      });

      // If tasks were scheduled, refresh plan state
      if (executionResult.toolResults.some(t => t.type === 'task_created' || t.type === 'task_updated' || t.type === 'task_deleted')) {
        await refreshPlan();
      }

      // Handle automatic page navigation if requested
      const navItem = executionResult.toolResults.find(t => t.type === 'navigation');
      if (navItem && navItem.data?.page) {
        setTimeout(() => {
          navigate(navItem.data.page);
        }, 1200);
      }

      const agentMsg: ChatMessage = {
        id: `msg_agent_${Date.now()}`,
        sender: 'agent',
        text: executionResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolResults: executionResult.toolResults.length > 0 ? executionResult.toolResults : undefined,
        trace: executionResult.trace,
      };

      setMessages(prev => [...prev, agentMsg]);
    } catch (err: any) {
      console.warn('[AgentChatbot] Execution error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `msg_agent_err_${Date.now()}`,
          sender: 'agent',
          text: `I encountered an issue processing that: ${err.message}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDestructiveAction = async (action: 'delete_task' | 'delete_project' | 'delete_subject', targetId: string, msgId: string) => {
    setIsProcessing(true);
    try {
      const result = await AgentExecutor.execute('', {
        confirmedAction: { action, targetId },
        activeUserId: user?.id,
      });

      await refreshPlan();

      setMessages(prev => [
        ...prev,
        {
          id: `msg_agent_confirmed_${Date.now()}`,
          sender: 'agent',
          text: result.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolResults: result.toolResults,
          trace: result.trace,
        },
      ]);
    } catch (err: any) {
      console.warn('Confirmed action error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestionPills = [
    'I have video editing class from 8pm to 9pm today. Set a reminder for me.',
    'Create a task called DBMS assignment for tomorrow at 7pm',
    'Find me a YouTube tutorial about React hooks',
    'What tasks do I have today?',
    'Take me to my Week Timetable',
  ];

  return (
    <div className={`flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden ${isFloating ? 'h-[580px] w-[380px] sm:w-[420px]' : 'h-[680px] w-full'}`}>
      {/* Header */}
      <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white">Helix Productivity Agent</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                Action-Oriented
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Direct workspace execution & intelligent scheduler</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebugTrace(!showDebugTrace)}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
              showDebugTrace ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Observability Trace"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Trace</span>
          </button>

          {isFloating && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          const isTraceOpen = expandedTraces[msg.id] || showDebugTrace;

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Text Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-2xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Render Tool Action Cards */}
                {msg.toolResults && (
                  <div className="space-y-2 w-full">
                    {msg.toolResults.map((tr, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* Auth Required Notice Card */}
                        {tr.type === 'auth_required' && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <LogIn className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold">Authentication Required</span>
                            </div>
                            <Link
                              to="/login"
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                            >
                              Sign In →
                            </Link>
                          </div>
                        )}

                        {/* Task Created Card */}
                        {tr.type === 'task_created' && tr.data && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Task Scheduled & Persisted
                              </span>
                              <span className="text-[10px] font-semibold bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-800">
                                {tr.data.estimatedMinutes} mins
                              </span>
                            </div>
                            <p className="font-bold text-slate-900">{tr.data.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-emerald-700 pt-1">
                              <span>📅 {tr.data.scheduledDate} ({tr.data.scheduledStartTime}–{tr.data.scheduledEndTime})</span>
                              <button
                                onClick={() => navigate('/today')}
                                className="underline font-bold hover:text-emerald-900 cursor-pointer"
                              >
                                View in Timetable →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Task Completed / Updated Card */}
                        {tr.type === 'task_updated' && tr.data && (
                          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                              <span className="font-bold">{tr.data.title} marked completed</span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600">100% Done</span>
                          </div>
                        )}

                        {/* Confirmation Prompt for Destructive Actions */}
                        {tr.type === 'confirmation_required' && tr.confirmationPayload && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-2">
                            <div className="flex items-center gap-2 text-rose-800 font-bold">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                              <span>Confirmation Required</span>
                            </div>
                            <p className="text-[11px] text-rose-900">
                              Are you sure you want to delete <strong>"{tr.confirmationPayload.targetTitle}"</strong>?
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  handleConfirmDestructiveAction(
                                    tr.confirmationPayload!.action,
                                    tr.confirmationPayload!.targetId,
                                    msg.id
                                  )
                                }
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                              >
                                Confirm Delete
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Video Lectures Carousel */}
                        {tr.type === 'videos_found' && tr.videos && tr.videos.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                              <Video className="w-3.5 h-3.5 text-red-600" />
                              <span>YouTube Educational Lectures:</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {tr.videos.map(v => (
                                <a
                                  key={v.id}
                                  href={`https://www.youtube.com/watch?v=${v.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all flex items-center gap-2 group cursor-pointer"
                                >
                                  <img
                                    src={v.thumbnailUrl}
                                    alt={v.title}
                                    className="w-14 h-10 object-cover rounded-lg shrink-0 bg-slate-100"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600">
                                      {v.title}
                                    </p>
                                    <p className="text-[9px] text-slate-400 truncate">{v.channelTitle}</p>
                                  </div>
                                  <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Navigation Notice */}
                        {tr.type === 'navigation' && (
                          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center justify-between">
                            <span>🚀 Navigating to {tr.data?.page}...</span>
                            <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Developer Observability Trace (Collapsible) */}
                {msg.trace && (
                  <div className="w-full">
                    <button
                      onClick={() => toggleTrace(msg.id)}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>Execution Pipeline Trace</span>
                      {isTraceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isTraceOpen && (
                      <div className="mt-1 p-2.5 rounded-xl bg-slate-900 text-slate-200 text-[10px] font-mono space-y-1.5 border border-slate-800 shadow-inner">
                        <div>
                          <span className="text-indigo-400 font-bold">INTENT:</span> {msg.trace.intents.join(', ')}
                        </div>
                        {msg.trace.toolsExecuted.map((tool, tIdx) => (
                          <div key={tIdx} className="pl-2 border-l border-slate-700">
                            <span className="text-emerald-400 font-bold">TOOL:</span> {tool.toolName} ({tool.status})
                            {tool.resultSummary && <div className="text-slate-400">{tool.resultSummary}</div>}
                            {tool.error && <div className="text-rose-400">{tool.error}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <span className="text-[10px] text-slate-400 block px-1">
                  {msg.timestamp}
                </span>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs text-indigo-600 font-semibold w-fit animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Helix is executing verified actions...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Suggestion Pills */}
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] font-bold text-slate-400 shrink-0">Try:</span>
        {suggestionPills.map(pill => (
          <button
            key={pill}
            type="button"
            onClick={() => handleSendMessage(pill)}
            className="text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={e => setInputPrompt(e.target.value)}
          placeholder="Schedule a task, set a reminder, or ask to find study videos..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={!inputPrompt.trim() || isProcessing}
          leftIcon={<Send className="w-3.5 h-3.5" />}
        >
          Send
        </Button>
      </form>
    </div>
  );
};
