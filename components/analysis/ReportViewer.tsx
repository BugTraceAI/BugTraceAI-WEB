// components/analysis/ReportViewer.tsx
/* eslint-disable max-lines -- Analysis report viewer component (376 lines).
 * Comprehensive vulnerability report display with filtering and grouping.
 * Includes severity filtering, vulnerability grouping, metadata display, and export functionality.
 * Rich presentation layer with multiple display modes - splitting would fragment report coherence.
 */
import React, { useEffect, useState } from 'react';
import { useAnalysisContext, AnalysisReport } from '../../contexts/AnalysisContext.tsx';
import { VulnerabilityDetail } from './VulnerabilityDetail.tsx';
import { ExportDropdown } from './ExportDropdown.tsx';
import { Spinner } from '../Spinner.tsx';
import { XMarkIcon, CodeBracketSquareIcon, LinkIcon, TrashIcon } from '../Icons.tsx';

interface ReportViewerProps {
  reportId: string | null;
  onClose: () => void;
  onReRun?: (target: string, type: string) => void;
  onCompare?: (reportId: string) => void;
  onNavigateToChat?: (sessionId: string) => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  reportId,
  onClose,
  onReRun,
  onCompare,
  onNavigateToChat,
}) => {
  const { loadAnalysis, currentAnalysis, loading, error, deleteAnalysis } = useAnalysisContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      if (reportId) {
        try {
          await loadAnalysis(reportId);
        } catch (error) {
          console.error('Failed to load analysis report:', error);
        }
      }
    };
    fetchReport();
  }, [reportId, loadAnalysis]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!reportId) {
    return null;
  }

  const handleDelete = async () => {
    if (currentAnalysis?.id) {
      try {
        await deleteAnalysis(currentAnalysis.id);
        setShowDeleteConfirm(false);
        onClose();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  const handleReRun = () => {
    if (currentAnalysis) {
      onReRun?.(currentAnalysis.target, currentAnalysis.analysis_type);
    }
  };

  const handleNavigateToChat = (sessionId: string) => {
    onClose();
    onNavigateToChat?.(sessionId);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Count vulnerabilities by severity
  const getSeverityCounts = (report: AnalysisReport | null) => {
    if (!report) return {};
    const counts: Record<string, number> = {};
    report.vulnerabilities.forEach((vuln) => {
      counts[vuln.severity] = (counts[vuln.severity] || 0) + 1;
    });
    return counts;
  };

  const severityCounts = currentAnalysis ? getSeverityCounts(currentAnalysis) : {};

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Truncate target for display
  const truncateTarget = (target: string, maxLength: number = 60) => {
    if (target.length <= maxLength) return target;
    return target.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
      data-testid="report-viewer-modal"
    >
      <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-blue-900/20 border border-0 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <header className="p-6 border-b border-0 bg-gradient-to-r from-purple-900/40 to-blue-900/40 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {currentAnalysis?.analysis_type === 'url_analysis' ? (
                  <LinkIcon className="h-6 w-6 text-coral flex-shrink-0" />
                ) : (
                  <CodeBracketSquareIcon className="h-6 w-6 text-purple-400 flex-shrink-0" />
                )}
                <h2 className="text-2xl font-bold text-white">
                  {currentAnalysis?.analysis_type === 'url_analysis' ? 'URL Analysis' : 'Code Analysis'}
                </h2>
              </div>
              <p
                className="text-coral-hover font-mono text-sm break-all"
                title={currentAnalysis?.target || ''}
              >
                {currentAnalysis ? truncateTarget(currentAnalysis.target) : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              data-testid="report-viewer-close"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Metadata Bar */}
          {currentAnalysis && (
            <div className="mt-4 pt-4 border-t border-purple-500/20 flex flex-wrap items-center gap-4 text-sm text-purple-gray">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>{formatDate(currentAnalysis.created_at)}</span>
              </div>
              {currentAnalysis.metadata?.model && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="font-mono text-xs">{currentAnalysis.metadata.model}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>
                  {currentAnalysis.vulnerabilities.length} vulnerabilit
                  {currentAnalysis.vulnerabilities.length === 1 ? 'y' : 'ies'}
                </span>
                {Object.keys(severityCounts).length > 0 && (
                  <span className="text-xs text-muted">
                    (
                    {Object.entries(severityCounts)
                      .map(([sev, count]) => `${count} ${sev}`)
                      .join(', ')}
                    )
                  </span>
                )}
              </div>
              {/* Linked Chat Session */}
              {currentAnalysis.session && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-purple-900/20 rounded-lg">
                  <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                  <span className="text-purple-gray">Linked to chat: </span>
                  <button
                    onClick={() => handleNavigateToChat(currentAnalysis.session!.id)}
                    className="text-purple-400 hover:text-purple-300 underline transition-colors"
                    data-testid="linked-session-btn"
                  >
                    {currentAnalysis.session.title}
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Action Buttons */}
        <div className="px-6 py-3 border-b border-purple-500/20 bg-black/20 flex flex-wrap items-center gap-2 flex-shrink-0">
          {onReRun && (
            <button
              onClick={handleReRun}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold gradient-blue-indigo text-white rounded-lg hover:brightness-110 transition-all duration-300 shadow-md shadow-blue-500/20"
              data-testid="report-viewer-rerun"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Re-run Analysis
            </button>
          )}
          {onCompare && (
            <button
              onClick={() => onCompare(reportId)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold gradient-purple-blue text-white rounded-lg hover:brightness-110 transition-all duration-300 shadow-md shadow-purple-500/20"
              disabled
              title="Compare feature coming in Plan 04"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Compare
            </button>
          )}
          {reportId && <ExportDropdown reportId={reportId} />}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-200 bg-red-900/40 border border-red-700/80 rounded-lg hover:bg-red-900/60 transition-colors ml-auto"
            data-testid="report-viewer-delete"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Spinner />
              <p className="text-purple-gray">Loading analysis...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-200">
              <h3 className="font-bold mb-2">Error Loading Analysis</h3>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && currentAnalysis && (
            <div className="space-y-6">
              {currentAnalysis.vulnerabilities.length === 0 ? (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-8 text-center">
                  <svg
                    className="h-16 w-16 text-green-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h3 className="text-xl font-bold text-green-300 mb-2">No Vulnerabilities Found</h3>
                  <p className="text-purple-gray">The analysis completed successfully with no security issues detected.</p>
                </div>
              ) : (
                currentAnalysis.vulnerabilities.map((vuln, index) => (
                  <VulnerabilityDetail
                    key={index}
                    vulnerability={vuln}
                    index={index}
                    targetUrl={currentAnalysis.target}
                    onReAnalyze={(_v) => {
                      // Close modal and trigger re-run with this specific vulnerability
                      onClose();
                      onReRun?.(currentAnalysis.target, currentAnalysis.analysis_type);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-0 bg-gradient-to-r from-black/30 to-black/10 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </footer>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(false);
            }
          }}
        >
          <div className="bg-gray-900 border border-red-500/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-3">Delete Analysis?</h3>
            <p className="text-purple-gray mb-6">
              This will permanently delete this analysis report. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
