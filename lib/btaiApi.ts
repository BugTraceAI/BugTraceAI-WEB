/**
 * BugTraceAI-API Client - Typed fetch wrappers for the BugTraceAI-API REST server.
 *
 * BugTraceAI-API is a SEPARATE process from the CLI (two products, two Dockers).
 * WEB talks to it the same way it already talks to the CLI: over HTTP.
 * - The API REST has NO WebSocket. Status is HTTP polling only.
 * - scan_id is an opaque STRING (truncated UUID). Never Number()/parseInt() it.
 * - This file is deliberately separate from lib/cliApi.ts: the two engines have
 *   different contracts, different ids, and different capabilities.
 *
 * The operational base URL is NOT a frozen module constant: it is created from the
 * current runtime Settings URL (Settings "API Connector"), which is editable, and
 * VITE_* variables are build-time. See HANDOFF section B.1/E/F.
 *
 * Author: BugtraceAI Team
 * Date: 2026-09-14
 * Version: 1.0.0
 */

/** Default base path in same-origin / reverse-proxy mode (parallel to /cli-api). */
export const BTAI_API_PATH = '/btai-api';

/** Default timeout for BugTraceAI-API requests (30s). */
const BTAI_FETCH_TIMEOUT = 30_000;

/** Auth shape the API REST currently understands (bearer/basic token only). */
export type BtaiApiAuth =
  | { type: 'bearer'; token: string }
  | { type: 'basic'; token: string };

export interface BtaiApiScanRequest {
  target: string;
  depth?: 'standard' | 'deep';
  auth?: BtaiApiAuth;
  schema_url?: string;
  // WEB asks for this explicitly; direct REST omits it and the server assigns `api`.
  launch_origin?: 'web-api';
}

export interface BtaiApiScanCreated {
  scan_id: string;
  status: string;
  message: string;
  engine?: 'api';
  launch_origin?: string;
}

export interface BtaiApiScanStatus {
  scan_id: string;
  target: string;
  status: string; // pending | running | completed | failed | stopped
  current_phase?: string | null;
  progress: number; // 0.0..1.0 (NOT 0-100)
  started_at?: string | null;
  finished_at?: string | null;
  findings_count?: number;
  error?: string | null;
  warning?: string | null;
  /** Provider/model used for optional AI enrichment; absent when no provider ran. */
  analysis_provider?: string | null;
  analysis_model?: string | null;
  engine?: 'api';
  launch_origin?: string;
}

export interface BtaiApiFinding {
  id?: string;
  title?: string;
  severity?: string;
  confidence?: number;
  category?: string;
  endpoint?: string;
  source_tools?: string[];
  /** Machine classification from BugTraceAI-API (confirmed|suspicious|hardening|insufficient). */
  classification?: string;
  /** Validation state from the API evidence contract (confirmed|needs_validation|...). */
  validation_status?: string;
  evidence?: Record<string, unknown>;
  repro?: Record<string, unknown>;
  /** Normalized context supplied by BugTraceAI-API for the expanded row. */
  detail_context?: Record<string, unknown>;
  /** Provider/model-backed assessment for findings selected for enrichment. */
  ai_enrichment?: {
    status?: string;
    model?: string;
    poc?: string;
    error?: string | null;
    failover_trail?: string[];
  };
}

export interface BtaiApiScanResults {
  status?: BtaiApiScanStatus;
  findings?: BtaiApiFinding[];
  endpoints?: unknown[];
  schema?: unknown;
  tool_health?: Record<string, unknown>;
  ai_analysis?: unknown;
}

/** API → CLI handoff handoff pack for a second-pass scan. */
export type BtaiApiHandoff = Record<string, unknown>;

export interface BtaiApiListItem {
  engine?: 'api';
  scan_id: string;
  target: string;
  status: string;
  current_phase?: string | null;
  progress?: number;
  started_at?: string | null;
  finished_at?: string | null;
  findings_count?: number;
  analysis_provider?: string | null;
  analysis_model?: string | null;
  results_available?: boolean;
  openapi_available?: boolean;
  launch_origin?: string;
  storage?: string;
}

export interface BtaiApiListResponse {
  scans: BtaiApiListItem[];
  next_cursor?: string | null;
}

export interface BtaiApiHealth {
  status: string;
  service: string;
  version?: string;
  provider?: string;
  provider_name?: string;
  model?: string;
  api_key_configured?: boolean;
}

export interface BtaiApiProviderSummary {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  model: string;
  /** Ordered primary + fallback models used by API Phase 5. */
  model_chain?: string[];
  /** Models selectable for this provider; the first entry is the provider default. */
  models?: string[];
  recommended?: boolean;
  api_key_configured: boolean;
  api_key_hint?: string;
  api_key_env?: string | null;
  features?: { description?: string };
  active?: boolean;
}

export interface BtaiApiProviderDetail extends BtaiApiProviderSummary {
  provider: string;
}

export interface BtaiApiProviderUpdate {
  provider: string;
  api_key?: string;
  model?: string;
  /** Ordered primary + fallback models; maximum three entries. */
  models?: string[];
}

