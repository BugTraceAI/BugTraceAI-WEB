// components/analysis/ComparisonView.tsx
/* eslint-disable max-lines -- Comparison view component (282 lines).
 * Renders side-by-side vulnerability report comparison with 4 sections:
 * new, fixed, changed, and unchanged vulnerabilities.
 * Structure follows natural report comparison flow - splitting would fragment the comparison logic.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DiffSummary } from './DiffSummary.tsx';
import { VulnerabilityDetail } from './VulnerabilityDetail.tsx';
import { Vulnerability } from '../../types.ts';
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '../Icons.tsx';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ComparisonViewProps {
  reportIdA: string;
  reportIdB: string;
  onClose: () => void;
}

interface SeverityChange {
  vulnerability: string;
  old_severity: string;
  new_severity: string;
  description: string;
}

interface ComparisonResult {
  reportA: {
    id: string;
    target: string;
    created_at: string;
    vulnerability_count: number;
  };
  reportB: {
    id: string;
    target: string;
    created_at: string;
    vulnerability_count: number;
  };
  diff: {
    new_vulnerabilities: Vulnerability[];
    fixed_vulnerabilities: Vulnerability[];
    severity_changes: SeverityChange[];
    unchanged_vulnerabilities: Vulnerability[];
  };
  summary: {
    total_new: number;
    total_fixed: number;
    total_changed: number;
    total_unchanged: number;
  };
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  reportIdA,
  reportIdB,
  onClose,
}) => {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unchangedExpanded, setUnchangedExpanded] = useState(false);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`${API_BASE_URL}/analyses/compare`, {
          params: { a: reportIdA, b: reportIdB },
        });
        setComparison(res.data.data);
      } catch (err: any) {
        const message = err.response?.data?.error || err.message || 'Failed to load comparison';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [reportIdA, reportIdB]);

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

  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
        data-testid="comparison-view-modal"
      >
        <div className="bg-purple-medium/50 border-0 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral"></div>
            <span className="ml-3 text-white">Loading comparison...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
        data-testid="comparison-view-modal"
      >
        <div className="bg-purple-medium/50 border-0 rounded-xl p-8 max-w-md w-full mx-4">
          <h3 className="text-xl font-bold text-red-400 mb-4">Error</h3>
          <p className="text-purple-gray mb-6">{error || 'Failed to load comparison'}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-purple-medium/60 text-white font-semibold rounded-lg hover:bg-purple-medium/60/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
      data-testid="comparison-view-modal"
    >
      <div
        className="bg-purple-medium/50 border-0 rounded-xl w-full max-w-6xl my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-0">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-4">Analysis Comparison</h2>

            {/* Report Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-purple-medium/60 border-0 rounded-lg p-3">
                <div className="text-purple-gray mb-1">Report A (Baseline)</div>
                <div className="font-semibold text-white truncate">{comparison.reportA.target}</div>
                <div className="text-xs text-purple-gray mt-1">{formatDate(comparison.reportA.created_at)}</div>
                <div className="text-xs text-purple-gray">{comparison.reportA.vulnerability_count} findings</div>
              </div>
              <div className="bg-purple-medium/60 border-0 rounded-lg p-3">
                <div className="text-purple-gray mb-1">Report B (Current)</div>
                <div className="font-semibold text-white truncate">{comparison.reportB.target}</div>
                <div className="text-xs text-purple-gray mt-1">{formatDate(comparison.reportB.created_at)}</div>
                <div className="text-xs text-purple-gray">{comparison.reportB.vulnerability_count} findings</div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="ml-4 p-2 text-purple-gray hover:text-white transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {/* Summary */}
          <DiffSummary
            totalNew={comparison.summary.total_new}
            totalFixed={comparison.summary.total_fixed}
            totalChanged={comparison.summary.total_changed}
            totalUnchanged={comparison.summary.total_unchanged}
          />

          {/* New Vulnerabilities */}
          {comparison.diff.new_vulnerabilities.length > 0 && (
            <div className="mb-6" data-testid="new-vulnerabilities">
              <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center">
                <span className="inline-block w-1 h-5 bg-green-500 mr-2"></span>
                New Vulnerabilities ({comparison.diff.new_vulnerabilities.length})
              </h3>
              <div className="space-y-3">
                {comparison.diff.new_vulnerabilities.map((vuln, index) => (
                  <div key={index} className="border-l-4 border-green-500 bg-purple-medium/60 rounded-lg p-4">
                    <VulnerabilityDetail vulnerability={vuln} index={index} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fixed Vulnerabilities */}
          {comparison.diff.fixed_vulnerabilities.length > 0 && (
            <div className="mb-6" data-testid="fixed-vulnerabilities">
              <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center">
                <span className="inline-block w-1 h-5 bg-red-500 mr-2"></span>
                Fixed Vulnerabilities ({comparison.diff.fixed_vulnerabilities.length})
              </h3>
              <div className="space-y-3">
                {comparison.diff.fixed_vulnerabilities.map((vuln, index) => (
                  <div key={index} className="border-l-4 border-red-500 bg-purple-medium/60 rounded-lg p-4">
                    <VulnerabilityDetail vulnerability={vuln} index={index} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Severity Changes */}
          {comparison.diff.severity_changes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center">
                <span className="inline-block w-1 h-5 bg-yellow-500 mr-2"></span>
                Severity Changes ({comparison.diff.severity_changes.length})
              </h3>
              <div className="space-y-3">
                {comparison.diff.severity_changes.map((change, index) => (
                  <div key={index} className="border-l-4 border-yellow-500 bg-purple-medium/60 rounded-lg p-4">
                    <div className="font-semibold text-white mb-2">{change.vulnerability}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-500/20 text-red-400">
                        {change.old_severity}
                      </span>
                      <span className="text-purple-gray">→</span>
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-green-500/20 text-green-400">
                        {change.new_severity}
                      </span>
                    </div>
                    <p className="text-sm text-purple-gray">{change.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unchanged Vulnerabilities (Collapsed by default) */}
          {comparison.diff.unchanged_vulnerabilities.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setUnchangedExpanded(!unchangedExpanded)}
                className="w-full flex items-center justify-between text-lg font-bold text-gray-400 mb-3 hover:text-gray-300 transition-colors"
              >
                <div className="flex items-center">
                  <span className="inline-block w-1 h-5 bg-gray-500 mr-2"></span>
                  Unchanged Vulnerabilities ({comparison.diff.unchanged_vulnerabilities.length})
                </div>
                {unchangedExpanded ? (
                  <ChevronUpIcon className="h-5 w-5" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5" />
                )}
              </button>
              {unchangedExpanded && (
                <div className="space-y-3">
                  {comparison.diff.unchanged_vulnerabilities.map((vuln, index) => (
                    <div key={index} className="border-l-4 border-0 bg-purple-medium/60 rounded-lg p-4 opacity-75">
                      <VulnerabilityDetail vulnerability={vuln} index={index} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {comparison.summary.total_new === 0 &&
            comparison.summary.total_fixed === 0 &&
            comparison.summary.total_changed === 0 &&
            comparison.summary.total_unchanged === 0 && (
              <div className="text-center py-12 text-purple-gray">
                <p>No differences found between the two reports.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
