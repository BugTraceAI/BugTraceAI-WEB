// services/btaiApiConnector.ts
// BugTraceAI-API connection health check and management
// BugTraceAI-API is a standalone product (separate Docker/process)
// WELLKI talks to it over HTTP the same way it talks to the CLI

// ============================================================
// Types
// ============================================================

export interface BtaiApiConnectionResult {
  connected: boolean;
  status: 'healthy' | 'degraded' | 'unreachable';
  version?: string;
  /** Whether the active API-side AI provider has credentials available. */
  providerConfigured?: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Test connection to BugTraceAI-API
 * @param url Base URL of BugTraceAI-API (e.g., http://localhost:8005 or /btai-api)
 * @returns Connection result with health details
 */
export async function testBtaiApiConnection(url: string): Promise<BtaiApiConnectionResult> {
  const startTime = performance.now();

  // Normalize URL (remove trailing slash)
  const baseUrl = url.replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        connected: false,
        status: 'unreachable',
        error: `HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    }

    const data: { status: string; service: string; version?: string; api_key_configured?: boolean } = await response.json();

    // Map the API's health status ("ok") to our internal status enum
    return {
      connected: true,
      status: (data.status === 'ok' ? 'healthy' : 'degraded') as 'healthy' | 'degraded',
      version: data.version,
      // Older API builds did not expose this field. Treat an absent field as
      // configured so a health-compatible server remains usable in scan-only
      // mode rather than being blocked by a UI assumption.
      providerConfigured: data.api_key_configured !== false,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          connected: false,
          status: 'unreachable',
          error: 'Connection timed out (5s)',
          latencyMs,
        };
      }

      // Network errors (CORS, connection refused, etc.)
      return {
        connected: false,
        status: 'unreachable',
        error: error.message || 'Network error',
        latencyMs,
      };
    }

    return {
      connected: false,
      status: 'unreachable',
      error: 'Unknown error',
      latencyMs,
    };
  }
}

// ============================================================
// System Status
// ============================================================

export interface BtaiApiSystemStatus {
  api: BtaiApiConnectionResult;
  timestamp: Date;
}

/**
 * Get full system status
 */
export async function getBtaiApiSystemStatus(url: string): Promise<BtaiApiSystemStatus> {
  const api = await testBtaiApiConnection(url);
  return {
    api,
    timestamp: new Date(),
  };
}
