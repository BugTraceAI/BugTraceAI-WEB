// hooks/useRepeaterAgent.ts
// The AI Repeater's brain: an agent loop whose tools operate DIRECTLY on the
// request shown in the Repeater (set_query_param / set_header / set_request_raw /
// send_request / add_task / complete_task / add_finding). It mutates the live
// request, sends it through the backend curl tool, reads the response, and (in
// Manual mode) pauses for human approval before each send. No free-form curl.
import { useState, useRef, useCallback, useEffect } from 'react';
import { ExploitSeed } from '../types.ts';
import { useApiOptions } from './useApiOptions.ts';
import { cliApi } from '../lib/cliApi';
import { callOpenRouterChatWithTools } from '../services/apiClient.ts';
import { getFinisherSystemPrompt } from '../services/systemPrompts.ts';
import {
  buildRepeaterFindingRequest,
  repeaterPersistenceKey,
  requirePersistenceSuccess,
} from '../services/repeaterPersistence.ts';
// abortCurrentRequest removed: it's a global singleton that kills ALL tabs.
// The repeater uses stoppedRef for per-tab graceful stop instead.
import {
  buildFinisherUserMessage, buildRawRequestFromSeed, sendRawRequest, parseCurlResponse,
  applyQueryParamToRaw, applyHeaderToRaw, acquireToken, autoAuthReady, DEFAULT_FORGE_CLAIMS,
  type ParsedResponse, type AutoAuthConfig,
} from '../services/finisherSeed.ts';

export interface StreamItem { id: number; kind: 'reasoning' | 'tool' | 'user'; text?: string; toolName?: string; toolDesc?: string; }
export interface RepeaterTask { title: string; status: 'running' | 'done'; }

const DEFAULT_MAX_HOPS = 24;  // default max agent tool-hops before it pauses; overridable in the AIrepeater UI (localStorage 'repeaterMaxHops')

// SINGLE-THREAD LOCK: only one Repeater agent can run at a time across all tabs.
// This eliminates all cross-tab race conditions (shared rate limiter, circuit breaker,
// provider hammering). A tab that tries to start while another is running gets rejected.
let globalRunningTabId: number | null = null;

