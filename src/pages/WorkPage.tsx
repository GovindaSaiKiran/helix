import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { PriorityBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { TimelineItem } from '../components/common/TimelineItem';
import { ProjectService } from '../services/projectService';
import { TaskService } from '../services/taskService';
import { Project, Task, ScheduleSlot } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../context/PlanContext';
import { ProjectModal } from '../components/shared/ProjectModal';
import { Plus, ArrowRight, Layers, Target, FileText, Briefcase, Trash2 } from 'lucide-react';

export const WorkPage: React.FC = () => {
  const { user } = useAuth();
  const { completeTask, startTask, pauseTask, removeTask, refreshPlan } = usePlan();
  const [filter, setFilter] = useState<'all' | 'assignments' | 'projects' | 'goals'>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [projData, taskData] = await Promise.all([
        ProjectService.getProjects(user?.id),
        TaskService.getTasks(user?.id)
      ]);

      // Filter projects strictly according to active tab
      const filteredProjects = projData.filter(p => {
        if (filter === 'all') return true;
        if (filter === 'assignments') return p.category === 'assignment';
        if (filter === 'projects') return p.category === 'project';
        if (filter === 'goals') return p.category === 'goal';
        return false;
      });
      setProjects(filteredProjects);

      // Filter standalone tasks strictly
      const filteredTasks = taskData.filter(t => {
        if (filter === 'all') return t.type === 'project' || t.type === 'assignment' || t.type === 'study';
        if (filter === 'assignments') return t.type === 'assignment';
        if (filter === 'projects') return t.type === 'project';
        if (filter === 'goals') return false;
        return false;
      });
      setTasks(filteredTasks);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, filter]);

  const mapTaskToSlot = (t: Task): ScheduleSlot => ({
    id: t.id,
    title: t.title,
    timeSlot: t.scheduledDate || 'Unscheduled',
    startTime: '',
    endTime: '',
    durationMinutes: t.estimatedMinutes,
    category: t.type === 'project' ? 'project' : 'study',
    priority: t.priority,
    progress: t.progress,
    status: t.status,
    dueInfo: t.dueDate ? `Due: ${t.dueDate}` : undefined
  });

  const handleComplete = async (id: string, elapsed?: number) => {
    await completeTask(id, elapsed);
    await fetchData();
  };

  const handleStart = async (id: string) => {
    await startTask(id);
    await fetchData();
  };

  const handlePause = async (id: string, elapsed: number) => {
    await pauseTask(id, elapsed);
    await fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    await removeTask(id);
    await fetchData();
  };

  const handleDeleteProject = async (e: React.MouseEvent, projId: string, projTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${projTitle}"?`)) {
      await ProjectService.deleteProject(projId);
      await fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work & Projects"
        subtitle="Manage your academic assignments, coding projects, and semester milestones."
        actions={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Work
          </Button>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {(['all', 'assignments', 'projects', 'goals'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
              filter === tab
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Projects and Tasks List Grid / Empty State */}
      {projects.length === 0 && tasks.length === 0 ? (
        <Card className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No {filter === 'all' ? 'projects or tasks' : filter} found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create your first deliverable or assignment to begin milestone tracking.
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setIsModalOpen(true)}>
            + Create New Work Item
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {projects.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                {filter === 'assignments' ? 'Assignments' : filter === 'projects' ? 'Projects' : filter === 'goals' ? 'Goals' : 'Projects & Assignments'}
              </h2>
              {projects.map(proj => {
                const colorMap = {
                  project: 'primary',
                  assignment: 'warning',
                  goal: 'sky',
                  exam_prep: 'purple',
                } as const;

                return (
                  <NavLink key={proj.id} to={`/work/${proj.id}`} className="block group">
                    <Card interactive className="border-slate-200 hover:border-indigo-300 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {proj.category}
                            </span>
                            <span className="text-slate-300">•</span>
                            <PriorityBadge priority={proj.priority} />
                            <span className="text-xs text-slate-500 font-medium">Due: {proj.dueDate}</span>
                          </div>

                          <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {proj.title}
                          </h3>

                          <div className="mt-3 max-w-md">
                            <ProgressBar
                              value={proj.progress}
                              showPercentage
                              color={colorMap[proj.category] || 'primary'}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                          <div className="hidden md:block text-right pr-2">
                            <p className="font-semibold text-slate-700">{proj.remainingEffortHours}h remaining</p>
                            <p className="text-[11px] text-slate-400">Est. {proj.estimatedEffortHours}h</p>
                          </div>
                          
                          {/* Delete Project Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(e, proj.id, proj.title)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete ${proj.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </NavLink>
                );
              })}
            </div>
          )}
          
          {tasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Standalone Tasks</h2>
              {tasks.map(task => (
                <TimelineItem
                  key={task.id}
                  slot={mapTaskToSlot(task)}
                  onComplete={handleComplete}
                  onStart={handleStart}
                  onPause={handlePause}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project Creation Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};
