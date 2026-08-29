import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'sky' | 'purple' | 'amber';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  showPercentage = false,
  color = 'primary',
  size = 'sm',
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizeStyles = {
    xs: 'h-1.5',
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  const colorStyles = {
    primary: 'bg-indigo-600',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    sky: 'bg-sky-500',
    purple: 'bg-purple-600',
    amber: 'bg-amber-500',
  };

  return (
    <div className={twMerge('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-600 mb-1.5">
          {label && <span>{label}</span>}
          {showPercentage && <span className="text-slate-900 font-semibold">{clampedValue}%</span>}
        </div>
      )}
      <div className={twMerge('w-full bg-slate-100 rounded-full overflow-hidden', sizeStyles[size])}>
        <div
          className={twMerge('h-full rounded-full transition-all duration-300', colorStyles[color])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
