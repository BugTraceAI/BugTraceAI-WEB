// @author: Albert C | @yz9yt | github.com/yz9yt
// hooks/useKiterunner.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { KrMcpClient } from '../lib/krMcpClient.ts';

export type KrScanStatus = 'idle' | 'connecting' | 'running' | 'completed' | 'failed' | 'stopped';

export interface KrRoute {
  method: string;
  url: string;
  status: number;
  words: number;
  lines: number;
}

interface KrScanStatusResponse {
  status: string;
  progress: number;
  routes_found: number;
  error?: string;
}

interface KrResultsResponse {
  routes: KrRoute[];
  url_list: string[];
}

interface KrScanStartResponse {
  scan_id: number;
  status: string;
  message: string;
  error?: string;
}

export interface UseKiterunnerReturn {
  startScan: (target: string, wordlist?: string) => void;
  stopScan: () => void;
  scanStatus: KrScanStatus;
  progress: number;
  routesFound: number;
  routes: KrRoute[];
  urlList: string[];
  error: string | null;
  isReady: boolean;
}

export function useKiterunner(): UseKiterunnerReturn {
  const [isReady, setIsReady] = useState(false);
  const [scanStatus, setScanStatus] = useState<KrScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [routesFound, setRoutesFound] = useState(0);
  const [routes, setRoutes] = useState<KrRoute[]>([]);
  const [urlList, setUrlList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<KrMcpClient | null>(null);
  const scanIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const client = new KrMcpClient(
      () => setIsReady(true),
      (err) => { setError(err); setScanStatus('failed'); },
    );
    setScanStatus('connecting');
    client.connect();
    clientRef.current = client;

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      client.disconnect();
    };
  }, []);

  // Once ready, flip status back to idle
  useEffect(() => {
    if (isReady) setScanStatus('idle');
  }, [isReady]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchResults = useCallback(async (scanId: number) => {
    if (!clientRef.current) return;
    try {
      const result = await clientRef.current.callTool('get_results', { scan_id: scanId }) as KrResultsResponse;
      setRoutes(result.routes ?? []);
      setUrlList(result.url_list ?? []);
    } catch (e) {
      setError(`Failed to fetch results: ${String(e)}`);
    }
  }, []);

  const startPolling = useCallback((scanId: number) => {
    pollTimerRef.current = setInterval(async () => {
      if (!clientRef.current) return;
      try {
        const s = await clientRef.current.callTool('get_scan_status', { scan_id: scanId }) as KrScanStatusResponse;
        setProgress(s.progress ?? 0);
        setRoutesFound(s.routes_found ?? 0);
        if (s.status === 'completed') {
          stopPolling();
          setScanStatus('completed');
          await fetchResults(scanId);
        } else if (s.status === 'failed') {
          stopPolling();
          setScanStatus('failed');
          setError(s.error ?? 'Scan failed');
        } else if (s.status === 'stopped') {
          stopPolling();
          setScanStatus('stopped');
          await fetchResults(scanId);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 2000);
  }, [stopPolling, fetchResults]);

  const startScan = useCallback(async (target: string, wordlist = 'small') => {
    if (!clientRef.current || !isReady) {
      setError('kiterunner-mcp service not available');
      return;
    }
    setError(null);
    setRoutes([]);
    setUrlList([]);
    setProgress(0);
    setRoutesFound(0);
    setScanStatus('running');
    try {
      const result = await clientRef.current.callTool('kiterunner_scan', {
        target,
        wordlist,
      }) as KrScanStartResponse;
      if (result.error || result.status === 'error') {
        setScanStatus('failed');
        setError(result.error ?? result.message);
        return;
      }
      scanIdRef.current = result.scan_id;
      startPolling(result.scan_id);
    } catch (e) {
      setScanStatus('failed');
      setError(`Scan error: ${String(e)}`);
    }
  }, [isReady, startPolling]);

  const stopScan = useCallback(async () => {
    if (!clientRef.current || scanIdRef.current === null) return;
    try {
      await clientRef.current.callTool('stop_scan', { scan_id: scanIdRef.current });
      stopPolling();
      setScanStatus('stopped');
      await fetchResults(scanIdRef.current);
    } catch (e) {
      setError(`Stop failed: ${String(e)}`);
    }
  }, [stopPolling, fetchResults]);

  return { startScan, stopScan, scanStatus, progress, routesFound, routes, urlList, error, isReady };
}
