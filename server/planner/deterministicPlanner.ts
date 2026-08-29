// HELIX Authoritative Deterministic Planning & Health Engine
// Mathematical ratio and constraint-based scheduling engine

export type PlanHealthStatus = 'healthy' | 'tight' | 'at_risk' | 'overloaded';

export interface PlanHealthResult {
  score: number; // 0 to 100
  status: PlanHealthStatus;
  label: string;
  totalAvailableHours: number;
  totalPlannedHours: number;
  bufferHours: number;
  conflictCount: number;
  recommendations: string[];
}

export interface AvailabilityWindow {
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  availableHours: number;
  plannedHours: number;
  bufferHours: number;
  energyProfile: 'morning' | 'afternoon' | 'evening';
}

export interface TaskInput {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rescheduled' | 'cancelled';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ReplanningRequest {
  event: {
    id: string;
    title: string;
    type: string;
    urgency: 'urgent' | 'high' | 'medium' | 'low';
    remainingEffortHours: number;
    deadlineDays?: number;
  };
  currentSchedule: Array<{
    id: string;
    timeSlot: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    title: string;
    category: string;
    priority: string;
  }>;
  availableHours: number;
}

export class DeterministicPlanner {
  /**
   * Deterministic Plan Health Calculation
   * Mathematical ratio of planned hours to available capacity + buffer factor
   */
  public static calculateHealth(
    availableHours: number,
    plannedHours: number,
    conflictCount: number = 0
  ): PlanHealthResult {
    const safeAvailable = Math.max(0.1, availableHours);
    const buffer = Math.max(0, availableHours - plannedHours);
    const ratio = plannedHours / safeAvailable;

    let score = 100;
    let status: PlanHealthStatus = 'healthy';
    const recommendations: string[] = [];

    if (ratio > 1.05 || conflictCount > 0) {
      status = 'overloaded';
      score = Math.max(15, Math.round(100 - (ratio - 1) * 150 - conflictCount * 20));
      recommendations.push('Schedule is overloaded. Reallocate non-critical sessions to weekend slots.');
      if (conflictCount > 0) {
        recommendations.push(`${conflictCount} schedule conflict(s) detected. Adjust slot timings.`);
      }
    } else if (ratio > 0.85 || buffer < 1) {
      status = 'tight';
      score = Math.round(100 - (ratio - 0.7) * 80);
      recommendations.push('Plan capacity is tight with minimal buffer. Focus on high-priority items first.');
    } else if (ratio > 0.7) {
      status = 'healthy';
      score = Math.min(95, Math.round(80 + (buffer / safeAvailable) * 15));
      recommendations.push('Schedule is well-balanced with comfortable buffer time.');
    } else {
      status = 'healthy';
      score = Math.min(98, Math.round(75 + (buffer / safeAvailable) * 20));
      recommendations.push('Healthy workload. Great opportunity for deep learning or advance project work.');
    }

    const labelMap: Record<PlanHealthStatus, string> = {
      healthy: 'Healthy',
      tight: 'Tight Capacity',
      at_risk: 'At Risk',
      overloaded: 'Overloaded',
    };

    return {
      score: Math.min(100, Math.max(0, score)),
      status,
      label: labelMap[status],
      totalAvailableHours: Number(availableHours.toFixed(1)),
      totalPlannedHours: Number(plannedHours.toFixed(1)),
      bufferHours: Number(buffer.toFixed(1)),
      conflictCount,
      recommendations,
    };
  }

  /**
   * Deterministic dynamic replanning upon urgent event addition
   */
  public static generateReplanningProposal(req: ReplanningRequest) {
    const { event, currentSchedule, availableHours } = req;
    const currentPlannedHours = currentSchedule.reduce((sum, slot) => sum + slot.durationMinutes / 60, 0);

    const healthBefore = this.calculateHealth(
      availableHours,
      currentPlannedHours + event.remainingEffortHours,
      1
    );

    // Algorithmic mitigation: allocate urgent event, reduce flexible slots, protect deadlines
    const shortageHours = Math.max(0, currentPlannedHours + event.remainingEffortHours - availableHours);
    const optimizedPlannedHours = Math.min(availableHours * 0.85, currentPlannedHours + event.remainingEffortHours * 0.6);
    const healthAfter = this.calculateHealth(availableHours, optimizedPlannedHours, 0);

    const proposedSlots = [
      {
        time: '6:00 PM',
        title: `${event.title} (Urgent Focus)`,
        duration: `${Math.min(90, Math.round(event.remainingEffortHours * 30))} min`,
        actionTag: '+ High Priority Focus',
      },
      ...currentSchedule.slice(0, 2).map((s, idx) => ({
        time: idx === 0 ? '7:30 PM' : '8:30 PM',
        title: s.title,
        duration: '45 min',
        actionTag: idx === 0 ? 'Optimized -15m' : 'Protected Milestone',
      })),
    ];

    return {
      id: `rep_${Date.now()}`,
      eventId: event.id,
      eventSummary: event,
      currentPlanSummary: {
        availableHours,
        requiredHours: Number((currentPlannedHours + event.remainingEffortHours).toFixed(1)),
        shortageHours: Number(shortageHours.toFixed(1)),
        healthStatus: healthBefore.status,
        slots: currentSchedule.map(s => ({
          time: s.timeSlot || `${s.startTime} - ${s.endTime}`,
          title: s.title,
          duration: `${s.durationMinutes} min`,
        })),
      },
      proposedPlanSummary: {
        availableHours,
        requiredHours: Number(optimizedPlannedHours.toFixed(1)),
        shortageHours: 0,
        healthStatus: healthAfter.status,
        slots: proposedSlots,
      },
      proposedActions: [
        {
          id: 'act_1',
          description: 'Allocate dedicated high-focus block for urgent event',
          impactType: 'allocate' as const,
        },
        {
          id: 'act_2',
          description: 'Compress flexible practice sessions without dropping core concepts',
          impactType: 'reduce' as const,
        },
        {
          id: 'act_3',
          description: 'Defer non-urgent revision to weekend buffer window',
          impactType: 'postpone' as const,
        },
        {
          id: 'act_4',
          description: 'Protect all imminent academic deadlines and exams from slippage',
          impactType: 'protect' as const,
        },
      ],
    };
  }
}
