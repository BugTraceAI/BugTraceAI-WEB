// components/cli/PastReportsTab.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowPathIcon, ShieldExclamationIcon, TrashIcon, MagnifyingGlassIcon } from '../Icons.tsx';
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
    <div className="flex items-center gap-2 flex-shrink-0">
      {summary.critical > 0 && (
        <span className="flex items-center gap-1 group/sev">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
          <span className="text-[10px] font-bold text-white/60">{summary.critical}</span>
        </span>
      )}
      {summary.high > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"></span>
          <span className="text-[10px] font-bold text-white/60">{summary.high}</span>
        </span>
      )}
      {(summary.medium > 0 || summary.low > 0) && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
          <span className="text-[10px] font-bold text-white/60">{summary.medium + summary.low}</span>
        </span>
      )}
    </div>
  );
};

const ReportsList: React.FC<ReportsListProps> = ({ loading, reports, filteredReports, onSelectReport, onDeleteReport }) => {
  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-coral/20 border-t-coral animate-spin"></div>
      </div>
    );
  }

  if (filteredReports.length === 0) {
    return (
      <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
        <ShieldExclamationIcon className="h-10 w-10 mx-auto text-muted/30 mb-4" />
        <p className="text-white/40 text-sm font-bold uppercase tracking-wider">Empty Database</p>
        <p className="text-muted/40 text-xs mt-1">
          {reports.length === 0 ? 'No intelligence reports found. Run a new scan.' : 'No matches for current filter.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] overflow-hidden">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.02]">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Assessment Target</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Date</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Provider</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Source</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Findings</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filteredReports.map((report) => (
              <tr
                key={report.id}
                onClick={() => onSelectReport(report)}
                className="group hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-white/80 font-mono font-medium truncate max-w-md group-hover:text-coral transition-colors">
                      {report.target_url?.replace(/^https?:\/\//, '') || 'Unknown'}
                    </span>
                    <span className="text-[9px] text-muted font-mono opacity-50">#{report.id.substring(0, 8)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted font-mono">{formatDate(report.scan_date)}</span>
                </td>
                <td className="px-4 py-3">
                  {report.provider ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-purple-500/5 text-purple-400 border-purple-500/20">
                      {report.provider.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${report.origin === 'web'
                    ? 'bg-coral/5 text-coral border-coral/20'
                    : 'bg-blue-500/5 text-blue-400 border-blue-500/20'
                    }`}>
                    {report.origin?.toUpperCase() || 'CLI'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {report.severity_summary ? (
                    <SeverityDots summary={report.severity_summary} />
                  ) : report.findings_count ? (
                    <span className="text-[10px] font-bold text-white/60 font-mono">{report.findings_count}</span>
                  ) : (
                    <span className="text-[9px] text-muted/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteReport(report); }}
                    className="p-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DeleteDialog: React.FC<DeleteDialogProps> = ({ target, deleting, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
    <div className="bg-[#0f0f14] border border-white/10 rounded-2xl max-w-sm w-full mx-4 shadow-2xl p-6">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 mb-4">
          <TrashIcon className="h-6 w-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Purge Intelligence?</h3>
        <p className="text-muted text-xs leading-relaxed mb-4">
          This operation is irreversible. All findings for <br />
          <span className="text-coral font-mono">{target.target_url}</span> will be deleted.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all duration-300"
        >
          Abort Mission
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300"
        >
          {deleting ? 'Purging...' : 'Confirm Purge'}
        </button>
      </div>
    </div>
  </div>
);

export const PastReportsTab: React.FC<PastReportsTabProps> = ({ onViewScan }) => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
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

  // URL-driven report selection: auto-select when reportId is in URL
  useEffect(() => {
    if (reportId && reports.length > 0) {
      const match = reports.find((r) => r.id === reportId);
      if (match) {
        setSelectedReport(match);
      }
    } else if (!reportId) {
      setSelectedReport(null);
    }
  }, [reportId, reports]);

  const filteredReports = reports.filter((report) =>
    !searchQuery || (report.target_url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectReport = (report: CLIReport) => {
    navigate(`/bugtraceai/reports/${report.id}`);
  };

  const handleBack = () => {
    navigate('/bugtraceai/reports');
  };

  if (selectedReport) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ReportMarkdownViewer
          report={selectedReport}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-6">
      {/* Super Bar: Compressed Header & Search */}
      <div className="flex items-center justify-between gap-4 p-3 bg-purple-deep/40 border border-white/5 rounded-2xl backdrop-blur-xl mb-6 shadow-2xl">
        <div className="flex items-center gap-6 flex-1">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/40" />
            <input
              type="text"
              placeholder="Search reports by domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.05] focus:border-coral/30 focus:bg-white/[0.05] text-white text-xs py-2 pl-9 pr-4 rounded-xl transition-all font-mono outline-none placeholder:text-muted/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted uppercase tracking-tighter">Total Assets</span>
            <span className="text-xs font-black text-white/80">{filteredReports.length}</span>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-coral text-white border border-coral-hover rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-glow-coral transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing' : 'Sync'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-[10px] font-bold uppercase tracking-widest p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldExclamationIcon className="h-4 w-4" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="hover:text-white transition-colors underline">Dismiss</button>
        </div>
      )}

      {/* Compressed Active Scans Bar */}
      {activeScans.length > 0 && (
        <div className="space-y-2 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1 mb-2">Ongoing Operations</h3>
          {activeScans.map((scan) => {
            const isPaused = scan.status === 'paused';
            return (
              <div
                key={scan.id}
                className={`group flex items-center justify-between p-3 rounded-xl border backdrop-blur-md transition-all ${isPaused
                  ? 'bg-yellow-500/[0.03] border-yellow-500/20'
                  : 'bg-coral/[0.03] border-coral/20'
                  }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`relative h-2 w-2 rounded-full flex-shrink-0 ${isPaused ? 'bg-yellow-400' : 'bg-coral-hover'
                    }`}>
                    {!isPaused && <div className="absolute inset-0 rounded-full bg-coral-hover animate-ping opacity-40" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-white font-mono font-bold truncate group-hover:text-coral transition-colors">{scan.target_url}</div>
                    <div className="text-[9px] text-muted flex items-center gap-2 mt-0.5">
                      <span className="uppercase font-bold tracking-tighter">{isPaused ? 'Halted' : 'In Progress'}</span>
                      <span className="w-1 h-1 bg-white/10 rounded-full" />
                      <span className="font-mono">{formatElapsed(scan.elapsed_seconds)} elapsed</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleStopScan(scan.id)}
                    disabled={stoppingScanId === scan.id}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-muted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all disabled:opacity-50"
                    title="Terminate operation"
                  >
                    {stoppingScanId === scan.id ? (
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="7" width="10" height="10" rx="1.5" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => isPaused ? handleResumeScan(scan.id) : handlePauseScan(scan.id)}
                    disabled={resumingScanId === scan.id || pausingScanId === scan.id}
                    className={`p-1.5 rounded-lg bg-white/5 border border-white/5 transition-all disabled:opacity-50 ${isPaused ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-yellow-400 hover:bg-yellow-500/10'
                      }`}
                  >
                    {isPaused ? (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="6" width="3" height="12" rx="1" />
                        <rect x="14" y="6" width="3" height="12" rx="1" />
                      </svg>
                    )}
                  </button>

                  <div className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${isPaused ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-coral/10 text-coral border-coral/20'
                    }`}>
                    {scan.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1 mb-2">Historical Records</h3>
        <ReportsList
          loading={loading}
          reports={reports}
          filteredReports={filteredReports}
          onSelectReport={handleSelectReport}
          onDeleteReport={setDeleteTarget}
        />
      </div>

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
