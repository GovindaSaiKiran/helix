import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { AgentChatbot } from '../components/shared/AgentChatbot';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { usePlan } from '../context/PlanContext';
import { Bot, Sparkles, CheckCircle2, Video, Calendar, Layers, ShieldCheck, Zap } from 'lucide-react';

export const PlanningAgentPage: React.FC = () => {
  const { planHealth, schedule } = usePlan();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Autonomous Planning & Study Agent"
        subtitle="Conversational AI agent that schedules tasks, searches lecture videos, and manages course projects with direct workspace execution."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Autonomous Chatbot Interface (8 cols) */}
        <div className="lg:col-span-8">
          <AgentChatbot isFloating={false} />
        </div>

        {/* Agent Overview & Workspace Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Live Planner Health Card */}
          <Card className="p-5 space-y-3 bg-indigo-50/60 border-indigo-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm text-indigo-950">Active Workspace Sync</h3>
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Helix Agent has live read and write permissions to your timetable, courses, YouTube search API, and local storage.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-200/60">
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="text-[10px] text-slate-400 font-bold block">Available Capacity</span>
                <span className="text-sm font-extrabold text-indigo-600">{planHealth.totalAvailableHours}h / day</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="text-[10px] text-slate-400 font-bold block">Focus Sessions</span>
                <span className="text-sm font-extrabold text-slate-800">{schedule.length} active</span>
              </div>
            </div>
          </Card>

          {/* Capabilities List */}
          <Card className="p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Agent Capabilities & Tools
            </h4>
            <div className="space-y-2.5">
              {[
                {
                  icon: Calendar,
                  title: 'Autonomous Scheduling',
                  desc: 'Ask to schedule study sessions, assign deadlines, and adjust focus blocks.',
                },
                {
                  icon: Video,
                  title: 'YouTube Lecture Discovery',
                  desc: 'Search for curated video lectures and tutorials directly from chat.',
                },
                {
                  icon: Layers,
                  title: 'Project & Milestone Planning',
                  desc: 'Create multi-phase coding projects and coursework assignments.',
                },
                {
                  icon: Zap,
                  title: 'Workspace Navigation',
                  desc: 'Command the agent to jump straight to Week, Today, Study, or Work hub.',
                },
              ].map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="p-1.5 rounded-md bg-white text-indigo-600 shadow-2xs shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">{cap.title}</h5>
                      <p className="text-[11px] text-slate-500">{cap.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
