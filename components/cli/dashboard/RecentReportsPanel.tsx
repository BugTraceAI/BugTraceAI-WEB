// components/cli/dashboard/RecentReportsPanel.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon } from '../../Icons.tsx';

export interface CLIReport {
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
  origin?: string; // "cli" or "web" — where scan was launched
  has_report?: boolean; // Whether report files exist on disk
}

interface RecentReportsPanelProps {
  onSelectReport?: (report: CLIReport) => void;
}

export const RecentReportsPanel: React.FC<RecentReportsPanelProps> = ({ onSelectReport }) => {
  const [reports, setReports] = useState<CLIReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/cli/reports?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setReports(data.data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}/cli/sync`, { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenReport = (report: CLIReport) => {
    if (onSelectReport) {
      onSelectReport(report);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const truncateUrl = (url: string | null, maxLength: number = 35): string => {
    if (!url) return 'Unknown target';
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  return (
    <div className="bg-purple-medium/50 backdrop-blur-xl rounded-2xl p-6 border-0 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">CLI Scan Reports</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="p-1.5 text-muted hover:text-coral transition-colors disabled:opacity-50 rounded-lg hover:bg-white/5"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full px-3 py-2 mb-4 bg-coral-active/20 hover:bg-coral-active/30 disabled:bg-gray-600/20 text-coral border border-coral/30 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
      >
        {syncing ? (
          <>
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
            Syncing...
          </>
        ) : (
          'Sync CLI Reports'
        )}
      </button>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {error && (
          <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-xl border border-red-500/20">
            {error}
          </div>
        )}

        {loading && reports.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-purple-gray text-sm">Loading...</div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-purple-gray text-sm">No CLI reports found</p>
            <p className="text-muted text-xs mt-1">Run a scan or click Sync</p>
          </div>
        ) : (
          reports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleOpenReport(report)}
              className="w-full text-left bg-purple-light/30 rounded-xl p-3 hover:bg-purple-light/50 transition-all duration-200 group"
            >
              <div className="text-sm text-white font-medium truncate group-hover:text-coral-hover transition-colors" title={report.target_url}>
                {truncateUrl(report.target_url)}
              </div>
              <div className="text-xs text-muted mt-1">{formatDate(report.scan_date)}</div>

              {/* Severity dots */}
              {report.severity_summary && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  {report.severity_summary.critical > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-purple-gray">{report.severity_summary.critical}</span>
                    </span>
                  )}
                  {report.severity_summary.high > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <span className="text-purple-gray">{report.severity_summary.high}</span>
                    </span>
                  )}
                  {report.severity_summary.medium > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      <span className="text-purple-gray">{report.severity_summary.medium}</span>
                    </span>
                  )}
                  {report.severity_summary.low > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      <span className="text-purple-gray">{report.severity_summary.low}</span>
                    </span>
                  )}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
