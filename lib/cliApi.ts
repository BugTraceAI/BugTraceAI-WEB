/**
 * CLI API Client - Typed fetch wrappers for CLI FastAPI endpoints.
 *
 * Provides a thin client layer for communicating with BugTraceAI CLI FastAPI server.
 * All functions use native fetch() API (not axios).
 *
 * Author: BugtraceAI Team
 * Date: 2026-01-27
 * Version: 2.0.0
 */

// CLI FastAPI base URL (default: http://localhost:8000)
export const CLI_API_URL = import.meta.env.VITE_CLI_API_URL || 'http://localhost:8000';
const CLI_API_BASE = `${CLI_API_URL}/api`;

// WebSocket base URL
// Absolute URL (local dev): http://localhost:8000 → ws://localhost:8000
// Relative path (Docker):   /cli-api → ws://currenthost/cli-api
export const CLI_WS_URL = CLI_API_URL.startsWith('http')
  ? CLI_API_URL.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${CLI_API_URL}`;


// ============================================================================
// TypeScript Interfaces (matching CLI FastAPI schemas.py)
// ============================================================================

export interface CreateScanRequest {
  target_url: string;
  scan_type?: string;
  safe_mode?: boolean;
  max_depth?: number;
  max_urls?: number;
  resume?: boolean;
  use_vertical?: boolean;
  focused_agents?: string[];
  param?: string;
}

export interface ScanStatusResponse {
  scan_id: number;
  target: string;
  status: string; // PENDING, INITIALIZING, RUNNING, PAUSED, COMPLETED, STOPPED, FAILED
  progress: number; // 0-100
  uptime_seconds?: number;
  findings_count: number;
  active_agent?: string;
  phase?: string;
  origin?: string; // "cli" or "web"
}

export interface ScanSummary {
  scan_id: number;
  target: string;
  status: string;
  progress: number;
  timestamp: string; // ISO format
  origin: string; // "cli" or "web"
  has_report: boolean; // Whether report files exist on disk
}

export interface ScanListResponse {
  scans: ScanSummary[];
  total: number;
  page: number;
  per_page: number;
}

export interface StopScanResponse {
  scan_id: number;
  status: string;
  message: string;
}

export interface FindingItem {
  finding_id: number;
  type: string;
  severity: string; // CRITICAL, HIGH, MEDIUM, LOW, INFO
  details: string;
  payload?: string;
  url: string;
  parameter?: string;
  validated: boolean;
  status: string;
  confidence?: number;
}

export interface FindingsResponse {
  findings: FindingItem[];
  total: number;
  page: number;
  per_page: number;
  scan_id: number;
}

export interface ConfigResponse {
  config: Record<string, any>;
  version: string;
}

export interface ConfigUpdateRequest {
  [key: string]: any;
}

export interface HealthCheckResponse {
  status: string;
  version: string;
  docker_available: boolean;
  active_scans: number;
  event_bus_stats: Record<string, any>;
}


// ============================================================================
// API Client Functions
// ============================================================================

/** Default timeout for CLI API requests (30s). */
const CLI_FETCH_TIMEOUT = 30_000;

/**
 * Helper function to handle fetch responses.
 * Throws an error with response detail on non-2xx status.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const text = await response.text();
      const errorData = JSON.parse(text);
      // Support both: FastAPI default {detail} and global exception handler {error: {message}}
      message = errorData.detail || errorData.error?.message || message;
    } catch {
      // Response body was empty or not valid JSON — keep fallback
    }
    throw new Error(message);
  }
  return response.json();
}


/**
 * Start a new scan.
 *
 * @param config Scan configuration
 * @returns Scan status response with scan_id
 */
export async function startScan(config: CreateScanRequest): Promise<ScanStatusResponse> {
  const response = await fetch(`${CLI_API_BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
    signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT),
  });
  return handleResponse<ScanStatusResponse>(response);
}


/**
 * Get scan status by ID.
 *
 * @param scanId Scan ID
 * @returns Scan status response
 */
export async function getScanStatus(scanId: number): Promise<ScanStatusResponse> {
  const response = await fetch(`${CLI_API_BASE}/scans/${scanId}/status`, { signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT) });
  return handleResponse<ScanStatusResponse>(response);
}


/**
 * List all scans with optional filtering and pagination.
 *
 * @param params Optional query parameters (page, per_page, status_filter)
 * @returns Paginated scan list
 */
