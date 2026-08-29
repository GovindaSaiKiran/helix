import React, { createContext, useContext, useState, useEffect } from 'react';
import { ScheduleSlot, ReplanningProposal } from '../types';
import { TaskService } from '../services/taskService';
import { ApiClient, BackendPlanHealthResponse } from '../services/apiClient';
import { useAuth } from './AuthContext';

interface PlanContextType {
  schedule: ScheduleSlot[];
  planHealth: BackendPlanHealthResponse;
  isLoading: boolean;
  activeProposal: ReplanningProposal | null;
  completeTask: (slotId: string, elapsedMinutes?: number) => Promise<void>;
  startTask: (slotId: string) => Promise<void>;
  pauseTask: (slotId: string, elapsedMinutes: number) => Promise<void>;
  removeTask: (slotId: string) => Promise<void>;
  addUrgentTask: (title: string, estimatedMinutes: number) => Promise<void>;
  applyReplan: (proposalId: string) => Promise<void>;
  triggerReplanAnalysis: (urgentEvent?: any) => Promise<void>;
  refreshPlan: () => Promise<void>;
}

const defaultHealth: BackendPlanHealthResponse = {
  score: 100,
  status: 'healthy',
  label: 'Healthy',
  totalAvailableHours: 4,
  totalPlannedHours: 0,
  bufferHours: 1,
  conflictCount: 0,
  recommendations: ['Schedule is clean and ready for new tasks.'],
};

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [activeProposal, setActiveProposal] = useState<ReplanningProposal | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [planHealth, setPlanHealth] = useState<BackendPlanHealthResponse>(defaultHealth);

  const fetchPlanData = async () => {
    setIsLoading(true);
    try {
      const todaySlots = await TaskService.getTodaySchedule(user?.id);
      setSchedule(todaySlots);

      const plannedHours = todaySlots.reduce((acc, s) => acc + s.durationMinutes / 60, 0);
      const availableHours = 4.5; // Default day capacity

      // Call authoritative backend deterministic planner
      try {
        const health = await ApiClient.calculatePlanHealth(availableHours, plannedHours, 0);
        setPlanHealth(health);
      } catch {
        // Local fallback calculation if backend is briefly offline
        const ratio = plannedHours / availableHours;
        const status = ratio > 1.05 ? 'overloaded' : ratio > 0.85 ? 'at_risk' : 'healthy';
        const score = Math.max(20, Math.min(100, Math.round(100 - ratio * 40)));
        setPlanHealth({
          score,
          status: status as any,
          label: status === 'healthy' ? 'Healthy' : status === 'at_risk' ? 'At Risk' : 'Overloaded',
          totalAvailableHours: availableHours,
          totalPlannedHours: Number(plannedHours.toFixed(1)),
          bufferHours: Number(Math.max(0, availableHours - plannedHours).toFixed(1)),
          conflictCount: 0,
          recommendations: ['Calculated from current scheduled focus slots.'],
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanData();
  }, [user?.id]);

  const completeTask = async (slotId: string, elapsedMinutes?: number) => {
    await TaskService.updateTaskStatus(slotId, 'completed', 100, elapsedMinutes);
    setSchedule(prev =>
      prev.map(slot => (slot.id === slotId ? { ...slot, status: 'completed', progress: 100 } : slot))
    );
    await fetchPlanData();
  };

  const startTask = async (slotId: string) => {
    await TaskService.updateTaskStatus(slotId, 'in_progress');
    setSchedule(prev =>
      prev.map(slot => (slot.id === slotId ? { ...slot, status: 'in_progress' } : slot))
    );
  };

  const pauseTask = async (slotId: string, elapsedMinutes: number) => {
    await TaskService.updateTaskStatus(slotId, 'pending', undefined, elapsedMinutes);
    setSchedule(prev =>
      prev.map(slot => (slot.id === slotId ? { ...slot, status: 'pending' } : slot))
    );
    await fetchPlanData();
  };

  const removeTask = async (slotId: string) => {
    await TaskService.deleteTask(slotId);
    setSchedule(prev => prev.filter(slot => slot.id !== slotId));
    await fetchPlanData();
  };

  const addUrgentTask = async (title: string, estimatedMinutes: number) => {
    if (!user) return;
    const newSlot = await TaskService.addUrgentTask(user.id, {
      title,
      estimatedMinutes,
      priority: 'urgent',
    });

    if (newSlot) {
      setSchedule(prev => [newSlot, ...prev]);
      await triggerReplanAnalysis({
        id: `evt_${Date.now()}`,
        title: `Urgent Task: ${title}`,
        type: 'urgent_task',
        urgency: 'urgent',
        remainingEffortHours: estimatedMinutes / 60,
      });
    }
  };

  const triggerReplanAnalysis = async (urgentEvent?: any) => {
    const event = urgentEvent || {
      id: `evt_${Date.now()}`,
      title: 'Urgent Task Insertion',
      type: 'urgent_task',
      urgency: 'urgent',
      remainingEffortHours: 1.5,
    };

    try {
      const proposal = await ApiClient.generateReplanningProposal({
        event,
        currentSchedule: schedule,
        availableHours: 4.5,
      });
      setActiveProposal(proposal);
    } catch (err) {
      console.warn('Replanning calculation error:', err);
    }
  };

  const applyReplan = async (proposalId: string) => {
    setActiveProposal(null);
    await fetchPlanData();
  };

  return (
    <PlanContext.Provider
      value={{
        schedule,
        planHealth,
        isLoading,
        activeProposal,
        completeTask,
        startTask,
        pauseTask,
        removeTask,
        addUrgentTask,
        applyReplan,
        triggerReplanAnalysis,
        refreshPlan: fetchPlanData,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider');
  return ctx;
};
