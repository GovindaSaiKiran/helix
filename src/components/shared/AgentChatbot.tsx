import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiService } from '../../services/aiService';
import { TaskService } from '../../services/taskService';
import { ProjectService } from '../../services/projectService';
import { SubjectService } from '../../services/subjectService';
import { YouTubeService, YouTubeVideo } from '../../services/youtubeService';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { usePlan } from '../../context/PlanContext';
import {
  Bot,
  Send,
  Sparkles,
  Play,
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
  Plus
} from 'lucide-react';
import { Button } from '../common/Button';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  toolResults?: {
    type: 'task_created' | 'videos_found' | 'project_created' | 'deleted' | 'navigation' | 'info';
    data?: any;
    videos?: YouTubeVideo[];
  }[];
}

interface AgentChatbotProps {
  isFloating?: boolean;
  onClose?: () => void;
}

export const AgentChatbot: React.FC<AgentChatbotProps> = ({ isFloating = false, onClose }) => {
  const { user } = useAuth();
  const { addReminder } = useNotifications();
  const { refreshPlan } = usePlan();
  const navigate = useNavigate();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
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
      // 1. Gather context
      const [subjects, existingTasks] = await Promise.all([
        SubjectService.getSubjects(user?.id),
        TaskService.getTasks(user?.id),
      ]);

      const context = {
        subjects: subjects.map(s => s.name),
        existingTasks: existingTasks.map(t => t.title),
        currentDate: new Date().toISOString().split('T')[0],
      };

      // 2. Call AI Agent action processor
      const agentAction = await AiService.processAgentAction(textToSend, context);
      const toolResults: ChatMessage['toolResults'] = [];

      // 3. Execute tools requested by AI Agent
      if (agentAction.toolCalls && agentAction.toolCalls.length > 0) {
        for (const call of agentAction.toolCalls) {
          if (call.tool === 'create_task') {
            const { title, estimatedMinutes, priority, type, scheduledDate } = call.parameters;
            const newTask = await TaskService.createTask(
              user?.id || 'usr_local',
              {
                title: title || 'Study Session',
                estimatedMinutes: Number(estimatedMinutes) || 45,
                priority: priority || 'medium',
                type: type || 'study',
                scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
                status: 'pending',
                progress: 0,
              }
            );
            if (newTask) {
              await addReminder('⚡ Task Scheduled by Helix Agent', `Added "${newTask.title}" to your focus timetable.`);
              await refreshPlan();
              toolResults.push({
                type: 'task_created',
                data: newTask,
              });
            }
          } else if (call.tool === 'search_videos') {
            const { query, maxResults } = call.parameters;
            let videosList: YouTubeVideo[] = [];
            if (YouTubeService.hasApiKey()) {
              videosList = await YouTubeService.searchStudyVideos(query || textToSend, maxResults || 4);
            }
            toolResults.push({
              type: 'videos_found',
              data: { query: query || textToSend },
              videos: videosList,
            });
          } else if (call.tool === 'create_project') {
            const { title, category, priority, estimatedEffortHours, dueDate } = call.parameters;
            const newProject = await ProjectService.createProject(
              user?.id || 'usr_local',
              {
                title: title || 'New Course Project',
                category: category || 'project',
                priority: priority || 'medium',
                status: 'pending',
                progress: 0,
                estimatedEffortHours: Number(estimatedEffortHours) || 8,
                remainingEffortHours: Number(estimatedEffortHours) || 8,
                dueDate: dueDate || 'Next Week',
                dependencies: [],
                modules: [],
              }
            );
            if (newProject) {
              await addReminder('📁 Project Created', `Created "${newProject.title}" in your Work hub.`);
              toolResults.push({
                type: 'project_created',
                data: newProject,
              });
            }
          } else if (call.tool === 'navigate') {
            const { page } = call.parameters;
            toolResults.push({
              type: 'navigation',
              data: { page },
            });
            if (page) {
              setTimeout(() => {
                navigate(page);
              }, 1200);
            }
          }
        }
      }

      // 4. Add agent reply to message stream
      const agentMsg: ChatMessage = {
        id: `msg_agent_${Date.now()}`,
        sender: 'agent',
        text: agentAction.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      };

      setMessages(prev => [...prev, agentMsg]);
    } catch (err: any) {
      console.warn('Agent message error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `msg_agent_err_${Date.now()}`,
          sender: 'agent',
          text: `I encountered an issue processing that: ${err.message}. Please try again or ask me to schedule a task or search videos!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestionPills = [
    'Schedule a 2 hour study session for Database Systems today',
    'Find YouTube lectures for Operating Systems Deadlocks',
    'Create an assignment for Machine Learning Lab due Friday',
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
              <span className="font-bold text-sm text-white">Helix Planning Agent</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                Autonomous
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Direct workspace control & AI planner</p>
          </div>
        </div>

        {isFloating && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';

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

                {/* Render Tool Results (e.g. Scheduled Tasks, Video Recommendations, Projects) */}
                {msg.toolResults && (
                  <div className="space-y-2 w-full">
                    {msg.toolResults.map((tr, idx) => (
                      <div key={idx} className="space-y-2">
                        {/* Task Created Card */}
                        {tr.type === 'task_created' && tr.data && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Task Scheduled
                              </span>
                              <span className="text-[10px] font-semibold bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-800">
                                {tr.data.estimatedMinutes} mins
                              </span>
                            </div>
                            <p className="font-bold text-slate-900">{tr.data.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-emerald-700 pt-1">
                              <span>📅 Scheduled: {tr.data.scheduledDate}</span>
                              <button
                                onClick={() => navigate('/today')}
                                className="underline font-bold hover:text-emerald-900 cursor-pointer"
                              >
                                View in Timetable →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Project Created Card */}
                        {tr.type === 'project_created' && tr.data && (
                          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5 text-indigo-800">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                Project Added to Work Hub
                              </span>
                              <span className="text-[10px] font-semibold bg-indigo-200/60 px-1.5 py-0.5 rounded text-indigo-800">
                                {tr.data.estimatedEffortHours} hrs
                              </span>
                            </div>
                            <p className="font-bold text-slate-900">{tr.data.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-indigo-700 pt-1">
                              <span>Due: {tr.data.dueDate}</span>
                              <button
                                onClick={() => navigate(`/work/${tr.data.id}`)}
                                className="underline font-bold hover:text-indigo-900 cursor-pointer"
                              >
                                Open Project →
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Video Lectures Carousel */}
                        {tr.type === 'videos_found' && tr.videos && tr.videos.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                              <Video className="w-3.5 h-3.5 text-red-600" />
                              <span>YouTube Study Recommendations:</span>
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
            <span>Helix is processing instructions & executing actions...</span>
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
          placeholder="Ask Helix to schedule tasks, search videos, or plan projects..."
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
