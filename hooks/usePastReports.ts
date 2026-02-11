// hooks/usePastReports.ts
// Custom hook for managing past reports data and operations
import { useState, useEffect, useRef } from 'react';
import { cliApi } from '../lib/cliApi.ts';

export interface CLIReport {
  id: string;
  target_url: string;
  scan_date: string;
  status: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  report_path: string;
  origin?: string;
  has_report?: boolean;
}

interface ActiveScan {
  id: number;
  status: string;
  target_url: string;
  elapsed_seconds: number;
}

interface UsePastReportsReturn {
  reports: CLIReport[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  activeScans: ActiveScan[];
  deleteTarget: CLIReport | null;
  deleting: boolean;
  stoppingScanId: number | null;
  pausingScanId: number | null;
  resumingScanId: number | null;
  setError: (error: string | null) => void;
  setDeleteTarget: (target: CLIReport | null) => void;
  handleSync: () => Promise<void>;
  handleDelete: (report: CLIReport) => Promise<void>;
  handleStopScan: (scanId: number) => Promise<void>;
  handlePauseScan: (scanId: number) => Promise<void>;
  handleResumeScan: (scanId: number) => Promise<void>;
}

export const usePastReports = (): UsePastReportsReturn => {
  const [reports, setReports] = useState<CLIReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeScans, setActiveScans] = useState<ActiveScan[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CLIReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stoppingScanId, setStoppingScanId] = useState<number | null>(null);
  const [pausingScanId, setPausingScanId] = useState<number | null>(null);
  const [resumingScanId, setResumingScanId] = useState<number | null>(null);
  const prevActiveCountRef = useRef(0);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cliApi.listScans({ per_page: 50 });

      // Derive active scans from the same response (no separate request)
      const nonTerminal = ['running', 'pending', 'initializing', 'paused'];
      const running: ActiveScan[] = response.scans
        .filter(s => nonTerminal.includes(s.status.toLowerCase()))
        .map(s => ({
          id: s.scan_id,
          status: s.status.toLowerCase(),
          target_url: s.target,
          elapsed_seconds: 0,
        }));
      setActiveScans(running);
      prevActiveCountRef.current = running.length;

      // Reports table: only show completed scans that have report files
      // Running/pending scans appear in the active scans banner, not here
      const mapped: CLIReport[] = response.scans
        .filter(s => {
          const status = s.status.toLowerCase();
          const terminal = ['completed', 'stopped', 'failed'].includes(status);
          return terminal && s.has_report !== false;
        })
        .map(s => ({
          id: String(s.scan_id),
          target_url: s.target,
          scan_date: s.timestamp,
          status: s.status,
          severity_summary: null,
          report_path: '',
          origin: s.origin || 'cli',
          has_report: s.has_report,
        }));
      setReports(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  // Lightweight poll: only check running scans, refresh reports when one finishes
  const pollActiveScans = async () => {
    try {
      // Fetch all scans and filter non-terminal locally (no server-side multi-status filter)
      const response = await cliApi.listScans({ per_page: 20 });
      const nonTerminal = ['running', 'pending', 'initializing', 'paused'];
      const running: ActiveScan[] = response.scans
        .filter(s => nonTerminal.includes(s.status.toLowerCase()))
        .map(s => ({
          id: s.scan_id,
          status: s.status.toLowerCase(),
          target_url: s.target,
          elapsed_seconds: 0,
        }));
      setActiveScans(running);

      // A scan finished → refresh reports list to show updated status
      if (running.length < prevActiveCountRef.current) {
        fetchReports();
      }
      prevActiveCountRef.current = running.length;
    } catch {
      // Backend might not be running
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (report: CLIReport) => {
    setDeleting(true);
    try {
      const result = await cliApi.deleteScan(Number(report.id));
      setReports(prev => prev.filter(r => r.id !== report.id));
      setDeleteTarget(null);
      if (report.origin === 'cli' && !result.files_cleaned) {
        setError('Scan deleted. Report files in the reports/ folder were not found — remove them manually if needed.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete report';
      setError(`Delete failed: ${msg}`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleStopScan = async (scanId: number) => {
    setStoppingScanId(scanId);
    try {
      await cliApi.stopScan(scanId);
      setActiveScans(prev => prev.filter(s => s.id !== scanId));
      setTimeout(() => fetchReports(), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stop scan';
      setError(`Stop failed: ${msg}`);
    } finally {
      setStoppingScanId(null);
    }
  };

  const handlePauseScan = async (scanId: number) => {
    setPausingScanId(scanId);
    try {
      await cliApi.pauseScan(scanId);
      // Update local state immediately
      setActiveScans(prev => prev.map(s =>
        s.id === scanId ? { ...s, status: 'paused' } : s
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause scan';
      setError(`Pause failed: ${msg}`);
    } finally {
      setPausingScanId(null);
    }
  };

  const handleResumeScan = async (scanId: number) => {
    setResumingScanId(scanId);
    try {
      await cliApi.resumeScan(scanId);
      // Update local state immediately
      setActiveScans(prev => prev.map(s =>
        s.id === scanId ? { ...s, status: 'running' } : s
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resume scan';
      setError(`Resume failed: ${msg}`);
    } finally {
      setResumingScanId(null);
    }
  };

  // Single initial fetch + lightweight poll for active scans
  useEffect(() => {
    fetchReports();
    const interval = setInterval(pollActiveScans, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
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
  };
};
