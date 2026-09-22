import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BtaiApiClient,
  BtaiApiScanRequest,
  BtaiApiScanResults,
  BtaiApiScanStatus,
  createBtaiApi,
} from '../lib/btaiApi.ts';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 24 * 60 * 60 * 1000;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'stopped', 'cancelled']);
const ACTIVE_STATUSES = new Set(['pending', 'running', 'initializing', 'queued']);

export interface UseBtaiApiScanResult {
  scan: BtaiApiScanStatus | null;
  results: BtaiApiScanResults | null;
  isStarting: boolean;
  isPolling: boolean;
  error: string | null;
  start: (request: BtaiApiScanRequest) => Promise<BtaiApiScanStatus | null>;
  stop: () => Promise<void>;
  clear: () => void;
}

/**
 * Execute and monitor a BugTraceAI-API scan.
 *
 * The API product intentionally has no WebSocket. This hook owns the HTTP
 * polling lifecycle so the scan launcher never accidentally routes an API id
 * through the CLI WebSocket or coerces the opaque id to a number.
 */
export function useBtaiApiScan(baseUrl: string): UseBtaiApiScanResult {
  const [scan, setScan] = useState<BtaiApiScanStatus | null>(null);
  const [results, setResults] = useState<BtaiApiScanResults | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<BtaiApiClient>(createBtaiApi(baseUrl));
  const abortRef = useRef<AbortController | null>(null);
  const scanIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    clientRef.current = createBtaiApi(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const stopPolling = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (mountedRef.current) setIsPolling(false);
  }, []);

  const poll = useCallback(async (scanId: string, controller: AbortController) => {
    const startedAt = Date.now();
    if (mountedRef.current) setIsPolling(true);

    try {
      while (!controller.signal.aborted && Date.now() - startedAt < MAX_POLL_TIME_MS) {
        const status = await clientRef.current.getScanStatus(scanId, controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        setScan(status);

        if (TERMINAL_STATUSES.has(String(status.status).toLowerCase())) {
          try {
            const finalResults = await clientRef.current.getScanResults(scanId, controller.signal);
            if (mountedRef.current && !controller.signal.aborted) setResults(finalResults);
          } catch {
            // A terminal status is still useful when the results artifact is
            // unavailable (for example, a failed scan with no findings).
          }
          return;
        }

        await new Promise<void>(resolve => {
          const timeout = window.setTimeout(resolve, POLL_INTERVAL_MS);
          controller.signal.addEventListener('abort', () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      }

      if (!controller.signal.aborted && mountedRef.current) {
        setError('BugTraceAI-API scan polling timed out. Check the Reports tab for its final status.');
      }
    } catch (scanError: unknown) {
      if (!controller.signal.aborted && mountedRef.current) {
        setError(scanError instanceof Error ? scanError.message : 'Could not read BugTraceAI-API scan status.');
      }
    } finally {
      if (mountedRef.current) setIsPolling(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  // Switching away from Scan API unmounts the launcher, but the server-side
  // scan continues. Rehydrate the latest active scan when the launcher mounts
  // again. If no scan is active, keep the newest terminal scan visible too so
  // its findings/downloads do not mysteriously disappear when the user changes
  // the engine selector and comes back.
  useEffect(() => {
    let cancelled = false;

    const restoreActiveScan = async () => {
      if (!baseUrl) return;
      try {
        const listing = await clientRef.current.listScans(50);
        if (cancelled || !mountedRef.current || scanIdRef.current || abortRef.current) return;
        const activeItem = listing.scans
          .filter(item => ACTIVE_STATUSES.has(String(item.status || '').toLowerCase()))
          .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0];
        const latestTerminalItem = listing.scans
          .filter(item => TERMINAL_STATUSES.has(String(item.status || '').toLowerCase()))
          .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')))[0];
        const restoreItem = activeItem || latestTerminalItem;
        if (!restoreItem) return;

        const controller = new AbortController();
        abortRef.current = controller;
        scanIdRef.current = restoreItem.scan_id;
        setError(null);
        setResults(null);
        setScan({
          scan_id: restoreItem.scan_id,
          target: restoreItem.target,
          status: restoreItem.status,
          current_phase: restoreItem.current_phase,
          progress: restoreItem.progress ?? 0,
          started_at: restoreItem.started_at,
          finished_at: restoreItem.finished_at,
          findings_count: restoreItem.findings_count,
          analysis_provider: restoreItem.analysis_provider,
          analysis_model: restoreItem.analysis_model,
          engine: 'api',
          launch_origin: restoreItem.launch_origin || 'web-api',
        });
        if (activeItem) {
          void poll(activeItem.scan_id, controller);
        } else {
          // Terminal scans do not need a polling loop, but their durable result
          // payload is needed for the inline summary and artifact buttons.
          try {
            const finalResults = await clientRef.current.getScanResults(restoreItem.scan_id, controller.signal);
            if (mountedRef.current && !controller.signal.aborted) setResults(finalResults);
          } catch {
            // The report remains available from Reports even if a failed scan
            // has no structured result payload.
          } finally {
            if (mountedRef.current) setIsPolling(false);
            if (abortRef.current === controller) abortRef.current = null;
          }
        }
      } catch {
        // Connection health owns the visible offline state. A failed restore
        // must not replace it with a second, noisy error in the scan form.
      }
    };

    void restoreActiveScan();
    return () => { cancelled = true; };
  }, [baseUrl, poll]);

  const start = useCallback(async (request: BtaiApiScanRequest) => {
    stopPolling();
    // Reserve the lifecycle before the POST resolves so the mount-time
    // rehydration effect cannot race and replace a user-initiated start.
    scanIdRef.current = '__starting__';
    setError(null);
    setResults(null);
    setScan(null);
    setIsStarting(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const created = await clientRef.current.startScan(request, controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return null;
      scanIdRef.current = created.scan_id;
      const initial: BtaiApiScanStatus = {
        scan_id: created.scan_id,
        target: request.target,
        status: created.status || 'pending',
        progress: 0,
        engine: 'api',
        launch_origin: created.launch_origin || request.launch_origin || 'web-api',
      };
      setScan(initial);
      setIsStarting(false);
      void poll(created.scan_id, controller);
      return initial;
    } catch (startError: unknown) {
      scanIdRef.current = null;
      if (!controller.signal.aborted && mountedRef.current) {
        setError(startError instanceof Error ? startError.message : 'Could not start BugTraceAI-API scan.');
        setIsStarting(false);
      }
      return null;
    }
  }, [poll, stopPolling]);

  const stop = useCallback(async () => {
    const scanId = scanIdRef.current;
    if (!scanId) return;
    setError(null);
    try {
      const stopped = await clientRef.current.stopScan(scanId);
      if (mountedRef.current) {
        setScan(previous => previous ? { ...previous, status: stopped.status || 'stopped', progress: previous.progress ?? 0 } : previous);
      }
    } catch (stopError: unknown) {
      if (mountedRef.current) setError(stopError instanceof Error ? stopError.message : 'Could not stop BugTraceAI-API scan.');
    } finally {
      stopPolling();
    }
  }, [stopPolling]);

  const clear = useCallback(() => {
    stopPolling();
    scanIdRef.current = null;
    if (mountedRef.current) {
      setScan(null);
      setResults(null);
      setError(null);
      setIsStarting(false);
    }
  }, [stopPolling]);

  return {
    scan,
    results,
    isStarting,
    isPolling,
    error,
    start,
    stop,
    clear,
  };
}
