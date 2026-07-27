// services/finisherSeed.ts
// "The Finisher" (AI Repeater) — seed plumbing.
//
// An ExploitSeed carries everything the CLI scanner already learned about an
// UNCONFIRMED finding, so the agent resumes exploitation where the scan stopped
// instead of starting cold. Two ways to build one:
//   - parseRawFindingToSeed(raw): map a CLI raw_findings.json entry → ExploitSeed
//   - the manual form in FinisherAssistant (for testing without a live scan)
//
// CLI-INDEPENDENCE: this reads the CLI's *output artifacts* over HTTP (the existing
// report-file endpoint). It never imports CLI code. The tool degrades gracefully:
// with a poor/empty seed the agent simply has less to start from.

import { ExploitSeed, RepeaterRequestDict } from '../types.ts';
import { DEFAULT_CLI_URL } from './cliConnector.ts';

/** Map a CLI repro request object (snake_case) → RepeaterRequestDict. */
function mapReproRequest(r: any): RepeaterRequestDict | undefined {
  if (!r || !r.url) return undefined;
  return { method: r.method || 'GET', url: r.url, headers: r.headers || undefined, body: r.body ?? undefined, bodyContentType: r.body_content_type ?? undefined };
}

/** Map the CLI `repro` envelope → the enrichment fields of an ExploitSeed. */
export function mapReproToSeed(repro: any): Partial<ExploitSeed> {
  if (!repro) return {};
  return {
    confirmingRequest: mapReproRequest(repro.confirming_request),
    confirmingResponse: repro.confirming_response ? { status: repro.confirming_response.status, excerpt: repro.confirming_response.excerpt } : undefined,
    readbackRequest: mapReproRequest(repro.readback_request),
    authUsed: repro.auth?.auth_used ?? undefined,
    authScheme: repro.auth?.auth_scheme ?? undefined,
  };
}

/** Short label for an AI Repeater tab, derived from the seed (vuln type + param/path). */
export function repeaterTabLabel(seed: ExploitSeed | null | undefined): string {
  if (!seed) return 'New';
  const vt = (seed.vulnType || 'REQ').toUpperCase();
  if (seed.parameter) return `${vt} · ${seed.parameter}`;
  let path = seed.url || '';
  try { path = new URL(seed.url).pathname || seed.url; } catch { /* relative */ }
  const short = path.length > 16 ? '…' + path.slice(-15) : path;
  return `${vt} · ${short}`.trim();
}

/** Render a captured request dict as a raw HTTP request string. */
export function serializeRequestDict(r: RepeaterRequestDict): string {
  let host = '';
  let pathQ = r.url;
  try { const u = new URL(r.url); host = u.host; pathQ = (u.pathname || '/') + (u.search || ''); } catch { /* relative url */ }
  const lines = [`${(r.method || 'GET').toUpperCase()} ${pathQ} HTTP/1.1`];
  const headers = r.headers || {};
  if (host && !Object.keys(headers).some((h) => h.toLowerCase() === 'host')) lines.push(`Host: ${host}`);
  for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
  return lines.join('\n') + '\n\n' + (r.body || '');
}

/** Statuses the CLI uses for findings it reflected/suspected but did not confirm. */
export const UNCONFIRMED_STATUSES = [
  'NEEDS_CDP_VALIDATION',
  'PENDING_VALIDATION',
  'manual_review',
  'reflected',
  'unconfirmed',
];

// Pick the first present key from a loose object (CLI JSON shapes vary by version).
function pick<T = unknown>(obj: Record<string, any>, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k] as T;
  }
  return undefined;
}

function toStringArray(v: unknown): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
  if (typeof v === 'string') return [v];
  return undefined;
}

/**
 * Map a single CLI raw finding object into an ExploitSeed, defensively — the exact
 * schema of raw_findings.json / xss_results.json varies across CLI versions, so we
 * probe several common key names and tolerate missing fields.
 */
