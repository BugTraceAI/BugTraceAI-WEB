// hooks/useBtaiApiConnection.ts
// Custom hook for managing BugTraceAI-API connection with periodic health checks

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../contexts/SettingsProvider.tsx';
import { testBtaiApiConnection } from '../services/btaiApiConnector.ts';

interface UseBtaiApiConnectionOptions {
  /** Interval between health checks in ms (default: 30000 = 30s) */
  pollInterval?: number;
  /** Whether to automatically start polling (default: true if URL is set) */
  autoConnect?: boolean;
}

export function useBtaiApiConnection(options: UseBtaiApiConnectionOptions = {}) {
  const { pollInterval = 30000, autoConnect = true } = options;

  const {
    btaiApiUrl,
    setBtaiApiUrl,
    btaiApiConnected,
    btaiApiStatus,
    btaiApiVersion,
    setBtaiApi,
  } = useSettings();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const [providerConfigured, setProviderConfigured] = useState<boolean | undefined>(undefined);

  const checkConnection = useCallback(async () => {
    if (!btaiApiUrl) {
      setBtaiApi({ connected: false, status: null, version: undefined });
      setProviderConfigured(undefined);
      return;
    }

    try {
      const result = await testBtaiApiConnection(btaiApiUrl);
      if (isMountedRef.current) {
        setBtaiApi({
          connected: result.connected,
          status: result.status,
          version: result.version,
        });
        setProviderConfigured(result.providerConfigured);
      }
    } catch {
      if (isMountedRef.current) {
        setBtaiApi({ connected: false, status: 'unreachable', version: undefined });
        setProviderConfigured(undefined);
      }
    }
  }, [btaiApiUrl, setBtaiApi]);

  // Initial connection check
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect && btaiApiUrl) {
      checkConnection();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoConnect, btaiApiUrl, checkConnection]);

  // Periodic health check — polls whenever URL is configured (not just when connected)
  useEffect(() => {
    if (!btaiApiUrl) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(checkConnection, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [btaiApiUrl, pollInterval, checkConnection]);

  const connect = useCallback(async () => {
    await checkConnection();
  }, [checkConnection]);

  const disconnect = useCallback(() => {
    setBtaiApi({ connected: false, status: null, version: undefined });
    setProviderConfigured(undefined);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [setBtaiApi]);

  return {
    isConnected: btaiApiConnected,
    status: btaiApiStatus,
    version: btaiApiVersion,
    providerConfigured,
    url: btaiApiUrl,
    connect,
    disconnect,
    refresh: checkConnection,
  };
}
