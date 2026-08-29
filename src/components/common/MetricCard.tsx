import React from 'react';
import { Card } from './Card';
import { clsx } from 'clsx';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  badge?: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  badge,
  className,
  highlight = false,
}) => {
  return (
    <Card
      className={clsx(
        'relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/15 hover:border-indigo-500/50',
        highlight
          ? 'border-indigo-200 bg-gradient-to-br from-white via-indigo-50/30 to-white'
          : 'bg-white',
        className
      )}
      padding="sm"
    >
      {/* Subtle glowing ambient gradient behind icon on hover */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-300" />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span
                className={clsx(
                  'font-semibold flex items-center',
                  trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
              </span>
              {trend.label && <span className="text-slate-400">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0 border border-indigo-100 shadow-2xs group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.35)] transition-all duration-300">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};