export function parseRawFindingToSeed(raw: Record<string, any>, fallbackTarget?: string): ExploitSeed {
  const status = (pick<string>(raw, ['status', 'state', 'validation_status']) || '').toString();
  const needsCdp =
    /cdp/i.test(status) ||
    Boolean(pick(raw, ['needs_cdp', 'needs_cdp_validation', 'requires_cdp_validation']));

  return {
    scanId: raw.scanId != null ? Number(raw.scanId) : undefined,
    findingId: raw.findingId != null ? Number(raw.findingId) : (raw.finding_id != null ? Number(raw.finding_id) : undefined),
    vulnType: (pick<string>(raw, ['vulnerability_type', 'vuln_type', 'type', 'category', 'vulnerability']) || 'XSS').toString(),
    url: (pick<string>(raw, ['url', 'target_url', 'endpoint', 'location']) || fallbackTarget || '').toString(),
    parameter: pick<string>(raw, ['parameter', 'param', 'param_name', 'injection_point']),
    method: (pick<string>(raw, ['method', 'http_method']) as 'GET' | 'POST' | undefined),
    reflectingPayloads: toStringArray(
      pick(raw, ['reflecting_payloads', 'reflected_payloads', 'payloads', 'tried_payloads', 'candidates']),
    ),
    reflectionContext: pick<string>(raw, ['reflection_context', 'context', 'detected_context']),
    survivingChars: pick<string>(raw, ['surviving_chars', 'chars_survive', 'chars_survived', 'surviving_characters']),
    serverEscaping: pick<string>(raw, ['server_escaping', 'escaping', 'sanitization']),
    baselineRequest: pick<string>(raw, ['baseline_request', 'request', 'raw_request', 'curl']),
    baselineResponse: pick<string>(raw, ['baseline_response', 'response', 'evidence', 'snippet']),
    whyStalled: pick<string>(raw, ['why_stalled', 'reason', 'blood_smell', 'notes', 'skeptic_reason']),
    confidence: pick<number>(raw, ['confidence', 'fp_confidence', 'score']),
    needsCdp,
    ...mapReproToSeed(raw.repro),
  };
}

/**
 * Fetch a scan output file from the CLI API and parse it into ExploitSeeds.
 * Uses the CLI's existing path-traversal-guarded GET /scans/{id}/files/{path}.
 * NOTE (Phase 0): the exact endpoint shape should be validated against a live scan;
 * the manual form remains the reliable test path until then.
 */
