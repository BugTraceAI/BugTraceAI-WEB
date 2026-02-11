// components/cli/dashboard/SeverityChart.tsx
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalysisDataPoint {
  date: string;
  urlFindings: number;
  codeFindings: number;
}

interface SeverityChartProps {
  data: AnalysisDataPoint[];
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="dashboard-card p-4 shadow-dashboard">
      <p className="text-white text-sm font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

export const SeverityChart: React.FC<SeverityChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="dashboard-card">
        <h3 className="card-title">Findings Over Time</h3>
        <div className="flex items-center justify-center h-64 text-purple-gray">
          <div className="text-center">
            <p className="text-lg mb-2">No analysis data yet</p>
            <p className="text-sm text-muted">Run scans to see trends here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-title mb-0">Findings Over Time</h3>
        <div className="flex items-center gap-5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-coral"></div>
            <span className="text-purple-gray font-medium">URL Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-elevated"></div>
            <span className="text-purple-gray font-medium">Code Analysis</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorUrl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF7F50" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#FF7F50" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCode" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5D4B7F" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#5D4B7F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#5D4B7F" />
          <XAxis dataKey="date" stroke="#8A7FA8" tick={{ fontSize: 12 }} />
          <YAxis stroke="#8A7FA8" tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="urlFindings"
            name="URL Analysis"
            stroke="#FF7F50"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorUrl)"
          />
          <Area
            type="monotone"
            dataKey="codeFindings"
            name="Code Analysis"
            stroke="#5D4B7F"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCode)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
