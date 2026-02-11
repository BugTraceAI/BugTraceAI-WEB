// components/cli/PastReportsTab.tsx
// v4.0 - Refactored to use usePastReports hook
/* eslint-disable max-lines -- Past reports tab component (288 lines).
 * Displays historical CLI scan reports with filtering and management.
 * Includes report list, markdown viewer, severity filtering, and deletion.
 * Report management UI with integrated viewer - splitting would fragment report browsing experience.
 */
import React, { useState } from 'react';
import { ArrowPathIcon, ShieldExclamationIcon, TrashIcon } from '../Icons.tsx';
import { ReportMarkdownViewer } from './dashboard/ReportMarkdownViewer.tsx';
import { usePastReports, CLIReport } from '../../hooks/usePastReports.ts';

interface PastReportsTabProps {
  onRescan?: (targetUrl: string) => void;
  onViewScan?: () => void;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

interface DeleteDialogProps {
  target: CLIReport;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

interface ReportsListProps {
  loading: boolean;
  reports: CLIReport[];
  filteredReports: CLIReport[];
  onSelectReport: (report: CLIReport) => void;
  onDeleteReport: (report: CLIReport) => void;
}

const SeverityDots: React.FC<{ summary: CLIReport['severity_summary'] }> = ({ summary }) => {
  if (!summary) return null;
  return (
    <div className="flex items-center gap-3 text-xs flex-shrink-0">
      {summary.critical > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-purple-gray">{summary.critical}</span>
        </span>
      )}
      {summary.high > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          <span className="text-purple-gray">{summary.high}</span>
        </span>
      )}
      {summary.medium > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-purple-gray">{summary.medium}</span>
        </span>
      )}
      {summary.low > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          <span className="text-purple-gray">{summary.low}</span>
        </span>
      )}
    </div>
  );
};

