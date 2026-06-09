// @author: Albert C | @yz9yt | github.com/yz9yt
// hooks/useKiterunner.ts
// Uses the FastAPI REST API (port 8004, proxied through nginx at /kr-api/)
// instead of MCP-over-SSE — simpler, no protocol framing, no 502s.

import { useState, useEffect, useRef, useCallback } from 'react';

export type KrScanStatus = 'idle' | 'connecting' | 'running' | 'completed' | 'failed' | 'stopped';
type KrSavedScanStatus = Extract<KrScanStatus, 'completed' | 'failed' | 'stopped'>;

export interface KrRoute {
  method: string;
  url: string;
  status: number;
  words: number;
  lines: number;
  chars?: number;
}

export interface KrSavedScan {
  id: string;
  scanId: number;
  target: string;
  wordlist: string;
  status: KrSavedScanStatus;
  startedAt: string | null;
  finishedAt: string | null;
  routesFound: number;
  routes: KrRoute[];
  urlList: string[];
  warning: string | null;
  warningDetail: string | null;
  error: string | null;
}

export interface UseKiterunnerReturn {
  startScan: (target: string, wordlist?: string, speed?: string, workers?: number, maxConnections?: number) => void;
  stopScan: () => void;
  scanStatus: KrScanStatus;
  progress: number;
  routesFound: number;
  routes: KrRoute[];
  urlList: string[];
  warning: string | null;
  warningDetail: string | null;
  error: string | null;
  isReady: boolean;
  activeScanId: number | null;
  activeStartedAt: string | null;
  activeTarget: string | null;
  activeWordlist: string | null;
  scanHistory: KrSavedScan[];
  removeSavedScan: (scanId: string) => void;
  clearSavedScans: () => void;
  showSavedScan: (scan: KrSavedScan) => void;
}

interface KrActiveScanResponse {
  scan_id: number;
  target: string;
  wordlist: string;
  status: string;
  routes_found: number;
  started_at?: string | null;
  finished_at?: string | null;
}

interface KrScanStatusResponse extends KrActiveScanResponse {
  progress: number;
  error?: string | null;
  warning?: string | null;
  warning_detail?: string | null;
}

interface KrScanResultsResponse {
  routes: KrRoute[];
  url_list: string[];
}

interface PersistedCurrentScan {
  scanId: number;
  target: string;
  wordlist: string;
  startedAt: string | null;
}

const KR_API_BASE = (import.meta.env.VITE_KR_API_URL as string | undefined) ?? '/kr-api';
const BACKEND_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
const SAVED_SCANS_KEY = 'bugtraceai.api-discovery.saved-scans.v1';
const CURRENT_SCAN_KEY = 'bugtraceai.api-discovery.current-scan.v1';
const MAX_SAVED_SCANS = 50;  // increased from 25 — backend has no hard limit

function hasBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSavedScans(): KrSavedScan[] {
  if (!hasBrowserStorage()) return [];
  try {
    const raw = window.localStorage.getItem(SAVED_SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as KrSavedScan[] : [];
  } catch {
    return [];
  }
}

function writeSavedScans(scans: KrSavedScan[]) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(SAVED_SCANS_KEY, JSON.stringify(scans));
}

