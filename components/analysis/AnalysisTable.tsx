// components/analysis/AnalysisTable.tsx
// eslint-disable-next-line max-lines -- Table rendering component with extensive JSX structure (375 lines, 2 hooks)
import React, { useState } from 'react';
import { AnalysisReport } from '../../contexts/AnalysisContext.tsx';
import { LinkIcon, CodeBracketIcon, TrashIcon } from '../Icons.tsx';
import { Severity } from '../../types.ts';

interface AnalysisTableProps {
  analyses: AnalysisReport[];
  onSelectAnalysis: (analysis: AnalysisReport) => void;
  selectedId?: string;
  onDeleteAnalysis?: (id: string) => void;
  onCompareSelected?: (idA: string, idB: string) => void;
  loading?: boolean;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
  analyses,
  onSelectAnalysis,
  selectedId,
  onDeleteAnalysis,
  onCompareSelected,
  loading = false,
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteAnalysis) {
      onDeleteAnalysis(id);
    }
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const handleCheckboxToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedForCompare);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      if (newSelected.size < 2) {
        newSelected.add(id);
      }
    }
    setSelectedForCompare(newSelected);
  };

  const handleCompareClick = () => {
    if (selectedForCompare.size === 2 && onCompareSelected) {
      const [idA, idB] = Array.from(selectedForCompare);
      onCompareSelected(idA, idB);
      setSelectedForCompare(new Set());
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncateTarget = (target: string, maxLength = 50) => {
    if (target.length <= maxLength) return target;
    return target.substring(0, maxLength) + '...';
  };

  const getFindingsSummary = (vulnerabilities: any[]) => {
    if (!vulnerabilities || vulnerabilities.length === 0) {
      return { count: 0, severity: null };
    }

    const severityOrder: Record<string, number> = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 1,
      [Severity.MEDIUM]: 2,
      [Severity.LOW]: 3,
      [Severity.INFO]: 4,
      [Severity.UNKNOWN]: 5,
    };

    const highestSeverity = vulnerabilities.reduce((highest, vuln) => {
      const currentPriority = severityOrder[vuln.severity] ?? 99;
      const highestPriority = severityOrder[highest] ?? 99;
      return currentPriority < highestPriority ? vuln.severity : highest;
    }, Severity.UNKNOWN);

    return { count: vulnerabilities.length, severity: highestSeverity };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case Severity.CRITICAL:
        return 'bg-red-900/40 text-red-300 border-red-700/80';
      case Severity.HIGH:
        return 'bg-orange-900/40 text-orange-300 border-orange-700/80';
      case Severity.MEDIUM:
        return 'bg-yellow-900/40 text-yellow-300 border-yellow-700/80';
      case Severity.LOW:
        return 'bg-blue-900/40 text-blue-300 border-blue-700/80';
      case Severity.INFO:
        return 'bg-gray-900/40 text-gray-300 border-gray-700/80';
      default:
        return 'bg-gray-900/40 text-gray-300 border-gray-700/80';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" data-testid="analysis-table">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-purple-medium/60/50 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-700/50 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-700/50 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="text-center py-16 text-muted" data-testid="analysis-table">
        <CodeBracketIcon className="h-12 w-12 mx-auto mb-4" />
        <p className="font-semibold">No analyses found</p>
        <p className="text-sm">Try adjusting your filters or run a new analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="analysis-table">
      {/* Compare Selected Button */}
      {onCompareSelected && selectedForCompare.size === 2 && (
        <div className="flex justify-center">
          <button
            onClick={handleCompareClick}
            data-testid="compare-selected-btn"
            className="px-6 py-3 bg-coral-active text-white font-semibold rounded-lg hover:bg-coral-active transition-colors shadow-lg"
          >
            Compare Selected ({selectedForCompare.size})
          </button>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-0">
              {onCompareSelected && (
                <th className="text-left py-3 px-4 text-sm font-semibold text-purple-gray w-12">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th className="text-left py-3 px-4 text-sm font-semibold text-purple-gray">Date</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-purple-gray">Type</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-purple-gray">Target</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-purple-gray">Findings</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-purple-gray">Actions</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((analysis) => {
              const findings = getFindingsSummary(analysis.vulnerabilities);
              return (
                <tr
                  key={analysis.id}
                  data-testid={`analysis-row-${analysis.id}`}
                  onClick={() => onSelectAnalysis(analysis)}
                  className={`cursor-pointer transition-all duration-200 border-b border-0/50 ${
                    selectedId === analysis.id
                      ? 'bg-coral/20 ring-2 ring-coral/50'
                      : 'hover:bg-purple-medium/60/50'
                  }`}
                >
                  {onCompareSelected && (
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedForCompare.has(analysis.id)}
                        onChange={(e) => handleCheckboxToggle(e as any, analysis.id)}
                        disabled={!selectedForCompare.has(analysis.id) && selectedForCompare.size >= 2}
                        className="h-4 w-4 rounded border-0 bg-purple-medium/60 text-coral-active focus:ring-coral focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 text-sm text-white">
                    {formatDate(analysis.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {analysis.analysis_type === 'url_analysis' ? (
                        <>
                          <LinkIcon className="h-5 w-5 text-coral" />
                          <span className="text-sm text-white">URL</span>
                        </>
                      ) : (
                        <>
                          <CodeBracketIcon className="h-5 w-5 text-purple-400" />
                          <span className="text-sm text-white">Code</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="text-sm text-white truncate block max-w-md"
                      title={analysis.target}
                    >
                      {truncateTarget(analysis.target, 60)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {findings.count > 0 ? (
                      <span
                        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(
                          findings.severity || ''
                        )}`}
                      >
                        {findings.count} {findings.count === 1 ? 'Finding' : 'Findings'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">No findings</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        data-testid="view-analysis-btn"
                        onClick={() => onSelectAnalysis(analysis)}
                        className="px-3 py-1 text-xs font-semibold text-coral-hover bg-purple-elevated/40 border border-coral/80 rounded-lg hover:bg-purple-elevated/60 transition-colors"
                      >
                        View
                      </button>
                      {onDeleteAnalysis && (
                        <>
                          {deleteConfirmId === analysis.id ? (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleConfirmDelete(e, analysis.id)}
                                className="px-3 py-1 text-xs font-semibold text-red-300 bg-red-900/60 border border-red-700/80 rounded-lg hover:bg-red-900/80 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={handleCancelDelete}
                                className="px-3 py-1 text-xs font-semibold text-purple-gray bg-purple-medium/60 border-0 rounded-lg hover:bg-purple-medium/60/80 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              data-testid="delete-analysis-btn"
                              onClick={(e) => handleDeleteClick(e, analysis.id)}
                              className="px-3 py-1 text-xs font-semibold text-red-300 bg-red-900/40 border border-red-700/80 rounded-lg hover:bg-red-900/60 transition-colors"
                              title="Delete analysis"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {analyses.map((analysis) => {
          const findings = getFindingsSummary(analysis.vulnerabilities);
          return (
            <div
              key={analysis.id}
              data-testid={`analysis-row-${analysis.id}`}
              onClick={() => onSelectAnalysis(analysis)}
              className={`cursor-pointer p-4 rounded-lg transition-all duration-200 ${
                selectedId === analysis.id
                  ? 'bg-coral/20 ring-2 ring-coral/50 shadow-lg'
                  : 'bg-purple-medium/60/50 hover:bg-purple-medium/60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {analysis.analysis_type === 'url_analysis' ? (
                    <LinkIcon className="h-5 w-5 text-coral flex-shrink-0" />
                  ) : (
                    <CodeBracketIcon className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  )}
                  <span className="text-xs text-muted">
                    {analysis.analysis_type === 'url_analysis' ? 'URL Analysis' : 'Code Analysis'}
                  </span>
                </div>
                <span className="text-xs text-muted">{formatDate(analysis.created_at)}</span>
              </div>

              <p className="text-sm text-white font-medium mb-2 truncate" title={analysis.target}>
                {truncateTarget(analysis.target, 50)}
              </p>

              <div className="flex items-center justify-between">
                {findings.count > 0 ? (
                  <span
                    className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(
                      findings.severity || ''
                    )}`}
                  >
                    {findings.count} {findings.count === 1 ? 'Finding' : 'Findings'}
                  </span>
                ) : (
                  <span className="text-xs text-muted">No findings</span>
                )}

                {onDeleteAnalysis && (
                  <>
                    {deleteConfirmId === analysis.id ? (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleConfirmDelete(e, analysis.id)}
                          className="px-2 py-1 text-xs font-semibold text-red-300 bg-red-900/60 border border-red-700/80 rounded-lg"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="px-2 py-1 text-xs font-semibold text-purple-gray bg-purple-medium/60 border-0 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        data-testid="delete-analysis-btn"
                        onClick={(e) => handleDeleteClick(e, analysis.id)}
                        className="p-1.5 text-red-300 bg-red-900/40 border border-red-700/80 rounded-lg hover:bg-red-900/60 transition-colors"
                        title="Delete analysis"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
