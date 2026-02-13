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
        return 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]';
      case Severity.HIGH:
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case Severity.MEDIUM:
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case Severity.LOW:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case Severity.INFO:
        return 'bg-ui-text-dim/10 text-ui-text-dim border-ui-border';
      default:
        return 'bg-ui-text-dim/10 text-ui-text-dim border-ui-border';
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
        <div className="flex justify-center mb-6">
          <button
            onClick={handleCompareClick}
            data-testid="compare-selected-btn"
            className="btn-mini btn-mini-primary !px-10 !h-12 shadow-glow-coral animate-pulse"
          >
            INITIALIZE COMPARISON SEQUENCE ({selectedForCompare.size})
          </button>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ui-border/50">
              {onCompareSelected && (
                <th className="text-left py-4 px-4 w-12">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th className="text-left py-4 px-4 label-mini !text-ui-text-dim/60">timestamp</th>
              <th className="text-left py-4 px-4 label-mini !text-ui-text-dim/60">category</th>
              <th className="text-left py-4 px-4 label-mini !text-ui-text-dim/60">target endpoint</th>
              <th className="text-left py-4 px-4 label-mini !text-ui-text-dim/60">findings</th>
              <th className="text-right py-4 px-4 label-mini !text-ui-text-dim/60">actions</th>
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
                  className={`group cursor-pointer transition-all duration-300 border-b border-ui-border/30 ${selectedId === analysis.id
                    ? 'bg-ui-accent/10 border-ui-accent/40'
                    : 'hover:bg-ui-input-bg/40'
                    }`}
                >
                  {onCompareSelected && (
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedForCompare.has(analysis.id)}
                        onChange={(e) => handleCheckboxToggle(e as any, analysis.id)}
                        disabled={!selectedForCompare.has(analysis.id) && selectedForCompare.size >= 2}
                        className="h-4 w-4 rounded-lg border-0 bg-purple-medium/60 text-coral-active focus:ring-coral focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 text-sm text-white">
                    {formatDate(analysis.created_at)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {analysis.analysis_type === 'url_analysis' ? (
                        <>
                          <LinkIcon className="h-4 w-4 text-ui-accent" />
                          <span className="text-[11px] font-bold text-ui-text-dim group-hover:text-ui-text-main transition-colors">DAST</span>
                        </>
                      ) : (
                        <>
                          <CodeBracketIcon className="h-4 w-4 text-ui-accent" />
                          <span className="text-[11px] font-bold text-ui-text-dim group-hover:text-ui-text-main transition-colors">SAST</span>
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
                  <td className="py-4 px-4">
                    {findings.count > 0 ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black rounded-lg border ${getSeverityColor(
                          findings.severity || ''
                        )}`}
                      >
                        {findings.count} {findings.count === 1 ? 'FINDING' : 'FINDINGS'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-ui-text-dim/40 font-bold uppercase">Safe</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        data-testid="view-analysis-btn"
                        onClick={() => onSelectAnalysis(analysis)}
                        className="btn-mini btn-mini-primary !h-8 !px-3"
                      >
                        VIEW
                      </button>
                      {onDeleteAnalysis && (
                        <>
                          {deleteConfirmId === analysis.id ? (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleConfirmDelete(e, analysis.id)}
                                className="btn-mini !h-8 !px-3 bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500 transition-colors"
                              >
                                CONFIRM
                              </button>
                              <button
                                onClick={handleCancelDelete}
                                className="btn-mini btn-mini-secondary !h-8 !px-3"
                              >
                                ESC
                              </button>
                            </div>
                          ) : (
                            <button
                              data-testid="delete-analysis-btn"
                              onClick={(e) => handleDeleteClick(e, analysis.id)}
                              className="btn-mini btn-mini-secondary !h-8 !w-8 !p-0"
                              title="Purge Log"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
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
      <div className="lg:hidden space-y-4">
        {analyses.map((analysis) => {
          const findings = getFindingsSummary(analysis.vulnerabilities);
          return (
            <div
              key={analysis.id}
              data-testid={`analysis-row-${analysis.id}`}
              onClick={() => onSelectAnalysis(analysis)}
              className={`cursor-pointer p-5 rounded-2xl transition-all duration-300 border ${selectedId === analysis.id
                ? 'bg-ui-accent/10 border-ui-accent/40 shadow-glow-coral/10'
                : 'bg-ui-input-bg/40 border-ui-border hover:border-ui-accent/20'
                }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {analysis.analysis_type === 'url_analysis' ? (
                    <LinkIcon className="h-4 w-4 text-ui-accent" />
                  ) : (
                    <CodeBracketIcon className="h-4 w-4 text-ui-accent" />
                  )}
                  <span className="label-mini !text-[9px] text-ui-text-dim/60">
                    {analysis.analysis_type === 'url_analysis' ? 'DAST LOG' : 'SAST LOG'}
                  </span>
                </div>
                <span className="label-mini !text-[8px] text-ui-text-dim/40">{formatDate(analysis.created_at)}</span>
              </div>

              <p className="text-[13px] font-bold text-ui-text-main mb-4 truncate" title={analysis.target}>
                {truncateTarget(analysis.target, 50)}
              </p>

              <div className="flex items-center justify-between">
                {findings.count > 0 ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[9px] font-black rounded-lg border ${getSeverityColor(
                      findings.severity || ''
                    )}`}
                  >
                    {findings.count} {findings.count === 1 ? 'FINDING' : 'FINDINGS'}
                  </span>
                ) : (
                  <span className="text-[9px] text-ui-text-dim/40 font-black uppercase">Cleared</span>
                )}

                {onDeleteAnalysis && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectAnalysis(analysis); }}
                      className="btn-mini btn-mini-primary !h-8 !px-4"
                    >
                      VIEW
                    </button>
                    {deleteConfirmId === analysis.id ? (
                      <button
                        onClick={(e) => handleConfirmDelete(e, analysis.id)}
                        className="btn-mini !h-8 !px-3 bg-red-500/10 border-red-500/30 text-red-500"
                      >
                        PURGE
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleDeleteClick(e, analysis.id)}
                        className="btn-mini btn-mini-secondary !h-8 !w-8 !p-0"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
