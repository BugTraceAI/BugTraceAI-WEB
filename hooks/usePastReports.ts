// hooks/usePastReports.ts
// Custom hook for managing past reports data and operations
// Supports both the CLI engine and the BugTraceAI-API engine.
// - CLI reports: engine="cli", id is numeric (as string), delete via cliApi.deleteScan(Number(id)).
// - API reports: engine="api", id is opaque string, stop via btaiApi.stopScan(string id).
// - Report keys are engine-qualified: `cli:${id}` / `api:${id}`.
// - Legacy CLI origins are normalized at read time (see normalizeLaunchOrigin).
import { useState, useEffect, useRef, useCallback } from 'react';
import { cliApi } from '../lib/cliApi.ts';
import { createBtaiApi, BtaiApiListItem } from '../lib/btaiApi.ts';
import type { ScanEngine as ScanEngineType } from '../types.ts';
import { normalizeLaunchOrigin, getReportSource as getReportSourceImpl } from '../types.ts';
import { useSettings } from '../contexts/SettingsProvider.tsx';

/** Launch origin canonical values per HANDOFF §B.1. */
export type LaunchOrigin = 'web-cli' | 'web-api' | 'cli' | 'api' | 'legacy-unknown';
/** Engine discriminator — selects the client, route, viewer and capabilities. */
export type ScanEngine = ScanEngineType;

/**
 * Normalize legacy CLI `origin` values to the canonical four (see types.ts).
 * Re-exported here for callers that already import from the hook.
 */
export { normalizeLaunchOrigin };

/**
 * Report source helper — returns the engine implied by an engine-qualified key
 * (e.g. `cli:123` → 'cli', `api:abc` → 'api'). Used for delete routing.
 */
export function getReportSource(key: string): ScanEngine | null {
  return getReportSourceImpl(key);
}

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
  origin?: string;      // legacy field, kept for backward compat
  launch_origin?: string; // canonical provenance
  engine?: ScanEngine;
  has_report?: boolean;
  openapi_available?: boolean;
  recovery_available?: boolean;
  provider?: string | null;
  findings_count?: number;
  confirmed_count?: number;
  reportable_count?: number;
}

interface ActiveScan {
  // CLI ids are numeric strings; API ids are opaque strings.
  id: string;
  engine: ScanEngine;
  status: string;
  target_url: string;
  elapsed_seconds: number;
  progress?: number;
}

interface UsePastReportsReturn {
  reports: CLIReport[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  activeScans: ActiveScan[];
  deleteTarget: CLIReport | null;
  deleting: boolean;
  stoppingScanId: string | null;
  pausingScanId: string | null;
  resumingScanId: string | null;
  setError: (error: string | null) => void;
  setDeleteTarget: (target: CLIReport | null) => void;
  handleSync: () => Promise<void>;
  handleDelete: (report: CLIReport) => Promise<void>;
  handleStopScan: (scanId: string, engine?: ScanEngine) => Promise<void>;
  handlePauseScan: (scanId: string) => Promise<void>;
  handleResumeScan: (scanId: string) => Promise<void>;
}

export const usePastReports = (): UsePastReportsReturn => {
  const [reports, setReports] = useState<CLIReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeScans, setActiveScans] = useState<ActiveScan[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<CLIReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stoppingScanId, setStoppingScanId] = useState<string | null>(null);
  const [pausingScanId, setPausingScanId] = useState<string | null>(null);
  const [resumingScanId, setResumingScanId] = useState<string | null>(null);
  const prevActiveCountRef = useRef(0);

  const { btaiApiUrl } = useSettings();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both engines independently. One failure never blanks the other.
      const [cliResult, apiResult] = await Promise.allSettled([
        cliApi.listScans({ per_page: 50 }).catch(e => ({ error: e.message }) as const),
        createBtaiApi(btaiApiUrl).listScans(50).catch(e => ({ error: e.message }) as const),
      ]);

