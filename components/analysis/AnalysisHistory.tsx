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
      className="card-premium p-6 sm:p-8 animate-fade-in !bg-ui-bg/40"
      data-testid="analysis-history"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-ui-accent/10 border border-ui-accent/20 flex items-center justify-center shadow-lg shadow-ui-accent/5 rotate-3 hover:rotate-0 transition-transform duration-500">
            <HistoryIcon className="h-6 w-6 text-ui-accent" />
          </div>
          <div>
            <span className="label-mini text-ui-accent mb-0.5 block">Archive Retrieval</span>
            <h3 className="title-standard !text-2xl">Mission Intelligence</h3>
            <p className="text-ui-text-dim/60 text-xs">Access centralized security audit logs and mission reports</p>
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
            className="btn-mini btn-mini-secondary !h-10 !px-4"
            title="Update Mission Logs"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            REFRESH LOGS
          </button>

          {/* Toggle Filters Button (Mobile) */}
          <button
            onClick={() => setFiltersVisible(!filtersVisible)}
            className="sm:hidden btn-mini btn-mini-secondary !h-10 !px-4"
          >
            {filtersVisible ? (
              <>
                <ChevronUpIcon className="h-4 w-4 mr-2" />
                HIDE FILTERS
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-4 w-4 mr-2" />
                SHOW FILTERS
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
        <div className="mb-4">
          <span className="label-mini !text-[10px] text-ui-text-dim/50">
            RETRIEVED RECORDS: {(currentPage - 1) * itemsPerPage + 1} TO {(currentPage - 1) * itemsPerPage + analyses.length}
          </span>
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
            className="btn-mini btn-mini-secondary !px-6"
          >
            PREVIOUS STAGE
          </button>

          <span className="label-mini !text-ui-accent tracking-widest">LAYER {currentPage}</span>

          <button
            onClick={handleNextPage}
            disabled={!hasNextPage}
            className="btn-mini btn-mini-secondary !px-6"
          >
            NEXT STAGE
          </button>
        </div>
      )}
    </div>
  );
};
