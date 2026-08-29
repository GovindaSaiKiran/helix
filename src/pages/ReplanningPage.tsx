import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PlanHealthBadge } from '../components/common/StatusBadge';
import { usePlan } from '../context/PlanContext';
import {
  Sparkles,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Plus,
  Zap,
} from 'lucide-react';

export const ReplanningPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProposal, applyReplan, triggerReplanAnalysis, schedule } = usePlan();
  const [isApplying, setIsApplying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleApply = async () => {
    if (!activeProposal) return;
    setIsApplying(true);
    try {
      await applyReplan(activeProposal.id);
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/today');
      }, 1200);
    } finally {
      setIsApplying(false);
    }
  };

  const handleSimulateUrgent = () => {
    triggerReplanAnalysis({
      id: `evt_sim_${Date.now()}`,
      title: 'Urgent Assignment Added (Midterm Prep)',
      type: 'urgent_task',
      urgency: 'urgent',
      remainingEffortHours: 2.5,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replanning View (Smart Adaptation)"
        subtitle="Deterministic conflict resolution & capacity balancing for urgent academic shifts."
        actions={
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Zap className="w-4 h-4" />}
            onClick={handleSimulateUrgent}
          >
            ⚡ Simulate Urgent Task
          </Button>
        }
      />

      {/* Signature Flow Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Helix Signature Adaptive Workflow</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-300">
          <span className="bg-rose-500/20 text-rose-300 px-2 py-1 rounded border border-rose-500/30">Urgent Change</span>
          <span>→</span>
          <span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30">Capacity Analysis</span>
          <span>→</span>
          <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded border border-amber-500/30">Conflict Detection</span>
          <span>→</span>
          <span className="bg-sky-500/20 text-sky-300 px-2 py-1 rounded border border-sky-500/30">Before/After Plan</span>
          <span>→</span>
          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/30">User Approval</span>
          <span>→</span>
          <span className="bg-white/20 text-white px-2 py-1 rounded">New Plan Version</span>
        </div>
      </div>

      {isSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Plan successfully updated! Optimized timetable version activated with zero capacity shortage.</span>
        </div>
      )}

      {!activeProposal ? (
        <Card className="py-16 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Your Plan is in Sync</h3>
            <p className="text-xs text-slate-500 mt-1">
              No schedule conflicts or capacity shortages detected. When an unexpected project or exam is added, Helix generates an optimized adaptation plan here.
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={handleSimulateUrgent} leftIcon={<Zap className="w-4 h-4" />}>
            Trigger Replanning Analysis
          </Button>
        </Card>
      ) : (
        <>
          {/* 3-Column Comparative View */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Current Plan (Before) */}
            <Card className="border-slate-200">
              <CardHeader className="bg-slate-50/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Before Adaptation
                  </span>
                  <CardTitle className="text-sm">Current Plan</CardTitle>
                </div>
                <Badge variant="danger">
                  {activeProposal.currentPlanSummary.healthStatus.toUpperCase()}
                </Badge>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  ⚠️ Shortage: {activeProposal.currentPlanSummary.shortageHours}h overload
                </div>
                {activeProposal.currentPlanSummary.slots.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span>{s.time}</span>
                      <span className="text-slate-400 font-normal">{s.duration}</span>
                    </div>
                    <p className="text-slate-900 font-semibold mt-1">{s.title}</p>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Column 2: Proposed Changes & Mitigation */}
            <Card className="border-indigo-200 bg-indigo-50/20">
              <CardHeader className="bg-indigo-50/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">
                    Algorithmic Actions
                  </span>
                  <CardTitle className="text-sm text-indigo-950">Proposed Changes</CardTitle>
                </div>
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </CardHeader>
              <CardBody className="space-y-3">
                {activeProposal.proposedActions.map(act => (
                  <div
                    key={act.id}
                    className="p-3 rounded-lg border border-indigo-100 bg-white text-xs flex items-start gap-2.5 shadow-2xs"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                    <div>
                      <p className="text-slate-900 font-semibold">{act.description}</p>
                      <span className="text-[10px] font-bold uppercase text-indigo-600 mt-1 block">
                        Action: {act.impactType}
                      </span>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Column 3: Proposed Plan (After) */}
            <Card className="border-emerald-200 bg-emerald-50/10">
              <CardHeader className="bg-emerald-50/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                    After Optimization
                  </span>
                  <CardTitle className="text-sm text-emerald-950">Proposed Plan</CardTitle>
                </div>
                <Badge variant="success">HEALTHY (0h SHORTAGE)</Badge>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  ✅ Capacity Balanced: {activeProposal.proposedPlanSummary.availableHours}h Available
                </div>
                {activeProposal.proposedPlanSummary.slots.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg border border-emerald-100 bg-white text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span>{s.time}</span>
                      <span className="text-slate-400 font-normal">{s.duration}</span>
                    </div>
                    <p className="text-slate-900 font-semibold mt-1">{s.title}</p>
                    {s.actionTag && (
                      <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 border border-emerald-100">
                        {s.actionTag}
                      </span>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>

          {/* User Approval Footer Bar */}
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Deterministic Schedule Guarantee</h4>
                  <p className="text-[11px] text-slate-500">
                    No academic deadlines will be breached. Applying replaces schedule with confirmed Version 2.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate('/today')}>
                  Dismiss Proposal
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApply}
                  isLoading={isApplying}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Approve & Apply New Schedule
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