export async function loadSeedsFromCli(
  scanId: string,
  filename = 'raw_findings.json',
): Promise<ExploitSeed[]> {
  const base = (DEFAULT_CLI_URL || '').replace(/\/+$/, '');
  const res = await fetch(`${base}/scans/${encodeURIComponent(scanId)}/files/${filename}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`CLI returned HTTP ${res.status} for ${filename} (scan ${scanId})`);
  }
  const data = await res.json();
  const list: Record<string, any>[] = Array.isArray(data)
    ? data
    : (data.findings || data.results || data.items || (data ? [data] : []));
  return list
    .map((f) => parseRawFindingToSeed({ ...f, scanId: Number(scanId) || undefined }))
    .filter((s) => s.url); // drop entries with no URL — nothing to send
}

/**
 * Render an ExploitSeed into the initial user message that kicks off the agent loop.
 * This is the whole point of the Finisher: hand the agent the scanner's near-miss
 * context so it continues, not restarts.
 */
export function buildFinisherUserMessage(seed: ExploitSeed): string {
  const lines: string[] = [];
  const s = (seed.status || '').toLowerCase();
  const confirmed = s.includes('confirm') || s === 'validated' || s.includes('exploit');
  if (confirmed) {
    lines.push(
      `The BugTraceAI scanner CONFIRMED a **${seed.vulnType}** on the target below. Use this AI Repeater to reproduce it live, craft the cleanest copy-pasteable proof-of-concept, and where safely possible escalate its impact — all strictly non-destructive.`,
    );
  } else {
    lines.push(
      `The BugTraceAI scanner found a likely **${seed.vulnType}** on the target below but could NOT confirm/exploit it. Your job: finish exploiting it and land a working, non-destructive proof-of-concept.`,
    );
  }
  lines.push('');
  lines.push('## What the scanner already learned');
  lines.push(`- Target URL: ${seed.url}`);
  if (seed.parameter) lines.push(`- Injection parameter: \`${seed.parameter}\`${seed.method ? ` (${seed.method})` : ''}`);
  if (seed.reflectionContext) lines.push(`- Reflection context: ${seed.reflectionContext}`);
  if (seed.survivingChars) lines.push(`- Characters that survived filtering: \`${seed.survivingChars}\``);
  if (seed.serverEscaping) lines.push(`- Server escaping observed: ${seed.serverEscaping}`);
  if (seed.whyStalled) lines.push(`- ${confirmed ? 'Scanner notes' : 'Why the scanner stalled'}: ${seed.whyStalled}`);
  if (typeof seed.confidence === 'number') lines.push(`- Scanner confidence: ${seed.confidence}`);
  if (seed.needsCdp) {
    lines.push(
      `- NOTE: flagged as needing DOM-level (browser) validation. HTTP reflection alone may not prove execution — get as far as you can over HTTP and clearly state if a real browser is required.`,
    );
  }
  if (seed.reflectingPayloads && seed.reflectingPayloads.length) {
    lines.push('');
    lines.push(confirmed ? '### Confirming payload(s)' : '### Payloads that reflected but did NOT fire');
    for (const p of seed.reflectingPayloads.slice(0, 15)) lines.push(`- \`${p}\``);
  }
  if (seed.confirmingRequest) {
    lines.push('');
    lines.push('### The exact request the scanner used to CONFIRM this — replay & refine it');
    lines.push('```http');
    lines.push(serializeRequestDict(seed.confirmingRequest).slice(0, 2500));
    lines.push('```');
    if (seed.readbackRequest) {
      lines.push('Then read the stored payload back with:');
      lines.push('```http');
      lines.push(serializeRequestDict(seed.readbackRequest).slice(0, 1500));
      lines.push('```');
    }
    if (seed.authUsed) lines.push(`> NOTE: this request used **${seed.authScheme || 'auth'}** (masked here — supply a fresh token to replay).`);
  } else if (seed.baselineRequest) {
    lines.push('');
    lines.push('### Closest-miss request');
    lines.push('```http');
    lines.push(seed.baselineRequest.slice(0, 2000));
    lines.push('```');
  }
  lines.push('');
  lines.push('## Your task');
  lines.push(
    confirmed
      ? 'Use the `send_request` tool to re-send this against the exact target and reproduce the issue live, then refine the payload into the cleanest, highest-impact non-destructive PoC and verify it in the response.'
      : 'Use the `send_request` tool to re-send mutated requests against this exact target. After each send, inspect the response to see WHERE and HOW the payload reflects (the surviving characters tell you which breakout to try), then iterate with targeted mutations until you confirm exploitation.',
  );
  lines.push(
    'Stay non-destructive: for XSS aim for `alert(document.domain)`/a benign marker; for SQLi confirm via error/boolean/UNION signatures — never dump or destroy data. Explain each step in one or two lines. When confirmed, output the final working PoC request/URL clearly.',
  );
  lines.push('');
  lines.push('Begin now: send your first probing request with `send_request`.');
  return lines.join('\n');
}

// ── Repeater eligibility ───────────────────────────────────────────────────
// Only HTTP request/parameter-mutation vuln classes make sense in the repeater.
// Excludes things a repeater can't help with: security headers, misconfig,
// vulnerable-library/version, info disclosure, TLS, tech fingerprint, etc.
const REPEATER_ELIGIBLE_RE = /\b(xss|cross[ _-]?site[ _-]?script|sqli|sql[ _-]?inj|csti|ssti|template[ _-]?inj|idor|insecure[ _-]?direct[ _-]?object|lfi|rfi|file[ _-]?inclusion|path[ _-]?travers|directory[ _-]?travers|rce|remote[ _-]?code|command[ _-]?inj|os[ _-]?command|ssrf|open[ _-]?redirect|header[ _-]?inj|crlf|host[ _-]?header|prototype[ _-]?pollution|graphql|mass[ _-]?assign|nosql|xxe|ldap|jwt|broken[ _-]?access|access[ _-]?control|authoriz|authz|bac|csrf|cors|deserial|injection)\b/i;

/** True if a finding's vuln type is worth taking to the AI Repeater. */
export function isRepeaterEligible(vulnType?: string | null): boolean {
  return !!vulnType && REPEATER_ELIGIBLE_RE.test(vulnType);
}

// ── Raw HTTP request helpers (the repeater's Request pane) ──────────────────