export async function listScans(params?: {
  page?: number;
  per_page?: number;
  status_filter?: string;
}): Promise<ScanListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.per_page) queryParams.set('per_page', params.per_page.toString());
  if (params?.status_filter) queryParams.set('status_filter', params.status_filter);

  const url = `${CLI_API_BASE}/scans${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT) });
  return handleResponse<ScanListResponse>(response);
}


/**
 * Stop a running scan.
 *
 * @param scanId Scan ID
 * @returns Stop scan response
 */
export async function stopScan(scanId: number): Promise<StopScanResponse> {
  const response = await fetch(`${CLI_API_BASE}/scans/${scanId}/stop`, {
    method: 'POST',
    signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT),
  });
  return handleResponse<StopScanResponse>(response);
}


/**
 * Pause a running scan.
 *
 * @param scanId Scan ID
 * @returns Pause response
 */
export async function pauseScan(scanId: number): Promise<StopScanResponse> {
  const response = await fetch(`${CLI_API_BASE}/scans/${scanId}/pause`, {
    method: 'POST',
    signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT),
  });
  return handleResponse<StopScanResponse>(response);
}


/**
 * Resume a paused scan.
 *
 * @param scanId Scan ID
 * @returns Resume response
 */
export async function resumeScan(scanId: number): Promise<StopScanResponse> {
  const response = await fetch(`${CLI_API_BASE}/scans/${scanId}/resume`, {
    method: 'POST',
    signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT),
  });
  return handleResponse<StopScanResponse>(response);
}


/**
 * Get scan findings with optional filtering and pagination.
 *
 * @param scanId Scan ID
 * @param params Optional query parameters (severity, vuln_type, page, per_page)
 * @returns Paginated findings list
 */
export async function getScanFindings(scanId: number, params?: {
  severity?: string;
  vuln_type?: string;
  page?: number;
  per_page?: number;
}): Promise<FindingsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.severity) queryParams.set('severity', params.severity);
  if (params?.vuln_type) queryParams.set('vuln_type', params.vuln_type);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.per_page) queryParams.set('per_page', params.per_page.toString());

  const url = `${CLI_API_BASE}/scans/${scanId}/findings${queryParams.toString() ? `?${queryParams}` : ''}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT) });
  return handleResponse<FindingsResponse>(response);
}


/**
 * Get scan report in specified format.
 *
 * @param scanId Scan ID
 * @param format Report format (html, markdown, json)
 * @returns Response object for blob download
 */
export async function getReport(scanId: number, format: 'html' | 'markdown' | 'json'): Promise<Response> {
  const response = await fetch(`${CLI_API_BASE}/scans/${scanId}/report/${format}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const text = await response.text();
      const errorData = JSON.parse(text);
      message = errorData.detail || errorData.error?.message || message;
    } catch {
      // Response body was empty or not valid JSON
    }
    throw new Error(message);
  }
  return response;
}


/**
 * Get current configuration.
 *
 * @returns Configuration response
 */
export async function getConfig(): Promise<ConfigResponse> {
  const response = await fetch(`${CLI_API_BASE}/config`, { signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT) });
  return handleResponse<ConfigResponse>(response);
}


/**
 * Update configuration.
 *
 * @param updates Configuration updates
 * @returns Update response
 */
export async function updateConfig(updates: ConfigUpdateRequest): Promise<{ updated: Record<string, { from: any; to: any }>; message: string }> {
  const response = await fetch(`${CLI_API_BASE}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT),
  });
  return handleResponse<{ updated: Record<string, { from: any; to: any }>; message: string }>(response);
}


/**
 * Delete a scan and its associated findings.
 *
 * @param scanId Scan ID to delete
 * @returns Delete confirmation response
 */
export async function deleteScan(scanId: number): Promise<{ scan_id: number; message: string; files_cleaned: boolean }> {
  const response = await fetch(`${CLI_API_BASE}/scans/${scanId}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(CLI_FETCH_TIMEOUT),
  });
  return handleResponse<{ scan_id: number; message: string; files_cleaned: boolean }>(response);
}


/**
 * Health check endpoint.
 *
 * @returns Health status
 */
export async function healthCheck(): Promise<HealthCheckResponse> {
  const response = await fetch(`${CLI_API_URL}/health`, { signal: AbortSignal.timeout(10_000) });
  return handleResponse<HealthCheckResponse>(response);
}


// ============================================================================
// Default Export
// ============================================================================

const cliApi = {
  startScan,
  getScanStatus,
  listScans,
  stopScan,
  pauseScan,
  resumeScan,
  deleteScan,
  getScanFindings,
  getReport,
  getConfig,
  updateConfig,
  healthCheck,
};

export { cliApi };
export default cliApi;
