// components/analysis/AnalysisFilters.tsx
import React from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '../Icons.tsx';

interface AnalysisFiltersProps {
  filters: {
    analysisType: string; // 'all' | 'url_analysis' | 'code_analysis'
    dateFrom: string; // ISO date string or empty
    dateTo: string;
    searchTarget: string;
  };
  onFilterChange: (filters: AnalysisFiltersProps['filters']) => void;
  disabled?: boolean;
}

export const AnalysisFilters: React.FC<AnalysisFiltersProps> = ({
  filters,
  onFilterChange,
  disabled = false,
}) => {
  const handleClearFilters = () => {
    onFilterChange({
      analysisType: 'all',
      dateFrom: '',
      dateTo: '',
      searchTarget: '',
    });
  };

  const hasActiveFilters =
    filters.analysisType !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.searchTarget !== '';

  return (
    <div className="bg-purple-medium/60/50 backdrop-blur-sm p-4 rounded-lg border-0 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Type Filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-purple-gray mb-1.5">
            Analysis Type
          </label>
          <select
            data-testid="analysis-type-filter"
            value={filters.analysisType}
            onChange={(e) => onFilterChange({ ...filters, analysisType: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-purple-medium/60 border-0 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-50"
          >
            <option value="all">All Types</option>
            <option value="url_analysis">URL Analysis (DAST)</option>
            <option value="code_analysis">Code Analysis (SAST)</option>
            <option value="jwt_analysis">JWT Analysis</option>
            <option value="security_headers">Security Headers</option>
            <option value="file_upload">File Upload Audit</option>
          </select>
        </div>

        {/* Date From */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-purple-gray mb-1.5">
            Date From
          </label>
          <input
            data-testid="date-from-filter"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-purple-medium/60 border-0 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-50"
          />
        </div>

        {/* Date To */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-purple-gray mb-1.5">
            Date To
          </label>
          <input
            data-testid="date-to-filter"
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 bg-purple-medium/60 border-0 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Search Target */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <label className="block text-sm font-medium text-purple-gray mb-1.5">
            Search Target
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
            <input
              data-testid="search-target-filter"
              type="text"
              value={filters.searchTarget}
              onChange={(e) => onFilterChange({ ...filters, searchTarget: e.target.value })}
              disabled={disabled}
              placeholder="Search by URL or code snippet..."
              className="w-full pl-10 pr-3 py-2 bg-purple-medium/60 border-0 rounded-lg text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="self-end">
            <button
              data-testid="clear-filters-btn"
              onClick={handleClearFilters}
              disabled={disabled}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-purple-gray bg-purple-medium/60 border-0 rounded-lg hover:bg-purple-medium/60/80 hover:text-white disabled:opacity-50 transition-colors"
              title="Clear all filters"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
