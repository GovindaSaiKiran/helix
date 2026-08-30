import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AgentExecutor, AgentExecutionResult } from '../../services/agent/agentExecutor';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../context/PlanContext';
import { YouTubeVideo } from '../../services/youtubeService';
import {
  Sparkles,
  Send,
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
  X,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

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
      text: "👋 Hi! I'm **Helix**, your autonomous study assistant. I can schedule your focus sessions, set reminder alerts, discover YouTube video lectures, and manage your weekly timetable. How can I help you today?",
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

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        sender: 'agent',
        text: "👋 Hi! I'm **Helix**, your autonomous study assistant. I can schedule your focus sessions, set reminder alerts, discover YouTube video lectures, and manage your weekly timetable. How can I help you today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
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

      // If tasks were scheduled or updated, refresh plan state
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

  const quickPrompts = [
    {
      icon: Calendar,
      title: 'Schedule Class',
      desc: 'Video editing class from 8pm to 9pm today',
      prompt: 'I have video editing class from 8pm to 9pm today. Set a reminder for me.',
    },
    {
      icon: Clock,
      title: 'Reschedule',
      desc: 'Move video editing class to 9pm',
      prompt: 'Reschedule video editing class to 9pm',
    },
    {
      icon: Video,
      title: 'Study Lectures',
      desc: 'Find tutorial for React hooks',
      prompt: 'Find me a YouTube tutorial about React hooks',
    },
    {
      icon: BookOpen,
      title: 'Check Today',
      desc: 'What tasks do I have today?',
      prompt: 'What tasks do I have today?',
    },
  ];

  return (
    <div className={`flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden transition-all duration-300 ${isFloating ? 'h-[600px] w-[390px] sm:w-[430px]' : 'h-[700px] w-full'}`}>
      {/* Gemini-Inspired Gradient Header */}
      <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          {/* Glowing AI Sparkle Avatar */}
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">Helix AI Assistant</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Autonomous Schedule & Productivity Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Clear Chat Button */}
          <button
            onClick={handleClearChat}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Clear Chat History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Observability Trace Toggle (Subtle & Unobtrusive) */}
          <button
            onClick={() => setShowDebugTrace(!showDebugTrace)}
            className={`p-2 rounded-xl text-xs transition-colors ${
              showDebugTrace ? 'bg-indigo-600/80 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Developer Execution Trace"
          >
            <Terminal className="w-4 h-4" />
          </button>

          {/* Floating Close Button */}
          {isFloating && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Stream Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/70">
        {/* Gemini Welcome Card when only 1 initial message */}
        {messages.length === 1 && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-100 space-y-3 mb-2">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span>Quick Actions & Prompts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickPrompts.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-indigo-400 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">{item.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          const isTraceOpen = expandedTraces[msg.id] || showDebugTrace;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-indigo-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Text Bubble */}
                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-xs shadow-md shadow-indigo-600/15'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Render Structured Result Cards */}
                {msg.toolResults && (
                  <div className="space-y-2 w-full">
                    {msg.toolResults.map((tr, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* Gemini-Style Elegant Auth Required Card */}
                        {tr.type === 'auth_required' && (
                          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <LogIn className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-indigo-950">Sign In to Unlock Helix</h4>
                                <p className="text-[11px] text-indigo-800">
                                  Sign in to enable autonomous scheduling, reminders, and video lecture discovery.
                                </p>
                              </div>
                            </div>
                            <Link
                              to="/login"
                              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0"
                            >
                              Sign In →
                            </Link>
                          </div>
                        )}

                        {/* Task Created Card */}
                        {tr.type === 'task_created' && tr.data && (
                          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs space-y-1.5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Task Scheduled & Persisted
                              </span>
                              <span className="text-[10px] font-bold bg-emerald-200/70 px-2 py-0.5 rounded-full text-emerald-900">
                                {tr.data.estimatedMinutes} mins
                              </span>
                            </div>
                            <p className="font-bold text-slate-900 text-sm">{tr.data.title}</p>
                            <div className="flex items-center justify-between text-[11px] text-emerald-700 pt-1 border-t border-emerald-200/60">
                              <span>📅 {tr.data.scheduledDate} {tr.data.scheduledStartTime ? `(${tr.data.scheduledStartTime}–${tr.data.scheduledEndTime})` : '(Flexible)'}</span>
                              <button
                                onClick={() => navigate('/today')}
                                className="underline font-bold hover:text-emerald-950 cursor-pointer"
                              >
                                View in Timetable →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Task Completed / Updated Card */}
                        {tr.type === 'task_updated' && tr.data && (
                          <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-xs flex items-center justify-between shadow-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                              <span className="font-bold">{tr.data.title} updated</span>
                            </div>
                            <button
                              onClick={() => navigate('/today')}
                              className="text-[11px] font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                            >
                              View Today →
                            </button>
                          </div>
                        )}

                        {/* Confirmation Prompt for Destructive Actions */}
                        {tr.type === 'confirmation_required' && tr.confirmationPayload && (
                          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-2.5 shadow-xs">
                            <div className="flex items-center gap-2 text-rose-800 font-bold">
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                              <span>Confirmation Required</span>
                            </div>
                            <p className="text-xs text-rose-900">
                              Are you sure you want to permanently delete <strong>"{tr.confirmationPayload.targetTitle}"</strong>?
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmDestructiveAction(
                                    tr.confirmationPayload!.action,
                                    tr.confirmationPayload!.targetId,
                                    msg.id
                                  )
                                }
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Video Lectures Carousel */}
                        {tr.type === 'videos_found' && tr.videos && tr.videos.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <Video className="w-4 h-4 text-red-600" />
                              <span>YouTube Educational Lectures:</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {tr.videos.map(v => (
                                <a
                                  key={v.id}
                                  href={`https://www.youtube.com/watch?v=${v.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md transition-all flex items-center gap-2.5 group cursor-pointer"
                                >
                                  <img
                                    src={v.thumbnailUrl}
                                    alt={v.title}
                                    className="w-14 h-11 object-cover rounded-xl shrink-0 bg-slate-100"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600">
                                      {v.title}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">{v.channelTitle}</p>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Navigation Notice */}
                        {tr.type === 'navigation' && (
                          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center justify-between">
                            <span>🚀 Navigating to {tr.data?.page}...</span>
                            <ArrowRight className="w-4 h-4 animate-pulse" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Developer Observability Trace (Collapsible & Unobtrusive) */}
                {msg.trace && showDebugTrace && (
                  <div className="w-full pt-1">
                    <button
                      onClick={() => toggleTrace(msg.id)}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>Pipeline Trace</span>
                      {isTraceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isTraceOpen && (
                      <div className="mt-1 p-3 rounded-2xl bg-slate-900 text-slate-200 text-[10px] font-mono space-y-1.5 border border-slate-800 shadow-inner">
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
                <div className="w-8 h-8 rounded-2xl bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-2xl border border-slate-200/90 text-xs text-indigo-600 font-semibold w-fit shadow-xs animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin text-purple-600" />
            <span>Helix is executing verified actions...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Gemini Floating Input Pill Container */}
      <div className="p-3 border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-inner"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            placeholder="Ask Helix to schedule a class, set a reminder, or find study videos..."
            className="flex-1 px-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isProcessing}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 disabled:hover:scale-100 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
