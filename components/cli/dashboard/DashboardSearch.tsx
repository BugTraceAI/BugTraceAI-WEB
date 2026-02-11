// components/cli/dashboard/DashboardSearch.tsx
import React from 'react';
import { MagnifyingGlassIcon } from '../../Icons.tsx';

interface DashboardSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const DashboardSearch: React.FC<DashboardSearchProps> = ({ value, onChange }) => {
  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <MagnifyingGlassIcon className="w-5 h-5 text-muted" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search analyses by target..."
        className="w-full pl-12 pr-4 py-3.5 bg-purple-medium/50 border-0 rounded-xl text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral/30 transition-all duration-300 text-sm"
      />
    </div>
  );
};
