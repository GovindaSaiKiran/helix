import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/common/MetricCard';
import { Card, CardHeader, CardTitle, CardBody } from '../components/common/Card';
import { ProgressBar } from '../components/common/ProgressBar';
import { DonutChart } from '../components/charts/DonutChart';
import { SubjectService } from '../services/subjectService';
import { TaskService } from '../services/taskService';
import { Subject, Task } from '../types';
import { useAuth } from '../context/AuthContext';
import { Clock, CheckSquare, BookOpen, Award, TrendingUp, BarChart3 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '../components/common/Button';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [subs, ts] = await Promise.all([
          SubjectService.getSubjects(user?.id),
          TaskService.getTasks(user?.id),
        ]);
        setSubjects(subs);
        setTasks(ts);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const totalStudyMinutes = tasks.reduce((sum, t) => {
    // Sum actual minutes. If it's completed but has 0 actual minutes, fallback to estimated.
    const actual = t.completedMinutes || 0;
    if (t.status === 'completed' && actual === 0) {
      return sum + (t.estimatedMinutes || 0);
    }
    return sum + actual;
  }, 0);
  
  const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);

  // Compute real dynamic subject coverage based on subject's completed units or completed tasks
  const dynamicSubjects = subjects.map(s => {
    const subTasks = tasks.filter(t => t.subjectId === s.id);
    const subCompletedTasks = subTasks.filter(t => t.status === 'completed');
    let coverage = s.syllabusCoverage;
    if (s.totalUnits > 0 && s.completedUnits > 0) {
      coverage = Math.round((s.completedUnits / s.totalUnits) * 100);
    } else if (subTasks.length > 0) {
      coverage = Math.round((subCompletedTasks.length / subTasks.length) * 100);
    }
    return { ...s, syllabusCoverage: coverage };
  });

  const avgSyllabusCoverage = dynamicSubjects.length > 0
    ? Math.round(dynamicSubjects.reduce((sum, s) => sum + s.syllabusCoverage, 0) / dynamicSubjects.length)
    : 0;

  // Real dynamic topic & task mastery calculation
  const totalTaskCount = tasks.length;
  let masteredPct = 0;
  let inProgressPct = 0;
  let needsRevisionPct = 100;

  if (totalTaskCount > 0) {
    masteredPct = Math.round((completedTasks.length / totalTaskCount) * 100);
    inProgressPct = Math.round((inProgressTasks.length / totalTaskCount) * 100);
    needsRevisionPct = Math.max(0, 100 - masteredPct - inProgressPct);
  } else if (avgSyllabusCoverage > 0) {
    masteredPct = avgSyllabusCoverage;
    inProgressPct = Math.min(30, 100 - masteredPct);
    needsRevisionPct = Math.max(0, 100 - masteredPct - inProgressPct);
  }

  const masterySegments = dynamicSubjects.length > 0
    ? [
        { label: 'Mastered', value: masteredPct, color: '#10B981' },
        { label: 'In Progress', value: inProgressPct, color: '#F59E0B' },
        { label: 'To Study', value: needsRevisionPct, color: '#6366F1' },
      ]
    : [{ label: 'Zero State', value: 100, color: '#E2E8F0' }];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Analytics"
        subtitle="Track your study hours, syllabus mastery, quiz averages, and topic trends."
      />

      {/* Top 4 Performance Metric Cards Calculated from Real Data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Study Time"
          value={`${totalStudyHours}h`}
          subtitle="Recorded in focus sessions"
          icon={<Clock className="w-5 h-5 text-indigo-600" />}
        />

        <MetricCard
          title="Tasks Completed"
          value={completedTasks.length}
          subtitle={`${tasks.length} total planned blocks`}
          icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
        />

        <MetricCard
          title="Syllabus Coverage"
          value={`${avgSyllabusCoverage}%`}
          subtitle={`${subjects.length} enrolled subjects`}
          icon={<BookOpen className="w-5 h-5 text-sky-600" />}
        />

        <MetricCard
          title="Active Performance"
          value={completedTasks.length > 0 ? 'Tracking' : 'Getting Started'}
          subtitle="Based on task completions"
          icon={<Award className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {tasks.length === 0 && subjects.length === 0 ? (
        <Card className="py-16 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No study analytics yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Complete your first focus timer session or mark tasks as done to generate detailed performance analytics and topic mastery charts.
            </p>
          </div>
          <NavLink to="/today">
            <Button size="sm" variant="primary">
              Go to Today's Timetable
            </Button>
          </NavLink>
        </Card>
      ) : (
        /* 2-Column: Subject Progress & Mastery Breakdown */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Subject Progress (7 cols) */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle>Subject Progress Breakdown</CardTitle>
                <span className="text-xs text-slate-500 font-medium">
                  {dynamicSubjects.length} Enrolled Subject(s)
                </span>
              </CardHeader>
              <CardBody className="space-y-4">
                {dynamicSubjects.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No subjects added yet.</p>
                ) : (
                  dynamicSubjects.map(sub => (
                    <div key={sub.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800">{sub.name}</span>
                        <span className="text-slate-900 font-bold">{sub.syllabusCoverage}%</span>
                      </div>
                      <ProgressBar value={sub.syllabusCoverage} size="sm" color="primary" />
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* Mastery Overview (5 cols) */}
          <div className="lg:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Mastery Overview</CardTitle>
                <span className="text-xs text-slate-500 font-medium">Topic Proficiency</span>
              </CardHeader>
              <CardBody className="flex flex-col items-center justify-center py-6">
                <DonutChart
                  segments={masterySegments}
                  centerLabel="Curriculum"
                  centerValue={`${avgSyllabusCoverage}%`}
                  size={180}
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
