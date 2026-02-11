// components/analysis/AnalysisHistory.tsx
import React, { useState, useEffect } from 'react';
import { useAnalysisContext, AnalysisReport } from '../../contexts/AnalysisContext.tsx';
import { AnalysisFilters } from './AnalysisFilters.tsx';
import { AnalysisTable } from './AnalysisTable.tsx';
import { HistoryIcon, ChevronDownIcon, ChevronUpIcon, ArrowPathIcon } from '../Icons.tsx';

interface AnalysisHistoryProps {
  onSelectAnalysis: (analysis: AnalysisReport) => void;
  onCompareReports?: (idA: string, idB: string) => void;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({
  onSelectAnalysis,
  onCompareReports,
}) => {
  const { analyses, loading, loadAnalyses, deleteAnalysis } = useAnalysisContext();

  const [filters, setFilters] = useState({
    analysisType: 'all',
    dateFrom: '',
    dateTo: '',
    searchTarget: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const itemsPerPage = 20;

  // Load analyses on mount and when filters change
  useEffect(() => {
    const loadData = async () => {
      try {
        const apiFilters: any = {
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage,
        };

        if (filters.analysisType !== 'all') {
          apiFilters.analysis_type = filters.analysisType;
        }

        if (filters.searchTarget) {
          apiFilters.target = filters.searchTarget;
        }

        await loadAnalyses(apiFilters);
      } catch (error) {
        console.error('Failed to load analyses:', error);
      }
    };

    loadData();
  }, [filters, currentPage, loadAnalyses]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleDeleteAnalysis = async (id: string) => {
    try {
      await deleteAnalysis(id);
      // Reload current page after deletion
      const apiFilters: any = {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      if (filters.analysisType !== 'all') {
        apiFilters.analysis_type = filters.analysisType;
      }

      if (filters.searchTarget) {
        apiFilters.target = filters.searchTarget;
      }

      await loadAnalyses(apiFilters);
    } catch (error) {
      console.error('Failed to delete analysis:', error);
    }
  };

  const handleNextPage = () => {
    if (analyses.length === itemsPerPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const hasNextPage = analyses.length === itemsPerPage;
  const hasPrevPage = currentPage > 1;

  return (
    <div
      className="bg-purple-medium/50 backdrop-blur-xl p-6 sm:p-8 rounded-xl border-0 shadow-xl animate-fade-in"
      data-testid="analysis-history"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <HistoryIcon className="h-8 w-8 text-coral" />
          <div>
            <h3 className="text-2xl font-bold text-white">Analysis History</h3>
            <p className="text-purple-gray text-sm">Browse and filter your saved analyses</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => {
              setCurrentPage(1);
              loadAnalyses({ limit: itemsPerPage, offset: 0 });
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-purple-gray bg-purple-medium/60 border-0 rounded-lg hover:bg-coral/20 hover:text-coral disabled:opacity-50 transition-colors"
            title="Refresh list"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Toggle Filters Button (Mobile) */}
          <button
            onClick={() => setFiltersVisible(!filtersVisible)}
            className="sm:hidden flex items-center gap-2 px-3 py-2 text-sm font-semibold text-purple-gray bg-purple-medium/60 border-0 rounded-lg hover:bg-purple-medium/60/80 transition-colors"
          >
            {filtersVisible ? (
              <>
                <ChevronUpIcon className="h-4 w-4" />
                Hide Filters
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-4 w-4" />
                Show Filters
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      {filtersVisible && (
        <div className="mb-6">
          <AnalysisFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            disabled={loading}
          />
        </div>
      )}

      {/* Results Summary */}
      {!loading && analyses.length > 0 && (
        <div className="mb-4 text-sm text-purple-gray">
          Showing {(currentPage - 1) * itemsPerPage + 1}–
          {(currentPage - 1) * itemsPerPage + analyses.length} analyses
        </div>
      )}

      {/* Table Section */}
      <div className="mb-6">
        <AnalysisTable
          analyses={analyses}
          onSelectAnalysis={onSelectAnalysis}
          onDeleteAnalysis={handleDeleteAnalysis}
          onCompareSelected={onCompareReports}
          loading={loading}
        />
      </div>

      {/* Pagination Controls */}
      {!loading && (hasPrevPage || hasNextPage) && (
        <div className="flex justify-between items-center pt-4 border-t border-0">
          <button
            onClick={handlePrevPage}
            disabled={!hasPrevPage}
            className="px-4 py-2 text-sm font-semibold text-white bg-purple-medium/60 border-0 rounded-lg hover:bg-purple-medium/60/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <span className="text-sm text-purple-gray">Page {currentPage}</span>

          <button
            onClick={handleNextPage}
            disabled={!hasNextPage}
            className="px-4 py-2 text-sm font-semibold text-white bg-purple-medium/60 border-0 rounded-lg hover:bg-purple-medium/60/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
