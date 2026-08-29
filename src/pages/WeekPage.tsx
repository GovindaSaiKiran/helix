import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { MetricCard } from '../components/common/MetricCard';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { TaskModal } from '../components/shared/TaskModal';
import { WeeklyAvailabilityModal } from '../components/shared/WeeklyAvailabilityModal';
import { TaskService } from '../services/taskService';
import { AvailabilityService } from '../services/availabilityService';
import { SubjectService } from '../services/subjectService';
import { Task, AvailabilityWindow, Subject, DayPreference } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  CalendarDays,
  BookOpen,
  Clock,
  Settings2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const HOUR_LABELS: { [hour: number]: string } = {
  0: '12 AM', 1: '1 AM', 2: '2 AM', 3: '3 AM', 4: '4 AM', 5: '5 AM',
  6: '6 AM', 7: '7 AM', 8: '8 AM', 9: '9 AM', 10: '10 AM', 11: '11 AM',
  12: '12 PM', 13: '1 PM', 14: '2 PM', 15: '3 PM', 16: '4 PM', 17: '5 PM',
  18: '6 PM', 19: '7 PM', 20: '8 PM', 21: '9 PM', 22: '10 PM', 23: '11 PM',
};

export const WeekPage: React.FC = () => {
  const { user } = useAuth();
  const { addReminder } = useNotifications();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [dayPreferences, setDayPreferences] = useState<DayPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [rolloverNotice, setRolloverNotice] = useState<string | null>(null);

  const days: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun')[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const fetchWeekData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTasks, fetchedAvail, fetchedSubs, fetchedPrefs] = await Promise.all([
        TaskService.getTasks(user?.id),
        AvailabilityService.getAvailability(user?.id),
        SubjectService.getSubjects(user?.id),
        AvailabilityService.getPreferences(user?.id),
      ]);
      setTasks(fetchedTasks);
      setAvailability(fetchedAvail);
      setSubjects(fetchedSubs);
      setDayPreferences(fetchedPrefs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekData();
  }, [user?.id]);

  // Derive dynamic time rows based on actual user selected hour blocks across the 7 days
  const activeHoursSet = new Set<number>();
  dayPreferences.forEach(p => {
    if (p.isEnabled && p.selectedHourBlocks && p.selectedHourBlocks.length > 0) {
      p.selectedHourBlocks.forEach(h => activeHoursSet.add(h));
    }
  });

  // If user selected hours (e.g. 2 AM, 9 AM, etc), show them; otherwise fallback to default slots
  const activeHours = activeHoursSet.size > 0
    ? Array.from(activeHoursSet).sort((a, b) => a - b)
    : [9, 12, 15, 18, 20];

  const handleRolloverIncomplete = async () => {
    setIsRollingOver(true);
    setRolloverNotice(null);
    try {
      const result = await TaskService.rolloverIncompleteTasks(user?.id);
      if (result.rolledOverCount > 0) {
        setRolloverNotice(`⚡ Rolled over ${result.rolledOverCount} incomplete task(s) into upcoming focus sessions!`);
        await addReminder(
          '⚡ Incomplete Tasks Rolled Over',
          `Successfully rescheduled ${result.rolledOverCount} past unfinished task(s) to your active available study slots.`
        );
      } else {
        setRolloverNotice('✓ All past tasks are up to date. No rollover needed!');
      }
      await fetchWeekData();
    } catch (e: any) {
      setRolloverNotice(`Notice: ${e.message}`);
    } finally {
      setIsRollingOver(false);
    }
  };

  const totalWeeklyCapacity = availability.reduce((sum, a) => sum + a.availableHours, 0);
  const totalWeeklyPlanned = tasks.reduce((sum, t) => sum + t.estimatedMinutes / 60, 0);
  const weeklyBuffer = Math.max(0, totalWeeklyCapacity - totalWeeklyPlanned);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Week View - Dynamic Planner Grid"
        subtitle="Multi-day capacity allocation aligned dynamically with your 24-hour availability matrix"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Clock className="w-4 h-4 text-indigo-600" />}
              onClick={() => setIsAvailabilityModalOpen(true)}
            >
              Set Availability (24h / 7 Days)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              leftIcon={<Zap className="w-4 h-4 text-amber-600" />}
              disabled={isRollingOver}
              onClick={handleRolloverIncomplete}
            >
              {isRollingOver ? 'Rolling over...' : 'Rollover Incomplete Tasks'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsTaskModalOpen(true)}
            >
              Add Task
            </Button>
          </div>
        }
      />

      {rolloverNotice && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>{rolloverNotice}</span>
          </div>
          <button
            onClick={() => setRolloverNotice(null)}
            className="text-xs text-indigo-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Week Metrics from Real Data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Weekly Capacity"
          value={`${totalWeeklyCapacity.toFixed(1)} hrs`}
          subtitle="Configured available windows"
        />
        <MetricCard
          title="Planned Workload"
          value={`${totalWeeklyPlanned.toFixed(1)} hrs`}
          subtitle={`${tasks.length} total tasks`}
        />
        <MetricCard
          title="Weekly Buffer"
          value={`${weeklyBuffer.toFixed(1)} hrs`}
          subtitle="Buffer capacity"
        />
        <MetricCard
          title="Week Status"
          value={totalWeeklyPlanned > totalWeeklyCapacity ? 'Overloaded' : 'Healthy'}
          subtitle={totalWeeklyPlanned > totalWeeklyCapacity ? 'Capacity exceeded' : 'Well balanced'}
        />
      </div>

      {/* Week Calendar Grid - Dynamic according to User Availability */}
      <Card padding="none" className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/80">
            <div className="p-3 text-xs font-bold text-slate-400 text-center border-r border-slate-200">
              Active Hours
            </div>
            {days.map(day => {
              const dayPref = dayPreferences.find(p => p.dayOfWeek === day);
              const dayAvail = availability.find(a => a.dayOfWeek === day);
              const isDayEnabled = dayPref?.isEnabled ?? true;

              return (
                <div key={day} className="p-3 text-center border-r border-slate-200 last:border-r-0">
                  <span className="text-xs font-bold text-slate-800 block">{day}</span>
                  <span className={`text-[10px] font-medium block ${isDayEnabled ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {isDayEnabled ? `${dayAvail?.availableHours || 0}h capacity` : 'Rest Day'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time Slot Rows (Dynamically derived from user availability) */}
          {activeHours.map((hour, hIdx) => {
            const timeLabel = HOUR_LABELS[hour] || `${hour}:00`;

            return (
              <div key={hour} className="grid grid-cols-8 border-b border-slate-100 min-h-[90px]">
                <div className="p-3 text-xs font-bold text-indigo-900 text-center border-r border-slate-200 bg-slate-50/40 flex items-center justify-center">
                  {timeLabel}
                </div>
                {days.map((day, dIdx) => {
                  const dayPref = dayPreferences.find(p => p.dayOfWeek === day);
                  const isAvailableAtThisHour = Boolean(
                    dayPref?.isEnabled && dayPref.selectedHourBlocks?.includes(hour)
                  );

                  // Unique deterministic task mapping for available slots
                  const cellIndex = hIdx * days.length + dIdx;
                  const assignedTask = isAvailableAtThisHour ? tasks[cellIndex] || null : null;
                  const matchingSubject = assignedTask?.subjectId
                    ? subjects.find(s => s.id === assignedTask.subjectId)
                    : null;
                  const subjectDisplayName = matchingSubject?.name || (assignedTask as any)?.subjectName || 'Study';

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`p-2 border-r border-slate-100 last:border-r-0 flex flex-col justify-center transition-colors ${
                        !isAvailableAtThisHour ? 'bg-slate-50/50' : 'bg-white'
                      }`}
                    >
                      {assignedTask ? (
                        <div className="p-2.5 rounded-lg border text-xs bg-indigo-50/90 border-indigo-200 text-indigo-900 shadow-2xs hover:border-indigo-300 transition-all space-y-1">
                          {/* Subject Badge */}
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[85px]"
                              style={{
                                backgroundColor: matchingSubject?.color ? `${matchingSubject.color}20` : '#EEF2FF',
                                color: matchingSubject?.color || '#4F46E5',
                              }}
                              title={subjectDisplayName || 'General'}
                            >
                              📚 {subjectDisplayName || 'Study'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium shrink-0">
                              {assignedTask.estimatedMinutes}m
                            </span>
                          </div>

                          {/* Task Title */}
                          <p className="font-bold truncate text-slate-900 leading-snug" title={assignedTask.title}>
                            {assignedTask.title}
                          </p>
                        </div>
                      ) : isAvailableAtThisHour ? (
                        <button
                          type="button"
                          onClick={() => setIsTaskModalOpen(true)}
                          className="h-full min-h-[55px] rounded-lg hover:bg-indigo-50/50 transition-colors border border-dashed border-indigo-200/80 hover:border-indigo-400 flex flex-col items-center justify-center cursor-pointer group p-1"
                        >
                          <span className="text-[10px] text-indigo-600 font-bold group-hover:underline">
                            + Available Slot
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {timeLabel}
                          </span>
                        </button>
                      ) : (
                        <div className="h-full min-h-[55px] rounded-md flex items-center justify-center text-slate-300 text-[10px] font-medium select-none">
                          — Off
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSuccess={fetchWeekData}
      />

      <WeeklyAvailabilityModal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        onSaved={fetchWeekData}
        userId={user?.id}
      />
    </div>
  );
};