export interface BtaiApiProviderTest {
  provider: string;
  api_key?: string;
  model?: string;
}

export interface BtaiApiClient {
  startScan(req: BtaiApiScanRequest, signal?: AbortSignal): Promise<BtaiApiScanCreated>;
  getScanStatus(scanId: string, signal?: AbortSignal): Promise<BtaiApiScanStatus>;
  getScanResults(scanId: string, signal?: AbortSignal): Promise<BtaiApiScanResults>;
  stopScan(scanId: string, signal?: AbortSignal): Promise<{ scan_id: string; status: string; message: string }>;
  listScans(limit?: number, signal?: AbortSignal): Promise<BtaiApiListResponse>;
  getOpenApi(scanId: string, signal?: AbortSignal): Promise<unknown>;
  getHandoff(scanId: string, signal?: AbortSignal): Promise<BtaiApiHandoff>;
  downloadArtifact(scanId: string, artifact: 'findings.json' | 'report.md' | 'openapi.json' | 'report.zip', signal?: AbortSignal): Promise<{ blob: Blob; filename?: string }>;
  listProviders(signal?: AbortSignal): Promise<BtaiApiProviderSummary[]>;
  getProvider(signal?: AbortSignal): Promise<BtaiApiProviderDetail>;
  getProviderDetail(providerId: string, signal?: AbortSignal): Promise<BtaiApiProviderDetail>;
  updateProvider(req: BtaiApiProviderUpdate, signal?: AbortSignal): Promise<BtaiApiProviderDetail & { message: string }>;
  testProvider(req: BtaiApiProviderTest, signal?: AbortSignal): Promise<{ success: boolean; message: string }>;
  healthCheck(signal?: AbortSignal): Promise<BtaiApiHealth>;
}

/** Normalize trailing slash so `${base}/api` and `${base}/api/` behave identically. */
const withBase = (base: string, path: string): string => {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/${path.replace(/^\/+/, '')}`;
};

/**
 * Safe typed error. Keeps the status + a human-readable message. Never logs
 * bearer/basic tokens or raw secret-bearing request bodies.
 */
export class BtaiApiError extends Error {
  readonly status: number | null;
  readonly body: unknown;

  constructor(message: string, status: number | null = null, body: unknown = undefined) {
    super(message);
    this.name = 'BtaiApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseErrorBody(response: Response): Promise<{ detail?: string; message?: string } | null> {
  try {
    const data = await response.json();
    if (data && typeof data === 'object') {
      return data as { detail?: string; message?: string };
    }
  } catch {
    // Response body was empty or not valid JSON — keep generic fallback.
  }
  return null;
}

async function handleBtaiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await parseErrorBody(response);
    const detail = body?.detail || body?.message;
    throw new BtaiApiError(
      detail ? String(detail) : `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      body,
    );
  }
  // 204/empty responses must not crash JSON parsing.
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as unknown as T;
  }
  try {
    return (await response.json()) as T;
  } catch {
    const text = await response.text().catch(() => '');
    if (!text) return undefined as unknown as T;
    throw new BtaiApiError(`Invalid JSON from BugTraceAI-API: ${text.slice(0, 200)}`, response.status);
  }
}

/**
 * Create a BugTraceAI-API client bound to a runtime base URL.
 *
 * @param url Base URL, e.g. the Settings "API Connector" value (`/btai-api` or an absolute URL).
 */