      const merged: CLIReport[] = [];
      const active: ActiveScan[] = [];

      if (cliResult.status === 'fulfilled' && !('error' in cliResult.value)) {
        const response = cliResult.value;
        const nonTerminal = ['running', 'pending', 'initializing', 'paused'];
        const running: ActiveScan[] = response.scans
          .filter(s => nonTerminal.includes(s.status.toLowerCase()))
          .map(s => ({
            id: String(s.scan_id),
            engine: 'cli',
            status: s.status.toLowerCase(),
            target_url: s.target,
            elapsed_seconds: 0,
          }));
        active.push(...running);

        const mapped: CLIReport[] = response.scans
          .filter(s => {
            const status = s.status.toLowerCase();
            const terminal = ['completed', 'stopped', 'failed'].includes(status);
            return terminal && (s.has_report !== false || s.recovery_available === true);
          })
          .map(s => ({
            id: String(s.scan_id),
            target_url: s.target,
            scan_date: s.timestamp,
            status: s.status,
            severity_summary: null,
            report_path: '',
            engine: 'cli' as const,
            // Prefer the canonical field; fall back to the legacy field and normalize.
            launch_origin: normalizeLaunchOrigin(s.launch_origin || s.origin),
            origin: s.origin,
            has_report: s.has_report,
            recovery_available: s.recovery_available,
            provider: s.provider || null,
            findings_count: s.detections_count ?? s.findings_count ?? 0,
            confirmed_count: s.confirmed_count ?? 0,
            reportable_count: s.reportable_count ?? 0,
          }));
        merged.push(...mapped);
      } else {
        const msg = cliResult.status === 'rejected'
          ? (cliResult.reason instanceof Error ? cliResult.reason.message : 'CLI list failed')
          : 'CLI list returned an error';
        console.warn('[usePastReports] CLI list failed, continuing with API-only:', msg);
      }

      if (apiResult.status === 'fulfilled' && !('error' in apiResult.value)) {
        const apiBody = apiResult.value as unknown as { scans?: BtaiApiListItem[] };
        // Guard against a malformed/empty response — never crash the reports tab.
        const apiRaw: BtaiApiListItem[] = Array.isArray(apiBody?.scans) ? apiBody.scans : [];
        const nonTerminal = ['running', 'pending', 'initializing', 'paused'];
        active.push(...apiRaw
          .filter(s => nonTerminal.includes(s.status.toLowerCase()))
          .map(s => ({
            id: String(s.scan_id),
            engine: 'api' as const,
            status: s.status.toLowerCase(),
            target_url: s.target,
            elapsed_seconds: 0,
            progress: s.progress,
          })));

        const apiScans: CLIReport[] = apiRaw
          .filter(s => !nonTerminal.includes(s.status.toLowerCase()))
          .map(s => ({
          id: s.scan_id,
          target_url: s.target,
          scan_date: s.started_at || '',
          status: s.status,
          severity_summary: null,
          report_path: '',
          engine: 'api' as const,
          launch_origin: normalizeLaunchOrigin(s.launch_origin),
          has_report: s.results_available === true,
          openapi_available: s.openapi_available,
          recovery_available: false,
          // API reports expose the provider that performed optional AI
          // enrichment; this keeps the shared reports table honest without
          // calling it the legacy/local "Apex" engine.
          provider: s.analysis_provider || null,
          findings_count: s.findings_count ?? 0,
          confirmed_count: 0,
          reportable_count: 0,
        }));
        merged.push(...apiScans);
      } else {
        const msg = apiResult.status === 'rejected'
          ? (apiResult.reason instanceof Error ? apiResult.reason.message : 'API list failed')
          : 'API list returned an error';
        console.warn('[usePastReports] API list failed, continuing with CLI-only:', msg);
      }

      // Merge; sort newest-first by scan_date.
      merged.sort((a, b) => b.scan_date.localeCompare(a.scan_date));
      setActiveScans(active);
      prevActiveCountRef.current = active.length;
      setReports(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [btaiApiUrl]);

