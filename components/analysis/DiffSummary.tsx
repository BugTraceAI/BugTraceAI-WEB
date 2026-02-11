// components/analysis/DiffSummary.tsx
import React from 'react';

interface DiffSummaryProps {
  totalNew: number;
  totalFixed: number;
  totalChanged: number;
  totalUnchanged: number;
}

export const DiffSummary: React.FC<DiffSummaryProps> = ({
  totalNew,
  totalFixed,
  totalChanged,
  totalUnchanged,
}) => {
  return (
    <div className="bg-purple-medium/60 border-0 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-semibold text-purple-gray mb-3">Comparison Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* New Vulnerabilities */}
        <div className="flex flex-col items-center p-3 bg-purple-medium/50 rounded-lg border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-400">{totalNew}</div>
          <div className="text-xs text-purple-gray mt-1">New</div>
        </div>

        {/* Fixed Vulnerabilities */}
        <div className="flex flex-col items-center p-3 bg-purple-medium/50 rounded-lg border-l-4 border-red-500">
          <div className="text-2xl font-bold text-red-400">{totalFixed}</div>
          <div className="text-xs text-purple-gray mt-1">Fixed</div>
        </div>

        {/* Changed Severity */}
        <div className="flex flex-col items-center p-3 bg-purple-medium/50 rounded-lg border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-400">{totalChanged}</div>
          <div className="text-xs text-purple-gray mt-1">Changed</div>
        </div>

        {/* Unchanged */}
        <div className="flex flex-col items-center p-3 bg-purple-medium/50 rounded-lg border-l-4 border-0">
          <div className="text-2xl font-bold text-gray-400">{totalUnchanged}</div>
          <div className="text-xs text-purple-gray mt-1">Unchanged</div>
        </div>
      </div>
    </div>
  );
};