const ReportsList: React.FC<ReportsListProps> = ({ loading, reports, filteredReports, onSelectReport, onDeleteReport }) => {
  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 rounded-full border-2 border-coral/20 border-t-coral animate-spin"></div>
      </div>
    );
  }

  if (filteredReports.length === 0) {
    return (
      <div className="text-center py-16 bg-purple-medium/30 rounded-2xl border-0">
        <ShieldExclamationIcon className="h-12 w-12 mx-auto text-muted mb-4" />
        <p className="text-purple-gray text-lg">No reports found</p>
        <p className="text-muted text-sm mt-1">
          {reports.length === 0 ? 'Run a scan or click Sync' : 'Try adjusting your search'}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-card p-0 overflow-hidden">
      <table className="table-modern">
        <thead>
          <tr>
            <th className="w-14">ID</th>
            <th>Target URL</th>
            <th>Date</th>
            <th>Source</th>
            <th>Findings</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {filteredReports.map((report) => (
            <tr key={report.id} onClick={() => onSelectReport(report)} className="group">
              <td>
                <span className="text-xs font-mono text-muted">#{report.id}</span>
              </td>
              <td>
                <span className="text-sm text-white font-medium truncate block max-w-xs group-hover:text-coral transition-colors" title={report.target_url}>
                  {report.target_url || 'Unknown target'}
                </span>
              </td>
              <td>
                <span className="text-sm text-purple-gray">{formatDate(report.scan_date)}</span>
              </td>
              <td>
                <span className={`status-badge ${
                  report.origin === 'web' ? 'status-badge-coral' : 'status-badge-info'
                }`}>
                  {report.origin === 'web' ? 'WEB' : 'CLI'}
                </span>
              </td>
              <td>
                <SeverityDots summary={report.severity_summary} />
              </td>
              <td>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteReport(report); }}
                  className="p-2 text-muted hover:text-error rounded-lg hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete report"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DeleteDialog: React.FC<DeleteDialogProps> = ({ target, deleting, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="dashboard-card max-w-md w-full mx-4 shadow-dashboard-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-error/10 rounded-card border border-error/20">
          <TrashIcon className="h-5 w-5 text-error" />
        </div>
        <h3 className="card-title mb-0">Delete Report</h3>
      </div>
      <p className="text-purple-gray text-sm mb-3">
        Are you sure you want to delete this report?
      </p>
      <p className="text-purple-gray text-xs font-mono bg-purple-medium/50 rounded-lg px-4 py-3 truncate mb-5 border border-white/5">
        {target.target_url || 'Unknown target'}
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="btn-secondary-modern btn-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="btn-primary-modern btn-sm bg-error hover:bg-red-500 flex items-center gap-2"
        >
          {deleting ? (
            <>
              <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete'
          )}
        </button>
      </div>
    </div>
  </div>
);

export const PastReportsTab: React.FC<PastReportsTabProps> = ({ onViewScan }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<CLIReport | null>(null);

  const {
    reports,
    loading,
    syncing,
    error,
    activeScans,
    deleteTarget,
    deleting,
    stoppingScanId,
    pausingScanId,
    resumingScanId,
    setError,
    setDeleteTarget,
    handleSync,
    handleDelete,
    handleStopScan,
    handlePauseScan,
    handleResumeScan,
  } = usePastReports();

  const filteredReports = reports.filter((report) =>
    !searchQuery || (report.target_url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedReport) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <ReportMarkdownViewer
          report={selectedReport}
          onBack={() => setSelectedReport(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Header */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Security Reports</h1>
            <p className="text-purple-gray text-sm">
              View and manage your security assessment reports
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary-modern btn-sm flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="dashboard-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search reports by URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <span className="text-sm text-purple-gray whitespace-nowrap">
            {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div className={`text-sm p-3 rounded-xl border flex items-center justify-between ${
          error.startsWith('Delete failed')
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
        }`}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-purple-gray hover:text-white text-xs ml-3">Dismiss</button>
        </div>
      )}

      {activeScans.length > 0 && (
        <div className="space-y-2">
          {activeScans.map((scan) => {
            const isPaused = scan.status === 'paused';
            return (
              <div
                key={scan.id}
                className={`border rounded-xl p-4 flex items-center justify-between ${
                  isPaused
                    ? 'bg-yellow-500/10 border-yellow-500/20'
                    : 'bg-coral/10 border-coral/20'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                    isPaused ? 'bg-yellow-400' : 'bg-coral-hover animate-pulse'
                  }`} />
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{scan.target_url}</div>
                    <div className="text-xs text-purple-gray mt-0.5">
                      {isPaused ? 'Paused' : `Elapsed: ${formatElapsed(scan.elapsed_seconds)}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Stop button - always visible */}
                  <button
                    onClick={() => handleStopScan(scan.id)}
                    disabled={stoppingScanId === scan.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Stop scan"
                  >
                    {stoppingScanId === scan.id ? (
                      <>
                        <div className="h-3 w-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                        Stop
                      </>
                    )}
                  </button>

                  {isPaused ? (
                    /* Paused state: Resume button */
                    <button
                      onClick={() => handleResumeScan(scan.id)}
                      disabled={resumingScanId === scan.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      title="Resume scan"
                    >
                      {resumingScanId === scan.id ? (
                        <>
                          <div className="h-3 w-3 rounded-full border-2 border-green-400/30 border-t-green-400 animate-spin" />
                          Resuming...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <polygon points="8,5 19,12 8,19" />
                          </svg>
                          Resume
                        </>
                      )}
                    </button>
                  ) : (
                    /* Running state: Pause button */
                    <button
                      onClick={() => handlePauseScan(scan.id)}
                      disabled={pausingScanId === scan.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      title="Pause scan"
                    >
                      {pausingScanId === scan.id ? (
                        <>
                          <div className="h-3 w-3 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin" />
                          Pausing...
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </svg>
                          Pause
                        </>
                      )}
                    </button>
                  )}

                  {/* Status badge */}
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    isPaused
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-coral/20 text-coral-hover border-coral/30'
                  }`}>
                    {isPaused ? 'Paused' : 'Running'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReportsList
        loading={loading}
        reports={reports}
        filteredReports={filteredReports}
        onSelectReport={setSelectedReport}
        onDeleteReport={setDeleteTarget}
      />

      {deleteTarget && (
        <DeleteDialog
          target={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
};

export type { CLIReport } from '../../hooks/usePastReports.ts';