export function createBtaiApi(url: string): BtaiApiClient {
  const base = url || BTAI_API_PATH;

  const request = (path: string, init?: RequestInit): Promise<Response> =>
    fetch(withBase(base, path), init);

  const jsonRequest = (path: string, init?: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (init?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return request(path, { ...init, headers });
  };

  /** Combine an optional caller-provided signal with a hard timeout so no request hangs forever. */
  const withSignal = (signal?: AbortSignal): AbortSignal => {
    if (!signal) return AbortSignal.timeout(BTAI_FETCH_TIMEOUT);
    if (signal.aborted) return signal;
    // Manual combiner that works on all TS/DOM lib versions (not just AbortSignal.any).
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), BTAI_FETCH_TIMEOUT);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      controller.abort();
    }, { once: true });
    // Also forward completion so the timer self-cleans on success.
    const done = () => clearTimeout(id);
    controller.signal.addEventListener('abort', done, { once: true });
    return controller.signal;
  };

  return {
    /** Start a new API scan. `launch_origin: "web-api"` because WEB launched it. */
    startScan(req: BtaiApiScanRequest, signal?: AbortSignal): Promise<BtaiApiScanCreated> {
      const body: Record<string, unknown> = { target: req.target };
      if (req.depth) body.depth = req.depth;
      if (req.auth) body.auth = req.auth;
      if (req.schema_url) body.schema_url = req.schema_url;
      // WEB explicitly requests web-api; direct REST omits it (server assigns `api`).
      body.launch_origin = req.launch_origin || 'web-api';
      return jsonRequest('api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: withSignal(signal),
      }).then(handleBtaiResponse<BtaiApiScanCreated>);
    },

    /** Poll scan status. HTTP only — the API has no WebSocket. */
    getScanStatus(scanId: string, signal?: AbortSignal): Promise<BtaiApiScanStatus> {
      return request(`api/scan/${encodeURIComponent(scanId)}`, { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiScanStatus>);
    },

    /** Structured current-scan results (may be partial while running). */
    getScanResults(scanId: string, signal?: AbortSignal): Promise<BtaiApiScanResults> {
      return request(`api/scan/${encodeURIComponent(scanId)}/results`, { signal: withSignal(signal) })
        .then(handleBtaiApiScanResults);
    },

    /** Stop a running scan. This is Stop (a control action), NOT report purge. */
    stopScan(scanId: string, signal?: AbortSignal): Promise<{ scan_id: string; status: string; message: string }> {
      return request(`api/scan/${encodeURIComponent(scanId)}`, { method: 'DELETE', signal: withSignal(signal) })
        .then(handleBtaiResponse<{ scan_id: string; status: string; message: string }>);
    },

    /**
     * List scans (future API `GET /api/scans?limit=`). Returns an empty list when
     * the route is not implemented yet so the caller can degrade gracefully.
     */
    listScans(limit?: number, signal?: AbortSignal): Promise<BtaiApiListResponse> {
      const query = limit ? `?limit=${limit}` : '';
      return request(`api/scans${query}`, { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiListResponse>);
    },

    /** Generated OpenAPI document for a scan (404 before discovery has written it). */
    getOpenApi(scanId: string, signal?: AbortSignal): Promise<unknown> {
      return request(`api/scan/${encodeURIComponent(scanId)}/openapi`, { signal: withSignal(signal) })
        .then(handleBtaiResponse<unknown>);
    },

    /** Full API handoff pack consumed by the CLI-refactor second pass. */
    getHandoff(scanId: string, signal?: AbortSignal): Promise<BtaiApiHandoff> {
      return request(`api/scan/${encodeURIComponent(scanId)}/handoff`, { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiHandoff>);
    },

    async downloadArtifact(scanId: string, artifact: 'findings.json' | 'report.md' | 'openapi.json' | 'report.zip', signal?: AbortSignal): Promise<{ blob: Blob; filename?: string }> {
      const path = artifact === 'report.zip'
        ? `api/scan/${encodeURIComponent(scanId)}/report-zip`
        : `api/scan/${encodeURIComponent(scanId)}/downloads/${artifact}`;
      const response = await request(path, { signal: withSignal(signal) });
      if (!response.ok) {
        const body = await parseErrorBody(response);
        throw new BtaiApiError(body?.detail || `HTTP ${response.status}: ${response.statusText}`, response.status, body);
      }
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      return { blob: await response.blob(), filename };
    },

    /** Provider management mirrors the CLI contract, without ever returning a secret. */
    listProviders(signal?: AbortSignal): Promise<BtaiApiProviderSummary[]> {
      return request('api/providers', { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiProviderSummary[]>);
    },

    getProvider(signal?: AbortSignal): Promise<BtaiApiProviderDetail> {
      return request('api/provider', { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiProviderDetail>);
    },

    getProviderDetail(providerId: string, signal?: AbortSignal): Promise<BtaiApiProviderDetail> {
      return request(`api/providers/${encodeURIComponent(providerId)}`, { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiProviderDetail>);
    },

    updateProvider(req: BtaiApiProviderUpdate, signal?: AbortSignal): Promise<BtaiApiProviderDetail & { message: string }> {
      return jsonRequest('api/provider', {
        method: 'PUT',
        body: JSON.stringify(req),
        signal: withSignal(signal),
      }).then(handleBtaiResponse<BtaiApiProviderDetail & { message: string }>);
    },

    testProvider(req: BtaiApiProviderTest, signal?: AbortSignal): Promise<{ success: boolean; message: string }> {
      return jsonRequest('api/provider/test', {
        method: 'POST',
        body: JSON.stringify(req),
        signal: withSignal(signal),
      }).then(handleBtaiResponse<{ success: boolean; message: string }>);
    },

    /** Health check. Connected only when {status:"ok", service:"bugtraceai-api"}. */
    healthCheck(signal?: AbortSignal): Promise<BtaiApiHealth> {
      return request('health', { signal: withSignal(signal) })
        .then(handleBtaiResponse<BtaiApiHealth>);
    },
  };
}

/** Local helper so a missing/results-less response still returns a typed object. */
async function handleBtaiApiScanResults(response: Response): Promise<BtaiApiScanResults> {
  if (!response.ok) {
    // Treat a 404 on results as "scan no longer in memory" with a clear message.
    const body = await parseErrorBody(response);
    if (response.status === 404) {
      throw new BtaiApiError(
        body?.detail || 'BugTraceAI-API no longer has this scan in memory.',
        response.status,
        body,
      );
    }
    throw new BtaiApiError(
      body?.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      body,
    );
  }
  return handleBtaiResponse<BtaiApiScanResults>(response);
}

const btaiApiFactory = { createBtaiApi };
export default btaiApiFactory;