  // Lightweight poll both engines so Reports can show and stop API scans while
  // they are running. API status is HTTP-only; there is no WebSocket.
  const pollActiveScans = useCallback(async () => {
    try {
      const nonTerminal = ['running', 'pending', 'initializing', 'paused'];
      const [cliResult, apiResult] = await Promise.allSettled([
        cliApi.listScans({ per_page: 20 }),
        createBtaiApi(btaiApiUrl).listScans(20),
      ]);
      const running: ActiveScan[] = [];
      if (cliResult.status === 'fulfilled') {
        running.push(...cliResult.value.scans
          .filter(s => nonTerminal.includes(s.status.toLowerCase()))
          .map(s => ({ id: String(s.scan_id), engine: 'cli' as const, status: s.status.toLowerCase(), target_url: s.target, elapsed_seconds: 0 })));
      }
      if (apiResult.status === 'fulfilled') {
        running.push(...apiResult.value.scans
          .filter(s => nonTerminal.includes(s.status.toLowerCase()))
          .map(s => ({ id: String(s.scan_id), engine: 'api' as const, status: s.status.toLowerCase(), target_url: s.target, elapsed_seconds: 0, progress: s.progress })));
      }
      setActiveScans(running);
      if (running.length < prevActiveCountRef.current) {
        fetchReports();
      }
      prevActiveCountRef.current = running.length;
    } catch {
      // Backend might not be running.
    }
  }, [btaiApiUrl, fetchReports]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setSyncing(false);
    }
  }, [fetchReports]);

  const handleDelete = useCallback(async (report: CLIReport) => {
    setDeleting(true);
    try {
      if (report.engine === 'api') {
        // API stop is a control action, NOT report purge.
        await createBtaiApi(btaiApiUrl).stopScan(report.id);
        // Refresh reports so the row updates its status, but do NOT remove it.
        await fetchReports();
      } else {
        // CLI delete requires a numeric id.
        const numericId = Number(report.id);
        const result = await cliApi.deleteScan(numericId);
        if (report.origin === 'cli' && !result.files_cleaned) {
          setError('Scan deleted. Report files in the reports/ folder were not found — remove them manually if needed.');
        }
        setReports(prev => prev.filter(r => `${r.engine}:${r.id}` !== `${report.engine}:${report.id}`));
      }
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete report';
      setError(`Delete failed: ${msg}`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [btaiApiUrl, fetchReports]);

  const handleStopScan = useCallback(async (scanId: string, engine: ScanEngine = 'cli') => {
    setStoppingScanId(scanId);
    try {
      if (engine === 'api') {
        await createBtaiApi(btaiApiUrl).stopScan(scanId);
      } else {
        await cliApi.stopScan(Number(scanId));
      }
      setActiveScans(prev => prev.filter(s => !(s.id === scanId && s.engine === engine)));
      setTimeout(() => fetchReports(), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stop scan';
      setError(`Stop failed: ${msg}`);
    } finally {
      setStoppingScanId(null);
    }
  }, [btaiApiUrl, fetchReports]);

  const handlePauseScan = useCallback(async (scanId: string) => {
    setPausingScanId(scanId);
    try {
      await cliApi.pauseScan(Number(scanId));
      setActiveScans(prev => prev.map(s =>
        s.id === scanId ? { ...s, status: 'paused' } : s
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause scan';
      setError(`Pause failed: ${msg}`);
    } finally {
      setPausingScanId(null);
    }
  }, []);

  const handleResumeScan = useCallback(async (scanId: string) => {
    setResumingScanId(scanId);
    try {
      await cliApi.resumeScan(Number(scanId));
      setActiveScans(prev => prev.map(s =>
        s.id === scanId ? { ...s, status: 'running' } : s
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resume scan';
      setError(`Resume failed: ${msg}`);
    } finally {
      setResumingScanId(null);
    }
  }, []);

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
