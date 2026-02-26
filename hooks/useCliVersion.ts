import { useState, useEffect } from 'react';
import { healthCheck } from '../lib/cliApi';

/**
 * Hook to fetch the connected CLI version via the health endpoint.
 * Returns the version string if CLI is reachable, null otherwise.
 * Refreshes every 60s to stay current after updates.
 */
export function useCliVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchVersion = async () => {
      try {
        const health = await healthCheck();
        if (!cancelled && health?.version) {
          setVersion(health.version);
        }
      } catch {
        if (!cancelled) setVersion(null);
      }
    };

    fetchVersion();
    const interval = setInterval(fetchVersion, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return version;
}
