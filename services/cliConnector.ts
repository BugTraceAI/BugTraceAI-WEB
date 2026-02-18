// services/cliConnector.ts
// CLI and Backend connection health check and management

// ============================================================
// Types
// ============================================================

export interface CliConnectionResult {
  connected: boolean;
  status: 'healthy' | 'degraded' | 'unreachable';
  version?: string;
  dockerAvailable?: boolean;
  activeScans?: number;
  error?: string;
  latencyMs?: number;
}

export interface CliHealthResponse {
  status: 'healthy' | 'degraded';
  version: string;
  docker_available: boolean;
  active_scans: number;
  event_bus_stats: Record<string, unknown>;
}

/**
 * Test connection to BugTraceAI CLI API
 * @param url Base URL of CLI API (e.g., http://localhost:8000)
 * @returns Connection result with health details
 */
export async function testCliConnection(url: string): Promise<CliConnectionResult> {
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

    const data: CliHealthResponse = await response.json();

    return {
      connected: true,
      status: data.status,
      version: data.version,
      dockerAvailable: data.docker_available,
      activeScans: data.active_scans,
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

/**
 * Default CLI API URL
 */
export const DEFAULT_CLI_URL = import.meta.env.VITE_CLI_API_URL || 'http://localhost:8000';

// ============================================================
// Backend (WEB) Health Check
// ============================================================

export interface BackendHealthResult {
  connected: boolean;
  status: 'ok' | 'error' | 'unreachable';
  database: {
    connected: boolean;
    host?: string;
    port?: string;
    database?: string;
    user?: string;
    stats?: {
      chatSessions: number;
      chatMessages: number;
      analysisReports: number;
      cliReports: number;
      settings: number;
    };
  };
  uptime?: number;
  environment?: string;
  error?: string;
  latencyMs?: number;
}

/**
 * Test connection to WEB Backend API
 * @returns Backend health result with database status
 */
export async function testBackendConnection(): Promise<BackendHealthResult> {
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/health/detailed', {
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
        database: { connected: false },
        error: `HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    }

    const data = await response.json();
    const healthData = data.data || data;

    return {
      connected: true,
      status: healthData.status || 'ok',
      database: {
        connected: healthData.database?.connected ?? false,
        host: healthData.database?.host,
        port: healthData.database?.port,
        database: healthData.database?.database,
        user: healthData.database?.user,
        stats: healthData.database?.stats,
      },
      uptime: healthData.uptime,
      environment: healthData.environment,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          connected: false,
          status: 'unreachable',
          database: { connected: false },
          error: 'Connection timed out (5s)',
          latencyMs,
        };
      }

      return {
        connected: false,
        status: 'unreachable',
        database: { connected: false },
        error: error.message || 'Network error',
        latencyMs,
      };
    }

    return {
      connected: false,
      status: 'unreachable',
      database: { connected: false },
      error: 'Unknown error',
      latencyMs,
    };
  }
}

// ============================================================
// Combined System Status
// ============================================================

export interface SystemStatus {
  backend: BackendHealthResult;
  cli: CliConnectionResult;
  timestamp: Date;
}

/**
 * Get full system status (backend + CLI)
 */
export async function getSystemStatus(cliUrl: string): Promise<SystemStatus> {
  const [backend, cli] = await Promise.all([
    testBackendConnection(),
    testCliConnection(cliUrl),
  ]);

  return {
    backend,
    cli,
    timestamp: new Date(),
  };
}
