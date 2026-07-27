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
    <div className="card-premium !bg-dashboard-bg/50 !p-6 space-y-6 border-ui-accent/10">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Type Filter */}
        <div className="flex-1">
          <label className="label-mini !text-ui-text-dim/60 mb-2 block">
            MISSION TYPE
          </label>
          <select
            data-testid="analysis-type-filter"
            value={filters.analysisType}
            onChange={(e) => onFilterChange({ ...filters, analysisType: e.target.value })}
            disabled={disabled}
            className="input-premium w-full !h-11 px-4 !bg-ui-bg/50 uppercase font-black text-[10px] tracking-wider"
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
          <label className="label-mini !text-ui-text-dim/60 mb-2 block">
            TIMELINE START
          </label>
          <input
            data-testid="date-from-filter"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
            disabled={disabled}
            className="input-premium w-full !h-11 px-4 !bg-ui-bg/50 uppercase font-black text-[10px]"
          />
        </div>

        {/* Date To */}
        <div className="flex-1">
          <label className="label-mini !text-ui-text-dim/60 mb-2 block">
            TIMELINE END
          </label>
          <input
            data-testid="date-to-filter"
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
            disabled={disabled}
            className="input-premium w-full !h-11 px-4 !bg-ui-bg/50 uppercase font-black text-[10px]"
          />
        </div>
      </div>

      {/* Search Target */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 relative">
          <label className="label-mini !text-ui-text-dim/60 mb-2 block">
            LOG SEARCH QUERY
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ui-text-dim/40" />
            <input
              data-testid="search-target-filter"
              type="text"
              value={filters.searchTarget}
              onChange={(e) => onFilterChange({ ...filters, searchTarget: e.target.value })}
              disabled={disabled}
              placeholder="Filter by target mission URL or pattern..."
              className="input-premium w-full !h-11 pl-11 pr-4 !bg-ui-bg/50"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            data-testid="clear-filters-btn"
            onClick={handleClearFilters}
            disabled={disabled}
            className="btn-mini btn-mini-secondary !h-11 !px-6"
            title="Clear all filters"
          >
            <XMarkIcon className="h-4 w-4 mr-2" />
            RESET
          </button>
        )}
      </div>
    </div>
  );
};
