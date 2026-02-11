// hooks/useCliConnection.ts
// Custom hook for managing CLI connection with periodic health checks

import { useCallback, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsProvider.tsx';
import { testCliConnection } from '../services/cliConnector.ts';

interface UseCliConnectionOptions {
  /** Interval between health checks in ms (default: 30000 = 30s) */
  pollInterval?: number;
  /** Whether to automatically start polling (default: true if URL is set) */
  autoConnect?: boolean;
}

export function useCliConnection(options: UseCliConnectionOptions = {}) {
  const { pollInterval = 30000, autoConnect = true } = options;

  const {
    cliUrl,
    cliConnected,
    cliStatus,
    setCli,
    cliVersion,
    cliDockerAvailable,
  } = useSettings();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const checkConnection = useCallback(async () => {
    if (!cliUrl) {
      setCli({ connected: false, status: null, version: undefined, dockerAvailable: undefined });
      return;
    }

    try {
      const result = await testCliConnection(cliUrl);
      if (isMountedRef.current) {
        setCli({
          connected: result.connected,
          status: result.status,
          version: result.version,
          dockerAvailable: result.dockerAvailable,
        });
      }
    } catch {
      if (isMountedRef.current) {
        setCli({ connected: false, status: 'unreachable', version: undefined, dockerAvailable: undefined });
      }
    }
  }, [cliUrl, setCli]);

  // Initial connection check
  useEffect(() => {
    isMountedRef.current = true;

    if (autoConnect && cliUrl) {
      checkConnection();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoConnect, cliUrl, checkConnection]);

  // Periodic health check
  useEffect(() => {
    if (!cliConnected || !cliUrl) {
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
  }, [cliConnected, cliUrl, pollInterval, checkConnection]);

  const connect = useCallback(async () => {
    await checkConnection();
  }, [checkConnection]);

  const disconnect = useCallback(() => {
    setCli({ connected: false, status: null, version: undefined, dockerAvailable: undefined });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [setCli]);

  return {
    isConnected: cliConnected,
    status: cliStatus,
    version: cliVersion,
    dockerAvailable: cliDockerAvailable,
    url: cliUrl,
    connect,
    disconnect,
    refresh: checkConnection,
  };
}