function upsertQueryParam(pathWithQuery: string, name: string, value: string): string {
  const qIdx = pathWithQuery.indexOf('?');
  const path = qIdx >= 0 ? pathWithQuery.slice(0, qIdx) : pathWithQuery;
  const qs = qIdx >= 0 ? pathWithQuery.slice(qIdx + 1) : '';
  const params = qs.split('&').filter(Boolean).map((kv) => {
    const eq = kv.indexOf('=');
    return eq >= 0 ? [kv.slice(0, eq), kv.slice(eq + 1)] : [kv, ''];
  });
  const enc = encodeURIComponent(value);
  let found = false;
  for (const p of params) {
    try { if (decodeURIComponent(p[0]) === name) { p[1] = enc; found = true; } } catch { /* skip bad kv */ }
  }
  if (!found) params.push([name, enc]);
  const newQs = params.map(([k, v]) => `${k}=${v}`).join('&');
  return newQs ? `${path}?${newQs}` : path;
}

/** Build an editable raw HTTP request from a finding seed — pre-loads the repeater's Request pane. */
export function buildRawRequestFromSeed(seed: ExploitSeed): string {
  // Seed enrichment: prefer the REAL request the scanner used to confirm.
  if (seed.confirmingRequest) {
    return serializeRequestDict(seed.confirmingRequest);
  }
  // Fallback (legacy / unconfirmed findings): reconstruct a realistic request.
  // Most specialists don't write a structured `repro` dict, so we build from seed fields.
  let host = '';
  let pathWithQuery = '/';
  try {
    const u = new URL(seed.url);
    host = u.host;
    pathWithQuery = (u.pathname || '/') + (u.search || '');
  } catch {
    pathWithQuery = seed.url || '/';
  }
  const method = (seed.method || 'GET').toUpperCase();
  const payload = seed.reflectingPayloads && seed.reflectingPayloads.length ? seed.reflectingPayloads[0] : undefined;
  const headers = [
    `Host: ${host}`,
    'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
    'Accept-Language: en-US,en;q=0.5',
    'Connection: close',
  ];

  // If the seed has a curl command or reproduction string, try to extract useful info
  const repro = seed.reproduction || seed.curlCommand || '';
  if (typeof repro === 'string') {
    // Extract Cookie header from curl -H 'Cookie: ...' or -b '...'
    const cookieMatch = repro.match(/-(?:H\s+['"]Cookie:\s*([^'"]+)|b\s+['"]([^'"]+))/i);
    if (cookieMatch) headers.push(`Cookie: ${cookieMatch[1] || cookieMatch[2]}`);
    // Extract Authorization header
    const authMatch = repro.match(/-H\s+['"]Authorization:\s*([^'"]+)/i);
    if (authMatch) headers.push(`Authorization: ${authMatch[1]}`);
    // Extract Content-Type
    const ctMatch = repro.match(/-H\s+['"]Content-Type:\s*([^'"]+)/i);
    if (ctMatch) headers.push(`Content-Type: ${ctMatch[1]}`);
  }

  let body = '';
  if (seed.parameter && payload) {
    if (method === 'POST') {
      // Detect if this looks like a JSON API endpoint
      const isJsonApi = seed.url.includes('/api/') || (typeof repro === 'string' && repro.includes('application/json'));
      if (isJsonApi) {
        body = JSON.stringify({ [seed.parameter]: payload });
        if (!headers.some(h => h.toLowerCase().startsWith('content-type'))) {
          headers.push('Content-Type: application/json');
        }
      } else {
        body = `${seed.parameter}=${encodeURIComponent(payload)}`;
        if (!headers.some(h => h.toLowerCase().startsWith('content-type'))) {
          headers.push('Content-Type: application/x-www-form-urlencoded');
        }
      }
    } else {
      pathWithQuery = upsertQueryParam(pathWithQuery, seed.parameter, payload);
    }
  }
  return `${method} ${pathWithQuery} HTTP/1.1\n${headers.join('\n')}\n\n${body}`;
}

export interface ParsedRequest { method: string; url: string; headers: Record<string, string>; data?: string; }

/** Parse an editable raw request back into fields for sending. Scheme isn't in the raw request, so pass a hint (from the seed URL). */
export function parseRawRequest(raw: string, schemeHint = 'https'): ParsedRequest {
  const parts = raw.split(/\r?\n\r?\n/);
  const head = parts[0] || '';
  const body = parts.slice(1).join('\n\n').trim();
  const lines = head.split(/\r?\n/).filter((l) => l.length > 0);
  const first = lines.shift() || 'GET / HTTP/1.1';
  const seg = first.split(/\s+/);
  const method = (seg[0] || 'GET').toUpperCase();
  const pathQ = seg[1] || '/';
  const headers: Record<string, string> = {};
  for (const l of lines) {
    const i = l.indexOf(':');
    if (i > 0) headers[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  const host = headers['Host'] || headers['host'] || '';
  const url = /^https?:\/\//i.test(pathQ) ? pathQ : `${schemeHint}://${host}${pathQ}`;
  return { method, url, headers, data: body || undefined };
}

/**
 * Send the current raw request through the WEB backend curl tool and return the raw -i response.
 *
 * `liveToken` (optional): the scanner masks captured auth tokens at confirm time
 * (`...<redacted>`) so secrets never touch disk. When the user supplies a fresh
 * token for THIS browser session, swap it in for the redacted placeholder right
 * before sending — the live secret stays in the browser, never persisted by the CLI.
 */
export async function sendRawRequest(
  raw: string,
  schemeHint = 'https',
  liveToken?: string,
): Promise<{ ok: boolean; result: string; ms: number }> {
  const { method, url, headers, data } = parseRawRequest(raw, schemeHint);
  const token = (liveToken || '').trim();
  const sendHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (/^content-length$/i.test(k)) continue; // curl recomputes
    let val = v;
    if (token && val.includes('<redacted>')) {
      // Authorization: a bare JWT gets a Bearer scheme; anything pre-schemed
      // (or a Cookie value) is injected verbatim.
      val = /^authorization$/i.test(k) && /^eyJ/.test(token) ? `Bearer ${token}` : token;
    }
    // Normalize a bare JWT in the Authorization header to a Bearer credential —
    // covers tokens pasted straight into the header without the scheme.
    if (/^authorization$/i.test(k) && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(val.trim())) {
      val = `Bearer ${val.trim()}`;
    }
    sendHeaders[k] = val;
  }
  const base = (import.meta.env.VITE_API_URL as string) || '/api';
  const started = performance.now();
  const res = await fetch(`${base}/tools/curl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, headers: sendHeaders, data, follow_redirects: false, insecure: true }),
  });
  const json = await res.json();
  const r = json?.data ?? json;
  return { ok: Boolean(r?.success), result: r?.result || '(no output)', ms: Math.round(performance.now() - started) };
}

export interface ParsedResponse { statusLine: string; status: number; headers: string; body: string; }

/**
 * Optional auto-auth config — heals a 401/403 by acquiring a fresh token, two ways:
 *  - 'login': re-POST a login request and read the token from the JSON response.
 *  - 'forge': sign a fresh JWT with a secret the scan CRACKED (Weak JWT Secret finding) —
 *             no credentials needed; this IS the exploitation of that finding.
 */
export interface AutoAuthConfig {
  mode?: 'login' | 'forge';
  // login mode
  loginUrl: string;
  body: string;
  tokenField: string;
  // forge mode
  secret?: string;      // cracked HMAC secret
  algorithm?: string;   // 'HS256' (HMAC-SHA256) — the common weak case
  claims?: string;      // JSON claims template, e.g. {"sub":"admin","role":"admin","admin":true}
}

export const DEFAULT_FORGE_CLAIMS = '{"sub":"admin","role":"admin","admin":true}';

/** True when the config can actually acquire a token (forge secret present, or login URL set). */
export function autoAuthReady(cfg?: AutoAuthConfig | null): boolean {
  if (!cfg) return false;
  if (cfg.mode === 'forge') return !!cfg.secret;
  return !!cfg.loginUrl;
}

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlStr = (s: string): string => b64url(new TextEncoder().encode(s));

/**
 * Forge a signed JWT in the browser (Web Crypto, HMAC-SHA256) using a cracked secret.
 * `exp`/`iat` are always set fresh, overriding any stale values in the claims template.
 * Returns the compact JWT, or null on failure / unsupported algorithm.
 */
export async function forgeJwt(secret: string, claims: Record<string, any>, algorithm = 'HS256'): Promise<string | null> {
  if (!secret) return null;
  const alg = (algorithm || 'HS256').toUpperCase();
  const hash = alg === 'HS512' ? 'SHA-512' : alg === 'HS384' ? 'SHA-384' : alg === 'HS256' ? 'SHA-256' : null;
  if (!hash) return null; // only HMAC family supported (RS/ES need a private key we don't have)
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg, typ: 'JWT' };
    const payload = { ...claims, iat: now, exp: now + 3600 };
    const signingInput = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(payload))}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
    return `${signingInput}.${b64url(new Uint8Array(sig))}`;
  } catch { return null; }
}

/** Acquire a fresh token per the config's mode (forge a JWT, or re-login). */
export async function acquireToken(cfg?: AutoAuthConfig | null): Promise<string | null> {
  if (!cfg) return null;
  if (cfg.mode === 'forge') {
    if (!cfg.secret) return null;
    let claims: Record<string, any> = {};
    try { claims = cfg.claims ? JSON.parse(cfg.claims) : {}; } catch { claims = {}; }
    return forgeJwt(cfg.secret, claims, cfg.algorithm || 'HS256');
  }
  return mintAuthToken(cfg);
}

/**
 * Mint a fresh auth token by replaying a login request through the curl proxy and
 * extracting a field from the JSON response. `tokenField` supports a dotted path
 * (e.g. "data.access_token"). Returns the raw token string, or null on any failure.
 * Credentials live only in the browser session — never persisted by the CLI.
 */
export async function mintAuthToken(cfg: AutoAuthConfig | null | undefined): Promise<string | null> {
  if (!cfg || !cfg.loginUrl) return null;
  let host = '';
  let pathQ = cfg.loginUrl;
  let scheme = 'https';
  try {
    const u = new URL(cfg.loginUrl);
    host = u.host; pathQ = (u.pathname || '/') + (u.search || ''); scheme = u.protocol.replace(':', '') || 'https';
  } catch { return null; }
  const body = (cfg.body || '').trim();
  const raw = `POST ${pathQ} HTTP/1.1\nHost: ${host}\nContent-Type: application/json\nAccept: */*\n\n${body}`;
  try {
    const { result } = await sendRawRequest(raw, scheme);
    const parsed = parseCurlResponse(result);
    if (parsed.status < 200 || parsed.status >= 300) return null;
    let json: any;
    try { json = JSON.parse(parsed.body); } catch { return null; }
    const field = (cfg.tokenField || 'access_token').trim();
    const tok = field.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), json);
    return typeof tok === 'string' && tok ? tok : null;
  } catch { return null; }
}

/** Set/replace a query parameter in the request line of a raw request (used by the agent's set_query_param tool). */
export function applyQueryParamToRaw(raw: string, name: string, value: string): string {
  // Use same line-ending split as applyHeaderToRaw for consistency
  const lineBreak = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(lineBreak);
  if (!lines.length) return raw;
  const seg = lines[0].split(/\s+/);
  if (seg.length >= 2) {
    seg[1] = upsertQueryParam(seg[1], name, value);
    lines[0] = seg.join(' ');
  }
  return lines.join(lineBreak);
}

/** Set/replace a header in a raw request (used by the agent's set_header tool). */
export function applyHeaderToRaw(raw: string, name: string, value: string): string {
  const parts = raw.split(/\r?\n\r?\n/);
  const headLines = (parts[0] || '').split('\n');
  const re = new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i');
  let found = false;
  for (let i = 1; i < headLines.length; i++) {
    if (re.test(headLines[i])) { headLines[i] = `${name}: ${value}`; found = true; break; }
  }
  if (!found) headLines.push(`${name}: ${value}`);
  parts[0] = headLines.join('\n');
  return parts.join('\n\n');
}

/** Split a curl -i response string into status line, headers and body for the Response pane. */
export function parseCurlResponse(result: string): ParsedResponse {
  // Skip intermediate status blocks (100 Continue, 301/302 redirects with -i).
  // The real response is the LAST status+header block before the body.
  const blocks = result.split(/\r?\n\r?\n/);
  let headIdx = 0;
  for (let i = 0; i < blocks.length - 1; i++) {
    if (/^HTTP\/[\d.]+\s+\d{3}/i.test(blocks[i].trim())) headIdx = i;
  }
  const headPart = blocks[headIdx] || '';
  const body = blocks.slice(headIdx + 1).join('\n\n');
  const headLines = headPart.split(/\r?\n/);
  const statusLine = headLines[0] || '';
  const m = statusLine.match(/(\d{3})/);
  return { statusLine, status: m ? parseInt(m[1], 10) : 0, headers: headLines.slice(1).join('\n'), body };
}
