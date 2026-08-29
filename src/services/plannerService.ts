import {
  AvailabilityWindow,
  PlanHealthStatus,
  PlanVersion,
  ReplanningProposal,
  ReplanningEvent,
} from '../types';

export interface PlanHealthMetric {
  score: number; // 0 to 100
  status: PlanHealthStatus;
  label: string;
  totalAvailableHours: number;
  totalPlannedHours: number;
  bufferHours: number;
  conflictCount: number;
}

class PlannerService {
  private availability: AvailabilityWindow[] = [];
  private planVersions: PlanVersion[] = [
    {
      id: 'pv_01',
      versionNumber: 1,
      createdAt: '2024-05-24T09:00:00Z',
      availableHours: 22,
      plannedHours: 18,
      bufferHours: 4,
      healthStatus: 'healthy',
      healthPercentage: 87,
      reason: 'Base semester schedule generated',
      appliedChanges: ['Initial timetable allocation'],
    },
  ];

  /**
   * Deterministic Plan Health Calculation
   * Mathematical ratio of planned hours to capacity + buffer factor
   */
  calculatePlanHealth(availableHours: number, plannedHours: number, conflictCount = 0): PlanHealthMetric {
    const buffer = Math.max(0, availableHours - plannedHours);
    const ratio = availableHours > 0 ? (plannedHours / availableHours) : 1;

    let score = 100;
    let status: PlanHealthStatus = 'healthy';

    if (ratio > 1.05 || conflictCount > 0) {
      status = 'overloaded';
      score = Math.max(20, Math.round(100 - (ratio - 1) * 150 - conflictCount * 20));
    } else if (ratio > 0.85 || buffer < 1) {
      status = 'at_risk';
      score = Math.round(100 - (ratio - 0.7) * 80);
    } else {
      status = 'healthy';
      score = Math.min(98, Math.round(80 + (buffer / availableHours) * 20));
    }

    const label = status === 'healthy' ? 'Healthy' : status === 'at_risk' ? 'At Risk' : 'Overloaded';

    return {
      score,
      status,
      label,
      totalAvailableHours: availableHours,
      totalPlannedHours: plannedHours,
      bufferHours: Number(buffer.toFixed(1)),
      conflictCount,
    };
  }

  async getWeekAvailability(): Promise<AvailabilityWindow[]> {
    return Promise.resolve([...this.availability]);
  }

  async getLatestProposal(): Promise<ReplanningProposal | null> {
    return Promise.resolve(null);
  }

  /**
   * Deterministic engine simulation: evaluates new event against existing timetable
   */
  async generateReplanningProposal(event: ReplanningEvent): Promise<ReplanningProposal> {
    const healthBefore = this.calculatePlanHealth(12, 15, 1);
    const healthAfter = this.calculatePlanHealth(12, 10, 0);

    const proposal: ReplanningProposal = {
      id: `rep_${Date.now()}`,
      eventId: event.id,
      eventSummary: event,
      currentPlanSummary: {
        availableHours: 12,
        requiredHours: 12 + event.remainingEffortHours,
        shortageHours: Math.max(0, 12 + event.remainingEffortHours - 12),
        healthStatus: healthBefore.status,
        slots: [
          { time: 'Scheduled Time', title: 'Existing Task 1', duration: '60 min' },
          { time: 'Scheduled Time', title: 'Existing Task 2', duration: '60 min' },
        ],
      },
      proposedPlanSummary: {
        availableHours: 12,
        requiredHours: 10,
        shortageHours: 0,
        healthStatus: healthAfter.status,
        slots: [
          { time: 'TBD', title: `${event.title} (Session 1)`, duration: '90 min', actionTag: '+ Added Focus' },
          { time: 'TBD', title: 'Existing Task 1 (Rescheduled)', duration: '45 min', actionTag: 'Reduced 15m' },
        ],
      },
      proposedActions: [
        { id: 'act_1', description: 'Move lower priority tasks to weekend availability window', impactType: 'postpone' },
        { id: 'act_2', description: `Allocate high-focus study slots for ${event.title}`, impactType: 'allocate' },
      ],
    };

    return Promise.resolve(proposal);
  }

  async applyReplanningProposal(proposalId: string): Promise<PlanVersion> {
    const nextVersionNum = this.planVersions.length + 1;
    const newVersion: PlanVersion = {
      id: `pv_${Date.now()}`,
      versionNumber: nextVersionNum,
      createdAt: new Date().toISOString(),
      availableHours: 12,
      plannedHours: 10,
      bufferHours: 2,
      healthStatus: 'healthy',
      healthPercentage: 92,
      reason: 'Applied smart replanning for urgent task allocation',
      appliedChanges: ['Postponed non-critical task', 'Allocated 90m urgent session', 'Restored plan health to 92%'],
    };
    this.planVersions.push(newVersion);
    return Promise.resolve(newVersion);
  }
}

export const plannerService = new PlannerService();
