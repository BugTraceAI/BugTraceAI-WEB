// components/cli/ReportList.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, MagnifyingGlassIcon } from '../Icons.tsx';

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
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const truncateUrl = (url: string | null): string => {
    if (!url) return 'Unknown target';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  if (loading) {
    return (
      <div className="w-72 bg-purple-deep/10 border-r border-white/[0.05] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-coral/20 border-t-coral animate-spin rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-72 bg-black/20 backdrop-blur-md border-r border-ui-border flex flex-col h-full overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="label-mini !text-ui-text-dim/60">Assessments</h3>
          <button
            onClick={fetchReports}
            className="p-1.5 text-ui-text-dim hover:text-white bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg transition-all duration-200"
            title="Refresh"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full btn-mini btn-mini-secondary !bg-coral/10 !text-coral !border-coral/20 hover:!bg-coral/20"
        >
          {syncing ? (
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
          ) : (
            'Synchronize'
          )}
        </button>
      </div>

      {/* Reports List */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6 px-3">
        {reports.length === 0 ? (
          <div className="px-4 py-8 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-xl">
            <MagnifyingGlassIcon className="h-6 w-6 text-muted/20 mx-auto mb-2" />
            <p className="text-[10px] uppercase font-bold text-muted">No data found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {reports.map((report) => {
              const isActive = selectedReportId === report.id;
              return (
                <div
                  key={report.id}
                  onClick={() => onSelectReport(report)}
                  className={`
                    group relative p-3 rounded-xl cursor-pointer transition-all duration-200
                    ${isActive
                      ? 'bg-white/[0.05] shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]'
                      : 'hover:bg-white/[0.03]'
                    }
                  `}
                >
                  {/* Selector mark */}
                  {isActive && (
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-coral rounded-full" />
                  )}

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[11px] font-bold transition-colors truncate ${isActive ? 'text-coral' : 'text-white/80 group-hover:text-white'}`}>
                        {truncateUrl(report.target_url)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-muted uppercase tracking-tighter">
                        {formatDate(report.scan_date)}
                      </span>

                      {/* Mini Severity Indicators */}
                      {report.severity_summary && (
                        <div className="flex items-center gap-1">
                          {report.severity_summary.critical > 0 && (
                            <div className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                          )}
                          {report.severity_summary.high > 0 && (
                            <div className="w-1 h-1 rounded-full bg-orange-500" />
                          )}
                          {(report.severity_summary.medium > 0 || report.severity_summary.low > 0) && (
                            <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
