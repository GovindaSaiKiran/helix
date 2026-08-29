import React from 'react';
import { Badge } from './Badge';
import { PriorityLevel, ItemStatus, PlanHealthStatus } from '../../types';

export const PriorityBadge: React.FC<{ priority: PriorityLevel }> = ({ priority }) => {
  switch (priority) {
    case 'urgent':
      return <Badge variant="danger" dot>Urgent</Badge>;
    case 'high':
      return <Badge variant="danger">Hard</Badge>;
    case 'medium':
      return <Badge variant="warning">Medium</Badge>;
    case 'low':
      return <Badge variant="default">Easy</Badge>;
    default:
      return <Badge variant="default">{priority}</Badge>;
  }
};

export const PlanHealthBadge: React.FC<{ status: PlanHealthStatus; percentage?: number; showScore?: boolean }> = ({
  status,
  percentage = 87,
  showScore = true,
}) => {
  switch (status) {
    case 'healthy':
      return (
        <Badge variant="success" dot className="font-semibold">
          {showScore ? `${percentage}% Healthy` : 'Good'}
        </Badge>
      );
    case 'tight':
      return (
        <Badge variant="warning" dot className="font-semibold">
          {showScore ? `${percentage}% Tight` : 'Tight'}
        </Badge>
      );
    case 'at_risk':
      return (
        <Badge variant="warning" dot className="font-semibold">
          {showScore ? `${percentage}% At Risk` : 'At Risk'}
        </Badge>
      );
    case 'overloaded':
      return (
        <Badge variant="danger" dot className="font-semibold animate-pulse">
          {showScore ? `${percentage}% Overloaded` : 'Overloaded'}
        </Badge>
      );
    default:
      return <Badge variant="default">Healthy</Badge>;
  }
};

export const ItemStatusBadge: React.FC<{ status: ItemStatus }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <Badge variant="success">Completed</Badge>;
    case 'in_progress':
      return <Badge variant="primary" dot>In Progress</Badge>;
    case 'pending':
      return <Badge variant="default">Pending</Badge>;
    case 'rescheduled':
      return <Badge variant="warning">Rescheduled</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
};
