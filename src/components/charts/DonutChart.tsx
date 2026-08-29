import React from 'react';
import { clsx } from 'clsx';

export interface DonutSegment {
  label: string;
  value: number; // percentage or relative value
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  centerLabel = 'Completed',
  centerValue = '78%',
  size = 180,
  strokeWidth = 20,
  showLegend = true,
  className,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((sum, s) => sum + s.value, 0) || 100;
  let accumulatedAngle = 0;

  return (
    <div className={clsx('flex flex-col sm:flex-row items-center justify-center gap-6', className)}>
      {/* SVG Donut */}
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {segments.map((seg, idx) => {
            const strokeDasharray = `${(seg.value / total) * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedAngle;
            accumulatedAngle += (seg.value / total) * circumference;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 hover:opacity-90"
              />
            );
          })}
        </svg>

        {/* Centered label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 leading-none">{centerValue}</span>
          {centerLabel && <span className="text-xs text-slate-500 mt-1 font-medium">{centerLabel}</span>}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-2 min-w-36">
          {segments.map((seg, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-slate-600 font-medium">{seg.label}</span>
              </div>
              <span className="text-slate-900 font-bold ml-3">{seg.value}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
