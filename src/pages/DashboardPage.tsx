import React, { useState, useEffect } from 'react';
import { NavLink, useOutletContext } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  BookOpen,
  Briefcase,
  Layers,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/common/MetricCard';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { TimelineItem } from '../components/common/TimelineItem';
import { DonutChart } from '../components/charts/DonutChart';
import { usePlan } from '../context/PlanContext';
import { useAuth } from '../context/AuthContext';
import { SubjectService } from '../services/subjectService';
import { ProjectService } from '../services/projectService';
import { Subject, Project } from '../types';
import { SubjectModal } from '../components/shared/SubjectModal';
import { TaskModal } from '../components/shared/TaskModal';
import { ProjectModal } from '../components/shared/ProjectModal';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { schedule, planHealth, completeTask, startTask, pauseTask, removeTask, refreshPlan } = usePlan();
  const { openUrgentModal } = useOutletContext<{ openUrgentModal: () => void }>();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | 'all'>('all');
  const [recommendationMessage, setRecommendationMessage] = useState<string | null>(null);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const displayedSchedule = selectedSubjectId === 'all'
    ? schedule
    : schedule.filter(s => {
        const matchingSubject = subjects.find(sub => sub.id === selectedSubjectId);
        return s.subjectName?.toLowerCase() === matchingSubject?.name.toLowerCase() ||
               s.title.toLowerCase().includes(matchingSubject?.name.toLowerCase() || '') ||
               (s as any).subjectId === selectedSubjectId;
      });

  const loadDashboardData = async () => {
    if (!user) return;
    const [subs, projs] = await Promise.all([
      SubjectService.getSubjects(user.id),
      ProjectService.getProjects(user.id),
    ]);
    setSubjects(subs);
    setProjects(projs);
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  // Explainable "What Should I Do Now?" recommendation algorithm
  const handleWhatShouldIDo = () => {
    const unfinished = schedule.filter(s => s.status !== 'completed');
    if (unfinished.length === 0) {
      if (subjects.length === 0) {
        setRecommendationMessage(
          '💡 Helix Recommendation: You have a clean slate! Start by adding your enrolled subjects so Helix can map your syllabus and generate study tasks.'
        );
      } else {
        setRecommendationMessage(
          '💡 Helix Recommendation: All planned tasks for today are complete! You have free buffer capacity. Consider reviewing upcoming topics or resting.'
        );
      }
      return;
    }

    const nextSlot = unfinished[0];
    setRecommendationMessage(
      `💡 Helix Recommendation: High focus priority. Start with "${nextSlot.title}" (${nextSlot.durationMinutes} min) now to maintain your ${planHealth.label} plan health.`
    );
  };

  const completedCount = schedule.filter(s => s.status === 'completed').length;
  const totalTasks = schedule.length;
  const nextUp = schedule.find(s => s.status !== 'completed');

  const donutSegments = subjects.length > 0
    ? subjects.map(s => ({
        label: s.name,
        value: s.syllabusCoverage || 10,
        color: s.color || '#6366F1',
      }))
    : [{ label: 'Empty State', value: 100, color: '#E2E8F0' }];

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <PageHeader
        title={`Good day, ${user?.name || 'Student'}! 👋`}
        subtitle="Here's what matters today across your syllabus, deadlines, and project milestones."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsTaskModalOpen(true)}
            >
              Add Task
            </Button>
            <NavLink to="/replanning">
              <Button size="sm" variant="subtle" leftIcon={<Zap className="w-4 h-4 text-indigo-600" />}>
                Replan Schedule
              </Button>
            </NavLink>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Today's Focus"
          value={totalTasks > 0 ? `${completedCount} / ${totalTasks}` : '0 scheduled'}
          subtitle={totalTasks > 0 ? 'Tasks scheduled for today' : 'No tasks scheduled today'}
          icon={<CalendarCheck className="w-5 h-5 text-indigo-600" />}
        />

        <MetricCard
          title="Next Focus Task"
          value={nextUp ? nextUp.title : 'All caught up'}
          subtitle={nextUp ? `${nextUp.durationMinutes} min session` : 'No pending sessions'}
          icon={<Clock className="w-5 h-5 text-sky-600" />}
        />

        <MetricCard
          title="Active Projects"
          value={`${projects.length}`}
          subtitle={projects.length > 0 ? `${projects.filter(p => p.status === 'in_progress').length} in progress` : '0 active milestones'}
          icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Explainable AI / Rule Recommendation Alert */}
      {recommendationMessage && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <Zap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{recommendationMessage}</p>
          </div>
          <button
            onClick={() => setRecommendationMessage(null)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Enrolled Subjects & Today's Schedule (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Enrolled Subjects Summary (Moved to Top for Fast Subject Switching) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Enrolled Subjects</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a subject to filter your study modules or track syllabus progress.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {subjects.length > 0 && (
                  <button
                    onClick={() => setSelectedSubjectId('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSubjectId === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Modules ({schedule.length})
                  </button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setIsSubjectModalOpen(true)}
                >
                  + Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {subjects.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No subjects added yet</p>
                  <p className="text-[11px] text-slate-400">
                    Add your university courses to begin syllabus tracking and AI topic generation.
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setIsSubjectModalOpen(true)}>
                    Add Your First Subject
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjects.map(sub => {
                    const isSelected = selectedSubjectId === sub.id;
                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubjectId(isSelected ? 'all' : sub.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-900 truncate">{sub.name}</span>
                          <span className="text-xs font-bold text-indigo-600">{sub.syllabusCoverage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${sub.syllabusCoverage}%`,
                              backgroundColor: sub.color || '#6366F1',
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                          <span>{sub.code || 'Course'}</span>
                          <span className="font-medium text-indigo-600 hover:underline">
                            {isSelected ? 'Active Filter ✓' : 'Click to filter'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Today's Timeline Schedule & Modules */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {selectedSubjectId === 'all'
                    ? "Today's Schedule & Focus Blocks"
                    : `${subjects.find(s => s.id === selectedSubjectId)?.name || 'Subject'} Modules & Focus Blocks`}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deterministic slot allocations aligned with your peak energy window.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<HelpCircle className="w-3.5 h-3.5" />}
                  onClick={handleWhatShouldIDo}
                >
                  What should I do now?
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setIsTaskModalOpen(true)}
                >
                  + Add Focus Slot
                </Button>
              </div>
            </CardHeader>

            <CardBody>
              {displayedSchedule.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {selectedSubjectId === 'all'
                        ? "No tasks scheduled for today"
                        : "No modules scheduled for this subject today"}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Plan your day by creating a task or letting the deterministic planner allocate slots from your syllabus.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    {selectedSubjectId !== 'all' && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedSubjectId('all')}>
                        Show All Subjects
                      </Button>
                    )}
                    <Button size="sm" variant="primary" onClick={() => setIsTaskModalOpen(true)}>
                      + Create First Task
                    </Button>
                    <Button size="sm" variant="outline" onClick={openUrgentModal}>
                      ⚡ Insert Urgent Event
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedSchedule.map(slot => (
                    <TimelineItem
                      key={slot.id}
                      slot={slot}
                      onComplete={(id, elapsedMinutes) => completeTask(id, elapsedMinutes)}
                      onStart={(id) => startTask?.(id)}
                      onPause={(id, elapsedMinutes) => pauseTask?.(id, Math.max(elapsedMinutes, 1))}
                      onDelete={(id) => removeTask?.(id)}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Col: Active Projects (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Projects List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Milestones & Projects</CardTitle>
              <Button
                size="xs"
                variant="outline"
                leftIcon={<Plus className="w-3 h-3" />}
                onClick={() => setIsProjectModalOpen(true)}
              >
                New
              </Button>
            </CardHeader>
            <CardBody>
              {projects.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                  <Briefcase className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="font-semibold text-slate-600">No active projects</p>
                  <p>Create assignments or term projects to track deliverables.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 3).map(proj => (
                    <NavLink
                      key={proj.id}
                      to={`/work/${proj.id}`}
                      className="block p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {proj.title}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          {proj.dueDate}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                        {proj.notes || 'Course deliverable'}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{proj.modules.length} milestones</span>
                        <span>{proj.progress}% completed</span>
                      </div>
                    </NavLink>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Interactive Modals */}
      <SubjectModal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSuccess={loadDashboardData}
      />
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={() => {
          refreshPlan();
          loadDashboardData();
        }}
      />
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={loadDashboardData}
      />
    </div>
  );
};