function readPersistedCurrentScan(): PersistedCurrentScan | null {
  if (!hasBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_SCAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCurrentScan;
    if (!parsed?.scanId || !parsed.target || !parsed.wordlist) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedCurrentScan(scan: PersistedCurrentScan) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(CURRENT_SCAN_KEY, JSON.stringify(scan));
}

function clearPersistedCurrentScan() {
  if (!hasBrowserStorage()) return;
  window.localStorage.removeItem(CURRENT_SCAN_KEY);
}

function buildSavedScanId(scanId: number, target: string, wordlist: string, startedAt: string | null) {
  return `${startedAt ?? 'unknown'}::${scanId}::${target}::${wordlist}`;
}

function toSavedScanStatus(status: string): KrSavedScanStatus {
  if (status === 'failed') return 'failed';
  if (status === 'stopped') return 'stopped';
  return 'completed';
}

// ── Backend persistence helpers (with localStorage fallback) ─────────────────

async function backendSaveScan(scan: KrSavedScan): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}/api-discovery/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scan_id:       scan.scanId,
        target:        scan.target,
        wordlist:      scan.wordlist,
        status:        scan.status,
        routes_found:  scan.routesFound,
        routes:        scan.routes,
        url_list:      scan.urlList,
        started_at:    scan.startedAt,
        finished_at:   scan.finishedAt,
        warning:       scan.warning,
        warning_detail: scan.warningDetail,
        error:         scan.error,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function backendToKrSavedScan(d: Record<string, unknown>): KrSavedScan {
  return {
    id:            d.id as string,
    scanId:        d.scanId as number,
    target:        d.target as string,
    wordlist:      d.wordlist as string,
    status:        d.status as KrSavedScanStatus,
    startedAt:     (d.startedAt as string | null) ?? null,
    finishedAt:    (d.finishedAt as string | null) ?? null,
    routesFound:   d.routesFound as number,
    routes:        (d.routes as KrRoute[]) ?? [],
    urlList:       (d.urlList as string[]) ?? [],
    warning:       (d.warning as string | null) ?? null,
    warningDetail: (d.warningDetail as string | null) ?? null,
    error:         (d.error as string | null) ?? null,
  };
}

