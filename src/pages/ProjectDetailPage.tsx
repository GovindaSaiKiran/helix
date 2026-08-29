import React, { useState, useEffect } from 'react';
import { useParams, NavLink, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { PriorityBadge, ItemStatusBadge } from '../components/common/StatusBadge';
import { ProgressBar } from '../components/common/ProgressBar';
import { ProjectService } from '../services/projectService';
import { Project } from '../types';
import { RefreshCw, ArrowLeft, CheckCircle2, Clock, Calendar, Link as LinkIcon, FileText, Plus, Trash2 } from 'lucide-react';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'planning' | 'notes'>('overview');

  const fetchProject = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const p = await ProjectService.getProjectById(id);
      setProject(p || null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const toggleModuleStatus = async (moduleId: string) => {
    if (!project) return;
    const updatedModules = project.modules.map(m => {
      if (m.id === moduleId) {
        const nextStatus = m.status === 'completed' ? 'pending' : 'completed';
        const nextProgress = nextStatus === 'completed' ? 100 : 0;
        return { ...m, status: nextStatus as any, progress: nextProgress };
      }
      return m;
    });

    const completed = updatedModules.filter(m => m.status === 'completed').length;
    const overallProgress = Math.round((completed / (updatedModules.length || 1)) * 100);

    const updated = {
      ...project,
      modules: updatedModules,
      progress: overallProgress,
    };

    setProject(updated);
    await ProjectService.updateProject(project.id, {
      modules: updatedModules,
      progress: overallProgress,
    });
  };

  const handleDelete = async () => {
    if (!project) return;
    if (confirm('Are you sure you want to delete this project?')) {
      await ProjectService.deleteProject(project.id);
      navigate('/work');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        Loading project data from database...
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="py-16 text-center space-y-4 max-w-lg mx-auto mt-12">
        <h3 className="text-base font-bold text-slate-800">Project Not Found</h3>
        <p className="text-xs text-slate-500">
          This project could not be found or belongs to another user profile.
        </p>
        <NavLink to="/work">
          <Button size="sm" variant="primary">
            ← Return to Work & Projects
          </Button>
        </NavLink>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Work', href: '/work' },
          { label: project.title },
        ]}
        title={project.title}
        subtitle={`${project.dueDate} • Estimated Effort: ${project.estimatedEffortHours} hrs`}
        actions={
          <div className="flex items-center gap-2">
            <NavLink to="/work">
              <Button size="sm" variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Work
              </Button>
            </NavLink>
            <Button size="sm" variant="danger" leftIcon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />

      {/* Top Banner Status Bar */}
      <Card padding="sm" className="bg-slate-50 border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PriorityBadge priority={project.priority} />
            <span className="text-xs font-semibold text-slate-700">
              Overall Progress: <strong className="text-indigo-600">{project.progress}%</strong>
            </span>
          </div>
          <div className="w-full sm:w-64">
            <ProgressBar value={project.progress} color="primary" />
          </div>
        </div>
      </Card>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['overview', 'tasks', 'planning', 'notes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Grid: Breakdown & Project Info Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module Breakdown (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Milestones & Deliverables</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click a milestone checkbox to update progress in real time.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {project.modules.length} Deliverables
              </span>
            </CardHeader>

            <CardBody className="space-y-3">
              {project.modules.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No breakdown modules created yet.
                </div>
              ) : (
                project.modules.map(mod => {
                  const isDone = mod.status === 'completed';
                  return (
                    <div
                      key={mod.id}
                      onClick={() => toggleModuleStatus(mod.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isDone
                          ? 'bg-slate-50/70 border-slate-200 text-slate-400'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isDone
                              ? 'bg-emerald-500 text-white'
                              : 'border-2 border-slate-300 hover:border-indigo-500'
                          }`}
                        >
                          {isDone && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <span className={`text-xs font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {mod.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {mod.estimatedHours}h est.
                        </span>
                        <ItemStatusBadge status={mod.status} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar Info (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Metadata</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Category</span>
                <span className="font-bold text-slate-800 uppercase">{project.category}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Target Due Date</span>
                <span className="font-bold text-slate-800">{project.dueDate}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Total Effort</span>
                <span className="font-bold text-indigo-600">{project.estimatedEffortHours} hrs</span>
              </div>
              {project.notes && (
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1">Notes & Scope:</span>
                  <p className="p-3 rounded-lg bg-slate-50 text-slate-700 leading-relaxed">
                    {project.notes}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
