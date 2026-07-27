// components/cli/dashboard/MetricCard.tsx
import React from 'react';

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  total: number;
  gradient: string;
  shadowColor: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const CircularProgress: React.FC<{ percentage: number }> = ({ percentage }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(percentage, 100) / 100);

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="transform -rotate-90 w-12 h-12" viewBox="0 0 48 48">
        <circle
          cx="24" cy="24" r={radius}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="24" cy="24" r={radius}
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
        {Math.round(percentage)}%
      </span>
    </div>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({ icon, title, value, total, gradient, shadowColor, isSelected, onClick }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const isClickable = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`
        metric-card relative overflow-hidden bg-gradient-to-br ${gradient}
        transition-all duration-300 shadow-lg ${shadowColor}
        ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-dashboard-hover' : ''}
        ${isSelected ? 'metric-card-selected ring-2 ring-coral/50 scale-105' : ''}
        w-full text-left
      `}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Icon */}
        <div className="mb-4">
          <div className="w-10 h-10 rounded-card bg-white/20 flex items-center justify-center backdrop-blur-sm">
            {icon}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-white/90 text-xs font-semibold uppercase tracking-wide mb-3">{title}</h3>

        {/* Value + Progress */}
        <div className="flex items-end justify-between">
          <div>
            <p className="metric-value">
              {value.toString().padStart(2, '0')}
            </p>
            <p className="metric-label mt-1">of {total} total</p>
          </div>
          <CircularProgress percentage={percentage} />
        </div>
      </div>
    </button>
  );
};
