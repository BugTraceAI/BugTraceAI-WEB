import { useState, useEffect, useCallback } from 'react';
import { healthCheck } from '../lib/cliApi';

/**
 * CLI engine health status — returned by useCliHealth().
 *
 * Three levels:
 *   healthy       → green dot, all systems operational
 *   degraded      → yellow dot, engine online but some tools missing (Docker)
 *   misconfigured → red dot, provider preset or API key missing — scans WILL FAIL
 *   offline       → red dot, engine unreachable
 */
export interface CliHealthStatus {
  /** Overall status: healthy | degraded | misconfigured | offline */
  status: 'healthy' | 'degraded' | 'misconfigured' | 'offline';
  /** CLI engine version (e.g. "2.3.3"), null if offline */
  version: string | null;
  /** Active LLM provider name (e.g. "OpenRouter") */
  provider: string | null;
  /** Whether the provider preset file was found */
  providerReady: boolean;
  /** Whether the API key env var is set for the active provider */
  apiKeyConfigured: boolean;
  /** Human-readable warnings — empty means everything is fine */
  warnings: string[];
}

const INITIAL_STATE: CliHealthStatus = {
  status: 'offline',
  version: null,
  provider: null,
  providerReady: false,
  apiKeyConfigured: false,
  warnings: [],
};

/**
 * Hook to monitor CLI engine health.
 * Polls /health every 30s and exposes structured status for the UI.
 *
 * Replaces the old useCliVersion() hook with richer diagnostics.
 */
export function useCliHealth(): CliHealthStatus {
  const [health, setHealth] = useState<CliHealthStatus>(INITIAL_STATE);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await healthCheck();
      setHealth({
        status: (data.status as CliHealthStatus['status']) || 'healthy',
        version: data.version || null,
        provider: data.provider || null,
        providerReady: data.provider_ready ?? true,
        apiKeyConfigured: data.api_key_configured ?? true,
        warnings: data.warnings || [],
      });
    } catch {
      setHealth({
        ...INITIAL_STATE,
        status: 'offline',
        warnings: ['CLI engine unreachable. Check that the BugTraceAI-CLI container is running.'],
      });
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return health;
}
