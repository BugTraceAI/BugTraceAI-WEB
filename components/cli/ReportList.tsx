// components/cli/ReportList.tsx
/* eslint-disable max-lines -- CLI report list component (228 lines).
 * Displays and manages historical CLI scan reports with filtering.
 * Includes report fetching, severity filtering, selection handling, and refresh.
 * List management with complex filtering logic - splitting would fragment list operations.
 */
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon } from '../Icons.tsx';

interface Report {
  id: string;
  target_url: string;
  scan_date: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  report_path: string;
}

interface ReportListProps {
  selectedReportId: string | null;
  onSelectReport: (report: Report) => void;
}

export const ReportList: React.FC<ReportListProps> = ({ selectedReportId, onSelectReport }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const fetchReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/cli/reports?limit=100`);
      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.statusText}`);
      }

      const data = await response.json();
      setReports(data.data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}/cli/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to sync reports: ${response.statusText}`);
      }

      // Refresh the list after syncing
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync reports');
      console.error('Error syncing reports:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown date';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateUrl = (url: string | null, maxLength: number = 30): string => {
    if (!url) return 'Unknown target';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  if (loading) {
    return (
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex items-center justify-center">
        <div className="text-purple-gray text-sm">Loading reports...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <div className="text-red-400 text-sm mb-4">{error}</div>
        <button
          onClick={fetchReports}
          className="w-full px-3 py-2 bg-coral-active hover:bg-coral-active text-white rounded-lg transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col" data-testid="past-reports-list">
      {/* Header with action buttons */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Past Reports</h3>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-1 text-muted hover:text-coral transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          data-testid="past-reports-sync-button"
          className="w-full px-3 py-1.5 bg-coral-active hover:bg-coral-active disabled:bg-gray-600 text-white rounded text-xs transition-colors flex items-center justify-center gap-2"
        >
          {syncing ? (
            <>
              <ArrowPathIcon className="h-3 w-3 animate-spin" />
              Syncing...
            </>
          ) : (
            'Sync Reports'
          )}
        </button>
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto">
        {reports.length === 0 ? (
          <div className="p-4 text-center text-purple-gray text-sm">
            <p>No reports found</p>
            <p className="text-xs text-muted mt-2">
              Run a scan or click "Sync Reports"
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => onSelectReport(report)}
                data-testid={`past-reports-item-${report.id}`}
                className={`
                  p-3 cursor-pointer transition-colors
                  ${selectedReportId === report.id
                    ? 'bg-gray-600'
                    : 'hover:bg-gray-700'
                  }
                `}
              >
                {/* Target URL */}
                <div
                  className="text-sm font-medium text-white mb-1 truncate"
                  title={report.target_url || 'Unknown target'}
                >
                  {truncateUrl(report.target_url)}
                </div>

                {/* Scan date */}
                <div className="text-xs text-muted mb-2">
                  {formatDate(report.scan_date)}
                </div>

                {/* Severity badges */}
                {report.severity_summary && (
                  <div className="flex items-center gap-2 text-xs">
                    {report.severity_summary.critical > 0 && (
                      <div className="flex items-center gap-1" title="Critical">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                        <span className="text-purple-gray">{report.severity_summary.critical}</span>
                      </div>
                    )}
                    {report.severity_summary.high > 0 && (
                      <div className="flex items-center gap-1" title="High">
                        <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
                        <span className="text-purple-gray">{report.severity_summary.high}</span>
                      </div>
                    )}
                    {report.severity_summary.medium > 0 && (
                      <div className="flex items-center gap-1" title="Medium">
                        <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span className="text-purple-gray">{report.severity_summary.medium}</span>
                      </div>
                    )}
                    {report.severity_summary.low > 0 && (
                      <div className="flex items-center gap-1" title="Low">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                        <span className="text-purple-gray">{report.severity_summary.low}</span>
                      </div>
                    )}
                    {!report.severity_summary.critical &&
                      !report.severity_summary.high &&
                      !report.severity_summary.medium &&
                      !report.severity_summary.low && (
                      <span className="text-muted">No findings</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