async function backendLoadScans(): Promise<KrSavedScan[] | null> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}/api-discovery/scans?limit=50`);
    if (!res.ok) return null;
    const data = await res.json() as { items: Record<string, unknown>[] };
    return (data.items ?? []).map(backendToKrSavedScan);
  } catch {
    return null;
  }
}

async function backendDeleteScan(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}/api-discovery/scans/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

async function backendClearScans(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_API_BASE}/api-discovery/scans`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export function useKiterunner(): UseKiterunnerReturn {
  const [isReady, setIsReady] = useState(false);
  const [scanStatus, setScanStatus] = useState<KrScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [routesFound, setRoutesFound] = useState(0);
  const [routes, setRoutes] = useState<KrRoute[]>([]);
  const [urlList, setUrlList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [warningDetail, setWarningDetail] = useState<string | null>(null);
  const [activeScanId, setActiveScanId] = useState<number | null>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [activeWordlist, setActiveWordlist] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<KrSavedScan[]>(() => readSavedScans());

  const scanIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routesCountRef = useRef(0);
  const scanHistoryRef = useRef(scanHistory);
  // Refs that mirror state — used in callbacks to avoid dep-chain instability
  const activeStartedAtRef = useRef<string | null>(null);
  const activeTargetRef = useRef<string | null>(null);
  const activeWordlistRef = useRef<string | null>(null);

  useEffect(() => {
    routesCountRef.current = routes.length;
  }, [routes.length]);

  useEffect(() => {
    scanHistoryRef.current = scanHistory;
  }, [scanHistory]);

  useEffect(() => { activeStartedAtRef.current = activeStartedAt; }, [activeStartedAt]);
  useEffect(() => { activeTargetRef.current = activeTarget; }, [activeTarget]);
  useEffect(() => { activeWordlistRef.current = activeWordlist; }, [activeWordlist]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearActiveTracking = useCallback(() => {
    scanIdRef.current = null;
    setActiveScanId(null);
    setActiveStartedAt(null);
    clearPersistedCurrentScan();
  }, []);

  const applySavedSnapshot = useCallback((scan: KrSavedScan) => {
    stopPolling();
    clearActiveTracking();
    setActiveTarget(scan.target);
    setActiveWordlist(scan.wordlist);
    setScanStatus(scan.status);
    setProgress(scan.status === 'completed' || scan.status === 'stopped' ? 100 : 0);
    setRoutesFound(scan.routesFound);
    setRoutes(scan.routes);
    setUrlList(scan.urlList);
    setWarning(scan.warning);
    setWarningDetail(scan.warningDetail);
    setError(scan.error);
  }, [clearActiveTracking, stopPolling]);

  const saveScanHistory = useCallback((scan: KrSavedScan) => {
    // Write to backend (fire and forget) + localStorage fallback
    backendSaveScan(scan);
    setScanHistory(prev => {
      const next = [scan, ...prev.filter(item => item.id !== scan.id)].slice(0, MAX_SAVED_SCANS);
      writeSavedScans(next);
      return next;
    });
  }, []);

  const removeSavedScan = useCallback((scanId: string) => {
    backendDeleteScan(scanId);
    setScanHistory(prev => {
      const next = prev.filter(scan => scan.id !== scanId);
      writeSavedScans(next);
      return next;
    });
  }, []);

  const clearSavedScans = useCallback(() => {
    backendClearScans();
    setScanHistory([]);
    writeSavedScans([]);
  }, []);

  const fetchResults = useCallback(async (scanId: number, hydrateState = true): Promise<KrScanResultsResponse> => {
    const response = await fetch(`${KR_API_BASE}/api/scan/${scanId}/results`);
    if (!response.ok) throw new Error(`Results request failed (${response.status})`);
    const data = await response.json() as KrScanResultsResponse;
    const nextRoutes = data.routes ?? [];
    const nextUrlList = data.url_list ?? [];
    if (hydrateState) {
      setRoutes(nextRoutes);
      setUrlList(nextUrlList);
    }
    return { routes: nextRoutes, url_list: nextUrlList };
  }, []);

  const saveTerminalScan = useCallback((scan: KrScanStatusResponse, resultsData: KrScanResultsResponse) => {
    const startedAt = scan.started_at ?? activeStartedAtRef.current;
    const target = scan.target ?? activeTargetRef.current ?? '';
    const wordlist = scan.wordlist ?? activeWordlistRef.current ?? 'api';

    saveScanHistory({
      id: buildSavedScanId(scan.scan_id, target, wordlist, startedAt),
      scanId: scan.scan_id,
      target,
      wordlist,
      status: toSavedScanStatus(scan.status),
      startedAt,
      finishedAt: scan.finished_at ?? new Date().toISOString(),
      routesFound: scan.routes_found ?? resultsData.routes.length,
      routes: resultsData.routes,
      urlList: resultsData.url_list,
      warning: scan.warning ?? null,
      warningDetail: scan.warning_detail ?? null,
      error: scan.error ?? null,
    });
  }, [saveScanHistory]);

  const hydrateActiveScan = useCallback((scan: KrActiveScanResponse | PersistedCurrentScan) => {
    const scanId = 'scan_id' in scan ? scan.scan_id : scan.scanId;
    const startedAt = 'started_at' in scan ? (scan.started_at ?? null) : (scan as PersistedCurrentScan).startedAt;

    scanIdRef.current = scanId;
    setActiveScanId(scanId);
    setActiveStartedAt(startedAt);
    setActiveTarget(scan.target);
    setActiveWordlist(scan.wordlist);
    writePersistedCurrentScan({
      scanId,
      target: scan.target,
      wordlist: scan.wordlist,
      startedAt,
    });
  }, []);

  const resetStaleScan = useCallback((message?: string) => {
    stopPolling();
    clearActiveTracking();
    setScanStatus('idle');
    setProgress(0);
    setRoutesFound(0);
    setRoutes([]);
    setUrlList([]);
    setWarning(null);
    setWarningDetail(null);
    if (message) setError(message);
  }, [clearActiveTracking, stopPolling]);

  const finalizeScan = useCallback(async (scan: KrScanStatusResponse) => {
    stopPolling();
    clearActiveTracking();
    setProgress(scan.progress ?? 100);
    setRoutesFound(scan.routes_found ?? 0);
    setWarning(scan.warning ?? null);
    setWarningDetail(scan.warning_detail ?? null);
    setError(scan.error ?? null);
    setScanStatus(toSavedScanStatus(scan.status));

    try {
      const resultsData = await fetchResults(scan.scan_id, true);
      saveTerminalScan(scan, resultsData);
    } catch (fetchError) {
      setError(`Failed to fetch results: ${String(fetchError)}`);
      saveTerminalScan(scan, { routes: [], url_list: [] });
    }
  }, [clearActiveTracking, fetchResults, saveTerminalScan, stopPolling]);

  const startPolling = useCallback((scanId: number) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${KR_API_BASE}/api/scan/${scanId}/status`);
        if (!response.ok) {
          if (response.status === 404) {
            resetStaleScan('The previous API discovery scan expired. Start a new scan.');
            return;
          }
          throw new Error(`Status request failed (${response.status})`);
        }

        const scan = await response.json() as KrScanStatusResponse;
        hydrateActiveScan(scan);
        setProgress(scan.progress ?? 0);
        setRoutesFound(scan.routes_found ?? 0);
        setWarning(scan.warning ?? null);
        setWarningDetail(scan.warning_detail ?? null);

        if (scan.routes_found > routesCountRef.current) {
          await fetchResults(scanId, true);
        }

        if (scan.status === 'completed' || scan.status === 'failed' || scan.status === 'stopped') {
          await finalizeScan(scan);
        }
      } catch {
        // Ignore transient network failures while polling.
      }
    }, 2000);
  }, [fetchResults, finalizeScan, hydrateActiveScan, resetStaleScan]);

  const recoverPreviousScan = useCallback(async () => {
    const persisted = readPersistedCurrentScan();
    if (!persisted) return false;

    try {
      const response = await fetch(`${KR_API_BASE}/api/scan/${persisted.scanId}/status`);
      if (!response.ok) {
        if (response.status === 404) {
          clearPersistedCurrentScan();
          return false;
        }
        throw new Error(`Status request failed (${response.status})`);
      }

      const scan = await response.json() as KrScanStatusResponse;
      const recoveredScan: KrScanStatusResponse = {
        ...scan,
        scan_id: scan.scan_id ?? persisted.scanId,
        target: scan.target ?? persisted.target,
        wordlist: scan.wordlist ?? persisted.wordlist,
        started_at: scan.started_at ?? persisted.startedAt,
      };

      setError(null);
      setWarning(recoveredScan.warning ?? null);
      setWarningDetail(recoveredScan.warning_detail ?? null);
      setProgress(recoveredScan.progress ?? 0);
      setRoutesFound(recoveredScan.routes_found ?? 0);

      if (recoveredScan.status === 'running') {
        hydrateActiveScan(recoveredScan);
        setScanStatus('running');
        if (recoveredScan.routes_found > 0) {
          await fetchResults(recoveredScan.scan_id, true);
        }
        startPolling(recoveredScan.scan_id);
        return true;
      }

      await finalizeScan(recoveredScan);
      return true;
    } catch {
      return false;
    }
  }, [fetchResults, finalizeScan, hydrateActiveScan, startPolling]);

  useEffect(() => {
    let mounted = true;
    setScanStatus('connecting');

    async function init() {
      try {
        const healthResponse = await fetch(`${KR_API_BASE}/health`);
        if (!healthResponse.ok) throw new Error('Health check failed');

        if (mounted) setIsReady(true);

        const activeResponse = await fetch(`${KR_API_BASE}/api/scans/active`);
        if (activeResponse.ok) {
          const active = await activeResponse.json() as KrActiveScanResponse | null;
          if (active?.scan_id && mounted) {
            hydrateActiveScan(active);
            setError(null);
            setScanStatus('running');
            setProgress(0);
            setRoutesFound(active.routes_found ?? 0);
            if ((active.routes_found ?? 0) > 0) {
              await fetchResults(active.scan_id, true);
            }
            startPolling(active.scan_id);
            return;
          }
        }

        const recovered = await recoverPreviousScan();
        if (recovered && mounted) return;

        // Load history from backend (replaces localStorage on first load)
        const backendScans = await backendLoadScans();
        if (backendScans && backendScans.length > 0 && mounted) {
          setScanHistory(backendScans);
          writeSavedScans(backendScans); // sync to localStorage as offline cache
          applySavedSnapshot(backendScans[0]);
          return;
        }

        if (mounted) {
          if (scanHistoryRef.current.length > 0) {
            applySavedSnapshot(scanHistoryRef.current[0]);
          } else {
            setScanStatus('idle');
          }
        }
      } catch {
        if (mounted) {
          setError('Cannot connect to api-routes service');
          setScanStatus('failed');
        }
      }
    }

    init();
    return () => { mounted = false; };
  }, [applySavedSnapshot, fetchResults, hydrateActiveScan, recoverPreviousScan, startPolling]);

  const startScan = useCallback(async (target: string, wordlist = 'api', speed = 'medium', workers = 20, maxConnections = 3) => {
    if (!isReady) {
      setError('api-routes service not available');
      return;
    }

    // Block if a scan is already running
    try {
      if (scanIdRef.current) {
        setError('A scan is already running. Please stop it before starting a new one.');
        return;
      } else {
        const activeRes = await fetch(`${KR_API_BASE}/api/scans/active`);
        if (activeRes.ok) {
          const activeScan = await activeRes.json();
          if (activeScan && activeScan.scan_id) {
            setError('Another scan is currently running on the server. Please stop it before starting a new one.');
            return;
          }
        }
      }
    } catch {
      // Ignore network errors here and attempt to proceed
    }

    stopPolling();
    clearActiveTracking();

    const startedAt = new Date().toISOString();
    setError(null);
    setWarning(null);
    setWarningDetail(null);
    setRoutes([]);
    setUrlList([]);
    setProgress(0);
    setRoutesFound(0);
    setActiveTarget(target);
    setActiveWordlist(wordlist);
    setScanStatus('running');

    try {
      const response = await fetch(`${KR_API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, wordlist, speed, workers, maxConnections }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { detail?: string | { error?: string } };
        setScanStatus('failed');
        if (typeof err.detail === 'string') {
          setError(err.detail);
        } else {
          setError(err.detail?.error ?? JSON.stringify(err.detail ?? 'Scan failed to start'));
        }
        return;
      }

      const data = await response.json() as { scan_id: number };
      hydrateActiveScan({
        scanId: data.scan_id,
        target,
        wordlist,
        startedAt,
      });
      startPolling(data.scan_id);
    } catch (scanError) {
      setScanStatus('failed');
      setError(`Scan error: ${String(scanError)}`);
    }
  }, [hydrateActiveScan, isReady, startPolling]);

  const stopScan = useCallback(async () => {
    if (scanIdRef.current === null) return;

    const scanId = scanIdRef.current;
    stopPolling();

    try {
      await fetch(`${KR_API_BASE}/api/scan/${scanId}`, { method: 'DELETE' });
      const resultsData = await fetchResults(scanId, true);
      clearActiveTracking();
      setScanStatus('stopped');
      setProgress(100);
      saveScanHistory({
        id: buildSavedScanId(scanId, activeTargetRef.current ?? '', activeWordlistRef.current ?? 'api', activeStartedAtRef.current),
        scanId,
        target: activeTargetRef.current ?? '',
        wordlist: activeWordlistRef.current ?? 'api',
        status: 'stopped',
        startedAt: activeStartedAtRef.current,
        finishedAt: new Date().toISOString(),
        routesFound: resultsData.routes.length,
        routes: resultsData.routes,
        urlList: resultsData.url_list,
        warning: null,
        warningDetail: null,
        error: null,
      });
    } catch (stopError) {
      setError(`Stop failed: ${String(stopError)}`);
    }
  }, [clearActiveTracking, fetchResults, saveScanHistory, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    startScan,
    stopScan,
    scanStatus,
    progress,
    routesFound,
    routes,
    urlList,
    warning,
    warningDetail,
    error,
    isReady,
    activeScanId,
    activeStartedAt,
    activeTarget,
    activeWordlist,
    scanHistory,
    removeSavedScan,
    clearSavedScans,
    showSavedScan: applySavedSnapshot,
  };
}