const REPEATER_TOOLS = [
  { type: 'function', function: { name: 'set_query_param', description: 'Set or replace a query parameter in the current request. Your main mutation tool.', parameters: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } } },
  { type: 'function', function: { name: 'set_header', description: 'Set or replace a request header.', parameters: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } } },
  { type: 'function', function: { name: 'set_request_raw', description: 'Replace the entire raw HTTP request (for method or body changes).', parameters: { type: 'object', properties: { raw: { type: 'string' } }, required: ['raw'] } } },
  { type: 'function', function: { name: 'send_request', description: 'Send the current request to the target and read the response.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'add_task', description: 'Add a step to the exploitation checklist.', parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } } },
  { type: 'function', function: { name: 'complete_task', description: 'Mark a checklist step done by its exact title.', parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } } },
  { type: 'function', function: { name: 'remove_header', description: 'Remove a header from the current request by name.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'set_body', description: 'Replace the request body (everything after the blank line). Also sets Content-Type if not already present.', parameters: { type: 'object', properties: { body: { type: 'string' }, content_type: { type: 'string', description: 'Optional Content-Type (default: application/x-www-form-urlencoded)' } }, required: ['body'] } } },
  { type: 'function', function: { name: 'set_method', description: 'Change the HTTP method (GET, POST, PUT, DELETE, PATCH).', parameters: { type: 'object', properties: { method: { type: 'string' } }, required: ['method'] } } },
  { type: 'function', function: { name: 'grep_response', description: 'Search the last response body for a pattern (case-insensitive). Returns matching lines with context. Use this when the response was truncated and you need to find specific content.', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'add_finding', description: 'Record a confirmed proof-of-concept. Persists to the scan if scanId is available.', parameters: { type: 'object', properties: { type: { type: 'string', description: 'Vulnerability type, e.g. XSS, SQLI, GRAPHQL_IDOR, BROKEN_ACCESS' }, severity: { type: 'string', description: 'CRITICAL, HIGH, MEDIUM, LOW, or INFO' }, summary: { type: 'string', description: 'What was confirmed and how' }, parameter: { type: 'string', description: 'The vulnerable parameter name' }, evidence: { type: 'string', description: 'Excerpt of the confirming response' } }, required: ['type', 'severity', 'summary'] } } },
];

const schemeOf = (url: string): string => { try { return new URL(url).protocol.replace(':', '') || 'https'; } catch { return 'https'; } };

// Some models (notably deepseek-chat) emit tool calls as TEXT in `content` using their
// native template (<｜tool▁calls▁begin｜>function<｜tool▁sep｜>NAME ```json {...}```...)
// instead of the structured `tool_calls` field. Parse those out so the loop still works.
function parseLeakedToolCalls(raw: string): Array<{ id: string; function: { name: string; arguments: string } }> {
  if (!raw) return [];
  const norm = raw.replace(/[｜│|]/g, '').replace(/▁/g, '_');
  if (!/tool_call|tool_sep/i.test(norm)) return [];
  const calls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
  const re = /tool_sep>?\s*([A-Za-z_][\w]*)[\s\S]*?```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    calls.push({ id: `leaked_${calls.length}`, function: { name: m[1].trim(), arguments: (m[2] || '{}').trim() } });
  }
  if (!calls.length) {
    const re2 = /tool_sep>?\s*([A-Za-z_][\w]*)/g;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(norm)) !== null) calls.push({ id: `leaked_${calls.length}`, function: { name: m2[1].trim(), arguments: '{}' } });
  }
  return calls;
}

// localStorage key for a tab's full session (request/response/agent state). Caps keep
// it well under the ~5MB quota even with several tabs and large responses.
const tabStorageKey = (id: number | null | undefined) => (id != null ? `btai:repeater:tab:${id}` : null);

// Cap the persisted LLM history to `max` messages WITHOUT breaking tool-call pairing:
// keep the first (task) message + the tail, then drop any leading orphaned `tool`
// messages (a tool msg must follow an assistant `tool_calls` msg, which the cut may
// have removed — otherwise the next API call 400s on resume).
function capHistory(hist: any, max = 50): any[] {
  if (!Array.isArray(hist)) return [];
  if (hist.length <= max) return hist;
  let tail = hist.slice(-(max - 1));
  while (tail.length && tail[0]?.role === 'tool') tail = tail.slice(1);
  return [hist[0], ...tail];
}

export const useRepeaterAgent = (
  seed: ExploitSeed | null | undefined,
  onShowApiKeyWarning: () => void,
  tabId?: number,
) => {
  const { apiOptions, isApiKeySet, providerId } = useApiOptions();

  // PERSISTENCE: restore this tab's saved session once (synchronously) so a full page
  // refresh keeps the request, response and agent conversation. A mid-flight agent loop
  // can't be resumed (the JS context died), so it restores as "stopped" — the user
  // continues by sending a message; the full history is intact.
  const storageKey = tabStorageKey(tabId);
  const restoredRef = useRef<any>(undefined);
  if (restoredRef.current === undefined) {
    let r: any = null;
    if (storageKey) { try { const s = localStorage.getItem(storageKey); r = s ? JSON.parse(s) : null; } catch { r = null; } }
    restoredRef.current = r;
  }
  const restored = restoredRef.current;
  // MODEL SHIFTING: the Repeater uses its OWN exploitation model, independent of the
  // chat model (which may be a safety-refusing model like Gemini) — like the CLI
  // manipulator's MUTATION_MODEL. Only the model id is overridden; the provider key
  // and base_url stay the same (so on OpenRouter any served model works).
  // Default is CONFIG-DRIVEN, no hardcoded id: an effect below fills it from the scanner's MUTATION_MODEL
  // (its purpose-built, non-refusing payload model). Empty here → at call time it falls back to the chat model.
  // Tab-scoped storage keys prevent cross-tab contamination (model, hops, auth).
  const modelKey = tabId != null ? `repeaterModel:${tabId}` : 'repeaterModel';
  const hopsKey = tabId != null ? `repeaterMaxHops:${tabId}` : 'repeaterMaxHops';
  const tokenKey = tabId != null ? `repeaterLiveToken:${tabId}` : 'repeaterLiveToken';
  const authKey = tabId != null ? `repeaterAutoAuth:${tabId}` : 'repeaterAutoAuth';

  const [repeaterModel, setRepeaterModelState] = useState<string>(() => {
    try { return localStorage.getItem(modelKey) || localStorage.getItem('repeaterModel') || ''; } catch { return ''; }
  });

  // MAX ITERATIONS (tool-hops): configurable — the agent pauses after this many tool calls.
  // Was a hardcoded constant; now defaults to DEFAULT_MAX_HOPS and is overridable in the UI.
  const [maxHops, setMaxHopsState] = useState<number>(() => {
    try { const v = parseInt(localStorage.getItem(hopsKey) || localStorage.getItem('repeaterMaxHops') || '', 10); return v > 0 ? v : DEFAULT_MAX_HOPS; } catch { return DEFAULT_MAX_HOPS; }
  });

  // LIVE AUTH: captured tokens are masked on disk (`...<redacted>`). The user pastes a
  // fresh token here to actually replay authenticated requests; it lives only in this
  // browser session (sessionStorage → cleared on tab close), never sent to the CLI's disk.
  const [liveToken, setLiveTokenState] = useState<string>(() => {
    try { return sessionStorage.getItem(tokenKey) || ''; } catch { return ''; }
  });

  // AUTO-AUTH: optional login macro. When a send returns 401/403, re-login here to mint a
  // fresh token and retry automatically — so the agent stays autonomous on authenticated
  // targets instead of stopping to ask for a token. Credentials live in sessionStorage only.
  const [autoAuth, setAutoAuthState] = useState<AutoAuthConfig>(() => {
    const base: AutoAuthConfig = { mode: 'login', loginUrl: '', body: '', tokenField: 'access_token', secret: '', algorithm: 'HS256', claims: DEFAULT_FORGE_CLAIMS };
    try {
      const s = sessionStorage.getItem(authKey);
      const p = s ? JSON.parse(s) : null;
      // Keep a usable saved config (forge secret or login URL); otherwise fall through.
      if (p && (p.secret || p.loginUrl)) return { ...base, ...p };
    } catch { /* ignore */ }
    // No saved config — if the scan cracked a JWT secret (carried on the seed), default to Forge.
    if (seed?.jwtSecret) return { ...base, mode: 'forge', secret: seed.jwtSecret };
    return base;
  });

  const [request, setRequestState] = useState<string>(() => restored?.request ?? '');
  const [rawResponse, setRawResponse] = useState<string | null>(() => restored?.rawResponse ?? null);
  const [respMs, setRespMs] = useState<number | null>(() => restored?.respMs ?? null);
  const [sending, setSending] = useState(false);
  const [stream, setStream] = useState<StreamItem[]>(() => (Array.isArray(restored?.stream) ? restored.stream : []));
  const [tasks, setTasks] = useState<RepeaterTask[]>(() => (Array.isArray(restored?.tasks) ? restored.tasks : []));
  const [toolHops, setToolHops] = useState<number>(() => restored?.toolHops ?? 0);
  const [isRunning, setIsRunning] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>(() => restored?.mode ?? 'manual');

  const requestRef = useRef<string>(restored?.request ?? '');
  const schemeRef = useRef<string>(restored?.scheme ?? schemeOf(seed?.url || ''));
  const modeRef = useRef<'manual' | 'auto'>(restored?.mode ?? 'manual');
  const apiHistoryRef = useRef<any[]>(Array.isArray(restored?.apiHistory) ? restored.apiHistory : []);
  const runningRef = useRef(false);
  const stoppedRef = useRef(false);  // per-tab stop signal (doesn't kill other tabs)
  const rawResponseRef = useRef<string>('');  // full response for grep_response tool
  const approvalRef = useRef<((d: 'approve' | 'cancel') => void) | null>(null);
  const idRef = useRef<number>(restored?.lastId ?? 0);
  // If we restored a session, mark the current seed as already-applied so the seed
  // effect below doesn't rebuild the request and wipe the restored state.
  const lastSeedRef = useRef<ExploitSeed | null>(restored ? (seed ?? null) : null);
  const apiOptionsRef = useRef(apiOptions);
  const providerIdRef = useRef(providerId);
  const repeaterModelRef = useRef(repeaterModel);
  const maxHopsRef = useRef(maxHops);
  const vulnTypeRef = useRef(seed?.vulnType);
  const liveTokenRef = useRef(liveToken);
  const autoAuthRef = useRef(autoAuth);
  const seedRef = useRef(seed);
  const lastParsedRef = useRef<ParsedResponse | null>(null);
  const persistedKeysRef = useRef<Set<string>>(new Set());
  const lastSentRequestRef = useRef<string>('');
  const lastOkRef = useRef<boolean>(false);

  useEffect(() => { apiOptionsRef.current = apiOptions; }, [apiOptions]);
  useEffect(() => { providerIdRef.current = providerId; }, [providerId]);
  useEffect(() => { repeaterModelRef.current = repeaterModel; }, [repeaterModel]);
  useEffect(() => { maxHopsRef.current = maxHops; }, [maxHops]);
  useEffect(() => { liveTokenRef.current = liveToken; }, [liveToken]);
  useEffect(() => { autoAuthRef.current = autoAuth; }, [autoAuth]);
  useEffect(() => { seedRef.current = seed; }, [seed]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // DEFAULT EXPLOIT MODEL (config-driven, no hardcode): if the operator hasn't chosen one, adopt the
  // scanner's MUTATION_MODEL — the model the CLI already uses for payload mutation (capable, non-refusing).
  // Not persisted, so it stays in sync with the scanner config; falls back to the chat model if unavailable.
  useEffect(() => {
    if (repeaterModelRef.current) return;   // operator already has a saved/chosen exploit model
    // MUTATION_MODEL is an OpenRouter slug (e.g. "moonshotai/kimi-k3"); only adopt it when
    // OpenRouter is the active provider. On Anthropic/Z.ai it isn't servable, and the
    // call-time fallback to the provider-correct chat model handles those.
    if (providerIdRef.current !== 'openrouter') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await cliApi.getConfig();
        const mm = ((res?.config as Record<string, any>)?.MUTATION_MODEL || '').toString().trim();
        if (!cancelled && mm && !repeaterModelRef.current) { repeaterModelRef.current = mm; setRepeaterModelState(mm); }
      } catch { /* offline / no config — call-time fallback to the chat model handles it */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist this tab's session to localStorage (debounced) so it survives a refresh.
  // Caps bound the footprint: response trimmed to last 50KB, stream to 150 items, the
  // LLM history to 50 messages (keeping the system prompt so the agent can continue).
  useEffect(() => {
    if (!storageKey) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          request: requestRef.current,
          rawResponse: rawResponse ? rawResponse.slice(-50_000) : null,
          respMs,
          stream: stream.slice(-150),
          tasks,
          toolHops,
          mode,
          scheme: schemeRef.current,
          apiHistory: capHistory(apiHistoryRef.current),
          lastId: idRef.current,
        }));
      } catch { /* quota exceeded or unserializable — skip this write */ }
    }, 400);
    return () => clearTimeout(t);
  }, [storageKey, request, rawResponse, respMs, stream, tasks, toolHops, mode]);

  const setRepeaterModel = useCallback((m: string) => {
    setRepeaterModelState(m);
    try { localStorage.setItem(modelKey, m); } catch { /* ignore */ }
  }, [modelKey]);

  const setMaxHops = useCallback((n: number) => {
    const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_HOPS;
    setMaxHopsState(v);
    try { localStorage.setItem(hopsKey, String(v)); } catch { /* ignore */ }
  }, [hopsKey]);

  const setLiveToken = useCallback((t: string) => {
    setLiveTokenState(t);
    liveTokenRef.current = t;
    try { sessionStorage.setItem(tokenKey, t); } catch { /* ignore */ }
  }, [tokenKey]);

  const setAutoAuth = useCallback((cfg: AutoAuthConfig) => {
    setAutoAuthState(cfg);
    autoAuthRef.current = cfg;
    try { sessionStorage.setItem(authKey, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [authKey]);

  const nextId = () => (idRef.current += 1);
  const pushReasoning = useCallback((text: string) => setStream((s) => [...s, { id: nextId(), kind: 'reasoning', text }]), []);
  const pushUser = useCallback((text: string) => setStream((s) => [...s, { id: nextId(), kind: 'user', text }]), []);
  const pushTool = useCallback((toolName: string, toolDesc: string) => setStream((s) => [...s, { id: nextId(), kind: 'tool', toolName, toolDesc }]), []);

  const setRequest = useCallback((v: string) => { requestRef.current = v; lastParsedRef.current = null; lastSentRequestRef.current = ''; lastOkRef.current = false; setRequestState(v); }, []);
  const updateRequest = useCallback((fn: (prev: string) => string) => {
    setRequestState((prev) => { const next = fn(prev); requestRef.current = next; lastParsedRef.current = null; lastSentRequestRef.current = ''; lastOkRef.current = false; return next; });
  }, []);

  // Load the request into the repeater when a finding is sent here.
  useEffect(() => {
    if (seed && seed !== lastSeedRef.current) {
      lastSeedRef.current = seed;
      vulnTypeRef.current = seed.vulnType;
      const raw = buildRawRequestFromSeed(seed);
      requestRef.current = raw; setRequestState(raw);
      schemeRef.current = schemeOf(seed.url);
      setRawResponse(null); setRespMs(null);
      setStream([]); setTasks([]); setToolHops(0); setIsRunning(false); setPendingApproval(false);
      apiHistoryRef.current = []; runningRef.current = false; approvalRef.current = null;
      lastParsedRef.current = null; lastSentRequestRef.current = ''; lastOkRef.current = false;
      setMode('manual'); modeRef.current = 'manual';
    }
  }, [seed]);

  const doSend = useCallback(async (): Promise<ParsedResponse> => {
    const sentRequest = requestRef.current;
    lastParsedRef.current = null;
    lastSentRequestRef.current = '';
    lastOkRef.current = false;
    let { result, ok, ms } = await sendRawRequest(sentRequest, schemeRef.current, liveTokenRef.current);
    let parsed = parseCurlResponse(result);
    if ((parsed.status === 401 || parsed.status === 403) && autoAuthReady(autoAuthRef.current)) {
      const tok = await acquireToken(autoAuthRef.current);
      if (tok) {
        setLiveToken(tok);
        const retry = await sendRawRequest(sentRequest, schemeRef.current, tok);
        result = retry.result; ok = retry.ok; ms = retry.ms; parsed = parseCurlResponse(result);
      }
    }
    setRawResponse(result); setRespMs(ms);
    rawResponseRef.current = result;
    const validStatus = parsed.status >= 100 && parsed.status <= 599;
    if (ok && validStatus) {
      lastParsedRef.current = parsed;
      lastSentRequestRef.current = sentRequest;
      lastOkRef.current = true;
    }
    return parsed;
  }, [setLiveToken]);

  // Manual "Send" button (human-driven, independent of the agent)
  const sendNow = useCallback(async () => {
    if (!requestRef.current.trim() || sending) return;
    setSending(true);
    try { await doSend(); }
    catch (e) { setRawResponse(`---- [send error] ----\n${e instanceof Error ? e.message : String(e)}`); setRespMs(null); }
    finally { setSending(false); }
  }, [doSend, sending]);

  const approve = useCallback(() => { setPendingApproval(false); const r = approvalRef.current; approvalRef.current = null; r?.('approve'); }, []);
  const rejectSend = useCallback(() => { setPendingApproval(false); const r = approvalRef.current; approvalRef.current = null; r?.('cancel'); }, []);
  const requestApproval = () => new Promise<'approve' | 'cancel'>((res) => { approvalRef.current = res; setPendingApproval(true); });

  const addTask = useCallback((title: string) => setTasks((t) => (t.some((x) => x.title === title) ? t : [...t, { title, status: 'running' as const }])), []);
  const completeTask = useCallback((title: string) => setTasks((t) => t.map((x) => (x.title === title ? { ...x, status: 'done' as const } : x))), []);

  const dispatchTool = useCallback(async (tc: any): Promise<string> => {
    const name = tc.function?.name;
    let args: any = {};
    try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* tolerate bad json */ }
    switch (name) {
      case 'set_query_param':
        pushTool('set_query_param', `Set ${args.name} → ${args.value}`);
        updateRequest((r) => applyQueryParamToRaw(r, String(args.name), String(args.value)));
        return `Request updated: ${args.name}=${args.value}. Call send_request to test it.`;
      case 'set_header':
        pushTool('set_header', `Set header ${args.name}`);
        updateRequest((r) => applyHeaderToRaw(r, String(args.name), String(args.value)));
        return `Header ${args.name} set.`;
      case 'set_request_raw':
        pushTool('set_request_raw', 'Replaced raw request');
        setRequest(String(args.raw || ''));
        return 'Raw request replaced.';
      case 'send_request': {
        pushTool('send_request', 'Send current request');
        if (modeRef.current === 'manual') {
          const decision = await requestApproval();
          if (decision === 'cancel') return 'The user chose to edit the request manually instead of sending. Stop and wait for the user to message you.';
        }
        try {
          const parsed = await doSend();
          const ok = lastOkRef.current;
          return `Response: HTTP ${parsed.status} (${ok ? 'OK' : 'FAILED'})\n${parsed.headers.slice(0, 500)}\n\n${parsed.body.slice(0, 4000)}`;
        } catch (e) { return `send_request failed: ${e instanceof Error ? e.message : String(e)}`; }
      }
      case 'remove_header':
        pushTool('remove_header', `Remove header ${args.name}`);
        updateRequest((r) => {
          const parts = r.split(/\r?\n\r?\n/);
          const headLines = (parts[0] || '').split('\n');
          const re = new RegExp(`^\\s*${String(args.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'i');
          parts[0] = headLines.filter((l: string, i: number) => i === 0 || !re.test(l)).join('\n');
          return parts.join('\n\n');
        });
        return `Header ${args.name} removed.`;
      case 'set_body':
        pushTool('set_body', 'Set request body');
        updateRequest((r) => {
          const parts = r.split(/\r?\n\r?\n/);
          let head = parts[0] || '';
          const ct = args.content_type || 'application/x-www-form-urlencoded';
          if (!head.toLowerCase().includes('content-type:')) head += `\n Content-Type: ${ct}`;
          return `${head}\n\n${String(args.body)}`;
        });
        return 'Request body set.';
      case 'set_method':
        pushTool('set_method', `Method → ${args.method}`);
        updateRequest((r) => {
          const lines = r.split('\n');
          if (lines.length) {
            const seg = lines[0].split(/\s+/);
            seg[0] = String(args.method).toUpperCase();
            lines[0] = seg.join(' ');
          }
          return lines.join('\n');
        });
        return `Method changed to ${args.method}.`;
      case 'grep_response': {
        pushTool('grep_response', `Search: ${args.pattern}`);
        const resp = rawResponseRef.current || '';
        const re = new RegExp(String(args.pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const lines = resp.split('\n');
        const matches: string[] = [];
        lines.forEach((line: string, i: number) => {
          if (re.test(line)) {
            const ctx = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
            matches.push(`L${i + 1}: ${ctx}`);
          }
        });
        return matches.length ? `Found ${matches.length} match(es):\n${matches.slice(0, 10).join('\n---\n')}` : 'No matches found.';
      }
      case 'add_task': pushTool('add_task', args.title); addTask(String(args.title)); return `Task added: ${args.title}`;
      case 'complete_task': completeTask(String(args.title)); return `Task completed: ${args.title}`;
      case 'add_finding': {
        pushTool('add_finding', args.summary);
        const currentSeed = seedRef.current;
        const scanId = currentSeed?.scanId;
        if (!scanId || !Number.isFinite(scanId)) {
          pushReasoning(`Finding saved to session only (no scan ID). Summary: ${args.summary}`);
          return 'Finding recorded in this session (no scan ID attached — it will not persist permanently).';
        }
        try {
          const payload = buildRepeaterFindingRequest({
            rawRequest: lastSentRequestRef.current,
            currentRequest: requestRef.current,
            parsed: lastParsedRef.current,
            transportOk: lastOkRef.current,
            scheme: schemeRef.current,
            type: args.type || vulnTypeRef.current || 'UNKNOWN',
            severity: args.severity || 'MEDIUM',
            parameter: args.parameter || currentSeed?.parameter,
            summary: args.summary,
            sourceFindingId: currentSeed?.findingId,
          });
          const dupKey = repeaterPersistenceKey(scanId, payload);
          if (persistedKeysRef.current.has(dupKey)) {
            return 'Finding already persisted for this scan — skipped duplicate.';
          }
          const res = await cliApi.createRepeaterFinding(scanId, payload);
          requirePersistenceSuccess(res);
          persistedKeysRef.current.add(dupKey);
          pushReasoning(`Persisted: ${args.summary} (finding #${res.finding_id}, ${res.created ? 'created' : 'updated'})`);
          return `Finding persisted (finding_id=${res.finding_id}, ${res.created ? 'created' : 'updated'}).`;
        } catch (e) {
          const msg = `Failed to persist finding: ${e instanceof Error ? e.message : String(e)}`;
          pushReasoning(`Failed to persist: ${args.summary} — ${msg}`);
          return msg;
        }
      }
      default: return `Unknown tool: ${name}`;
    }
  }, [pushTool, pushReasoning, updateRequest, setRequest, doSend, addTask, completeTask]);

  const runConversation = useCallback(async (userContent: string) => {
    if (runningRef.current) return;
    // Single-thread: reject if another tab's agent is already running
    if (globalRunningTabId !== null && globalRunningTabId !== tabId) {
      pushReasoning(`⏳ Another tab (#${globalRunningTabId}) is running. Wait for it to finish or stop it first.`);
      return;
    }
    const opts = apiOptionsRef.current;
    if (!opts) { onShowApiKeyWarning(); return; }
    globalRunningTabId = tabId ?? null;
    runningRef.current = true; stoppedRef.current = false; setIsRunning(true);
    const history: any[] = [{ role: 'system', content: getFinisherSystemPrompt(vulnTypeRef.current) }, ...apiHistoryRef.current, { role: 'user', content: userContent }];
    let hops = 0; let keep = true;
    try {
      while (keep && !stoppedRef.current) {
        // Provider-guard the exploit model: a repeater model chosen/adopted while on
        // OpenRouter is a "vendor/model" slug that Anthropic/Z.ai can't serve. OpenRouter
        // ids contain "/"; provider-native ids don't. Keep the repeater model only when it
        // matches the active provider's shape, else fall back to the provider-correct chat
        // model (opts.model). Prevents a 404 on non-OpenRouter providers (and after a switch).
        const candidateModel = (repeaterModelRef.current || '').trim();
        const providerIsOpenRouter = providerIdRef.current === 'openrouter';
        const modelValidForProvider = !!candidateModel &&
          (providerIsOpenRouter ? candidateModel.includes('/') : !candidateModel.includes('/'));
        const callOpts = { ...opts, model: modelValidForProvider ? candidateModel : opts.model };
        const msg: any = await callOpenRouterChatWithTools(history, REPEATER_TOOLS, callOpts);
        const rawContent: string = msg?.content || '';
        const structured = (msg?.tool_calls && msg.tool_calls.length) ? msg.tool_calls : null;

        if (structured) {
          if (rawContent) pushReasoning(rawContent);
          history.push({ role: 'assistant', content: msg.content || null, tool_calls: structured });
          for (const tc of structured) {
            const result = await dispatchTool(tc);
            history.push({ role: 'tool', name: tc.function?.name, tool_call_id: tc.id, content: result });
          }
          hops++; setToolHops((h) => h + 1);
          if (hops >= maxHopsRef.current) { pushReasoning('— Reached max tool hops. Message me to continue. —'); keep = false; }
        } else {
          // Fallback: model leaked tool calls as text (deepseek-style). Parse + execute,
          // then feed results back as plain text so it keeps iterating.
          const leaked = parseLeakedToolCalls(rawContent);
          if (leaked.length) {
            history.push({ role: 'assistant', content: rawContent });
            const results: string[] = [];
            for (const tc of leaked) {
              const r = await dispatchTool(tc);
              results.push(`${tc.function.name} -> ${r}`);
            }
            history.push({ role: 'user', content: `Tool results:\n${results.join('\n\n')}\n\nContinue: issue the next tool call, or give your final conclusion — call add_finding on success, write "MANUAL_REVIEW: <what's needed to confirm>" if it's real but unconfirmable non-destructively (blind / needs OOB or a browser), or "FALSE POSITIVE: <reason>" only if the evidence shows no vuln.` });
            hops++; setToolHops((h) => h + 1);
            if (hops >= maxHopsRef.current) { pushReasoning('— Reached max tool hops. Message me to continue. —'); keep = false; }
          } else {
            if (rawContent) pushReasoning(rawContent);
            history.push({ role: 'assistant', content: rawContent });
            keep = false;
          }
        }
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m !== 'Request cancelled.') pushReasoning(`Error: ${m}`);
    } finally {
      apiHistoryRef.current = history.slice(1);
      globalRunningTabId = null;  // release single-thread lock
      runningRef.current = false; setIsRunning(false);
    }
  }, [onShowApiKeyWarning, pushReasoning, dispatchTool]);

  const start = useCallback(() => {
    if (!seed || runningRef.current) return;
    if (!isApiKeySet) { onShowApiKeyWarning(); return; }
    pushUser(`▶ Finish exploiting the ${seed.vulnType} loaded in the repeater.`);
    runConversation(buildFinisherUserMessage(seed));
  }, [seed, isApiKeySet, onShowApiKeyWarning, pushUser, runConversation]);

  // Autonomous run: switch to Auto (no per-send approval) and iterate to a conclusion.
  const runAuto = useCallback(() => {
    modeRef.current = 'auto'; setMode('auto');
    if (!runningRef.current) start();
  }, [start]);

  const sendUserMessage = useCallback((text: string) => {
    if (!text.trim() || runningRef.current) return;
    if (!isApiKeySet) { onShowApiKeyWarning(); return; }
    pushUser(text);
    runConversation(text);
  }, [isApiKeySet, onShowApiKeyWarning, pushUser, runConversation]);

  const stop = useCallback(() => {
    stoppedRef.current = true;  // signal the loop to exit after current call completes (per-tab only)
    if (approvalRef.current) rejectSend();
    // NOTE: we intentionally do NOT call abortCurrentRequest() here — that's a global
    // singleton that would kill ALL tabs' in-flight LLM requests. The loop will exit
    // gracefully after the current call returns (stoppedRef check in the while condition).
  }, [rejectSend]);

  return {
    request, setRequest,
    rawResponse, respMs, sending, sendNow,
    stream, tasks, toolHops, maxHops, setMaxHops, isRunning, pendingApproval,
    mode, setMode,
    start, runAuto, approve, rejectSend, sendUserMessage, stop,
    repeaterModel, setRepeaterModel,
    liveToken, setLiveToken,
    autoAuth, setAutoAuth,
  };
};
