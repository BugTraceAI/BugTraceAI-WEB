// components/RepeaterPane.tsx
// One AI Repeater SESSION — Burp-style 3-pane repeater DRIVEN BY THE AGENT.
//   Request (editable, pre-loaded & mutated by the agent) | Response | AI Agent drawer
//   (reasoning + tool-call cards + Tasks checklist + Approve/Edit + hops).
// One <RepeaterPane> per open tab (FinisherAssistant renders & multiplexes them);
// each owns an independent useRepeaterAgent so tabs never share request/response/agent state.
import React, { useState, useEffect, useRef } from 'react';
import { ExploitSeed } from '../types.ts';
import { ArrowPathIcon, PaperAirplaneIcon, AiBrainIcon, CogIcon } from './Icons.tsx';
import { useRepeaterAgent, type StreamItem } from '../hooks/useRepeaterAgent.ts';
import { parseCurlResponse, autoAuthReady, acquireToken } from '../services/finisherSeed.ts';
import { CURATED_MODEL_IDS, curatedModelName } from '../lib/curatedModels.ts';
import { useSettings } from '../contexts/SettingsProvider.tsx';
import { WEB_PROVIDER_CONFIGS } from '../lib/providers.ts';
import { HttpEditor } from './HttpEditor.tsx';

const prettyBody = (body: string, headers: string): string => {
  if (/content-type:\s*application\/json/i.test(headers)) {
    try { return JSON.stringify(JSON.parse(body), null, 2); } catch { /* not json */ }
  }
  return body;
};

interface RepeaterPaneProps {
  seed?: ExploitSeed | null;
  onShowApiKeyWarning: () => void;
  tabId?: number;
}

export const RepeaterPane: React.FC<RepeaterPaneProps> = ({ seed, onShowApiKeyWarning, tabId }) => {
  const a = useRepeaterAgent(seed, onShowApiKeyWarning, tabId);

  // The Repeater reuses the ACTIVE provider's key + base_url (only the model id is overridden),
  // so the model must be valid for that provider — OpenRouter → the curated pack; any other
  // provider (Anthropic, Z.ai, …) → that provider's own model list.
  const { providerId } = useSettings();
  const modelOptions = providerId === 'openrouter'
    ? CURATED_MODEL_IDS
    : (WEB_PROVIDER_CONFIGS[providerId]?.models ?? CURATED_MODEL_IDS);

  const [reqTab, setReqTab] = useState<'raw' | 'params' | 'headers'>('raw');
  const [respTab, setRespTab] = useState<'pretty' | 'raw' | 'headers'>('pretty');
  const [agentInput, setAgentInput] = useState('');
  const [showAutoAuth, setShowAutoAuth] = useState(false);
  // Dry-run state for the auto-auth macro — lets the operator confirm the login/forge actually
  // yields a token BEFORE relying on it to heal a 401 (previously it was only exercised lazily
  // on a real 401, and a bad login/tokenField failed silently).
  const [authTest, setAuthTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'bad'; detail?: string }>({ status: 'idle' });
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [a.stream, a.pendingApproval, a.isRunning]);

  // Derived top-bar request line
  const lines = a.request.split('\n');
  const seg = (lines[0] || '').split(/\s+/);
  const hostLine = lines.find((l) => /^host:/i.test(l)) || '';
  const host = hostLine.replace(/^host:\s*/i, '').trim();
  const method = seg[0] || 'GET';
  const target = host ? `${host}${seg[1] || ''}` : (seg[1] || '');

  const parsed = a.rawResponse ? parseCurlResponse(a.rawResponse) : null;
  const respBytes = a.rawResponse ? new Blob([a.rawResponse]).size : 0;
  const statusColor = parsed
    ? parsed.status >= 500 ? 'text-red-400' : parsed.status >= 400 ? 'text-amber-400' : 'text-emerald-400'
    : 'text-muted';

  const handleMode = (m: 'manual' | 'auto') => {
    if (m === 'auto') a.runAuto();
    else a.setMode('manual');
  };
  const handleAgentSend = () => { if (!agentInput.trim() || a.isRunning) return; a.sendUserMessage(agentInput); setAgentInput(''); };

  const tabCls = (active: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-md cursor-pointer transition-colors ${active ? 'bg-purple-accent/20 text-purple-300 font-semibold' : 'text-muted hover:text-white'}`;

  const renderStreamItem = (it: StreamItem) => {
    if (it.kind === 'tool') {
      return (
        <div key={it.id} className="bg-purple-accent/10 border border-purple-accent/25 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-purple-300 mb-0.5">
            <CogIcon className="h-3 w-3" /> {it.toolName}
          </div>
          <div className="text-[12px] text-white/85 font-mono break-words">{it.toolDesc}</div>
        </div>
      );
    }
    if (it.kind === 'user') {
      return <div key={it.id} className="bg-coral/10 border border-coral/20 rounded-xl px-3 py-2 text-[12.5px] text-white/90 break-words">{it.text}</div>;
    }
    return <div key={it.id} className="bg-purple-light/20 border border-glass-border/40 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed text-white/90 whitespace-pre-wrap break-words">{it.text}</div>;
  };

  return (
    <div className="h-full flex flex-col bg-dashboard-bg/40">
      {/* ── Top bar (per session) ─────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-glass-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral/20 to-purple-accent/20 border border-glass-border flex items-center justify-center">
          <ArrowPathIcon className="h-5 w-5 text-coral" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-white tracking-tight leading-none">AIrepeater</h2>
          <p className="text-[11px] text-muted truncate">Mutate · resend · analyze — AI-guided exploitation, human in control</p>
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2 bg-purple-medium/50 border border-glass-border rounded-xl px-3 py-2 max-w-[440px] min-w-[260px]">
          <span className="text-emerald-400 font-mono font-bold text-xs">{method}</span>
          <span className="text-white font-mono text-xs truncate">{target}</span>
        </div>
        <div className="flex items-center gap-1 bg-purple-medium/50 border border-glass-border rounded-full p-1">
          {(['manual', 'auto'] as const).map((m) => (
            <button key={m} onClick={() => handleMode(m)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full capitalize transition-colors ${a.mode === m ? 'bg-gradient-to-r from-purple-accent to-purple-accent-hover text-white' : 'text-muted hover:text-white'}`}>{m}</button>
          ))}
        </div>
        <button onClick={a.sendNow} disabled={a.sending || !a.request.trim()} className="h-10 px-5 rounded-xl font-bold text-sm text-white bg-coral hover:bg-coral-hover shadow-glow-coral disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {a.sending ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <PaperAirplaneIcon className="h-4 w-4" />}
          Send
        </button>
      </div>

      {/* ── 3-pane grid ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1fr_390px] gap-3 p-3">
        {/* Request */}
        <div className="flex flex-col min-h-0 bg-purple-medium/30 border border-glass-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-glass-border/60">
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-gray">Request</span>
            <div className="flex gap-1"><span className={tabCls(true)}>Raw</span></div>
          </div>
          <HttpEditor value={a.request} onChange={a.setRequest} />
          <div className="flex items-center gap-3 px-4 py-2 border-t border-glass-border/60 text-[11px] font-mono text-muted">
            <span>Request</span><span className="text-coral">{new Blob([a.request]).size} bytes</span>
          </div>
        </div>

        {/* Response */}
        <div className="flex flex-col min-h-0 bg-purple-medium/30 border border-glass-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-glass-border/60">
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-gray">Response</span>
            <div className="flex gap-1">{(['pretty', 'raw', 'headers'] as const).map((t) => <span key={t} onClick={() => setRespTab(t)} className={tabCls(respTab === t)}>{t[0].toUpperCase() + t.slice(1)}</span>)}</div>
          </div>
          {/* HttpEditor is ALWAYS mounted so the Burp-style search bar stays pinned at the
              bottom even before a response exists; the hint floats over the empty surface. */}
          <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
            <HttpEditor
              readOnly
              isResponse
              bottomFind
              value={!parsed ? '' : respTab === 'headers' ? `${parsed.statusLine}\n${parsed.headers}` : respTab === 'raw' ? (a.rawResponse || '') : `${parsed.statusLine}\n${prettyBody(parsed.body, parsed.headers)}`}
            />
            {!parsed && (
              <div className="absolute inset-x-0 top-0 bottom-10 flex items-center justify-center text-center text-muted text-sm px-4 pointer-events-none">
                {a.sending ? 'Sending…' : 'Send the request (or let the agent) to see the response.'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-2 border-t border-glass-border/60 text-[11px] font-mono text-muted">
            {parsed && <span className={`${statusColor} font-bold`}>{parsed.status}</span>}
            <span className="text-coral">{respBytes ? `${respBytes} bytes` : '—'}</span>
            {a.respMs != null && <><span>·</span><span>{a.respMs} ms</span></>}
          </div>
        </div>

        {/* AI Agent drawer */}
        <div className="flex flex-col min-h-0 bg-purple-medium/30 border border-glass-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-glass-border/60 bg-gradient-to-b from-purple-accent/10 to-transparent">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-accent to-coral flex items-center justify-center"><AiBrainIcon className="h-3.5 w-3.5 text-white" /></span>
              AI Agent
              {seed?.vulnType && <span className="text-[9px] font-bold uppercase tracking-wide text-purple-300 bg-purple-accent/15 border border-purple-accent/25 px-2 py-0.5 rounded-full">{seed.vulnType}</span>}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${a.mode === 'auto' ? 'bg-gradient-to-r from-purple-accent to-purple-accent-hover text-white' : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'}`}>{a.mode}</span>
          </div>

          {/* Reasoning + tool stream */}
          <div ref={streamRef} className="flex-1 min-h-0 overflow-auto px-3 py-3 space-y-2.5">
            {a.stream.length === 0 ? (
              <div className="text-center px-2 py-6">
                <p className="text-sm text-purple-gray mb-1">{seed ? `Finishing ${seed.vulnType} on the loaded request.` : 'Load a finding or paste a request.'}</p>
                <p className="text-xs text-muted mb-4">The agent mutates the request, re-sends and reads the response to confirm exploitation.</p>
                {seed && (
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={a.runAuto} className="text-xs font-bold px-4 py-2 rounded-xl bg-coral text-white hover:bg-coral-hover shadow-glow-coral">▶ Let the agent take over (Auto)</button>
                    <button onClick={a.start} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-purple-accent/15 border border-purple-accent/30 text-purple-200 hover:bg-purple-accent/25">Step-by-step (Manual)</button>
                  </div>
                )}
              </div>
            ) : a.stream.map(renderStreamItem)}

            {a.pendingApproval && (
              <div className="bg-purple-light/20 border border-glass-border/40 rounded-xl px-3 py-2.5">
                <p className="text-[11px] text-purple-gray mb-2">The agent wants to send the current request. Approve, or edit it yourself first.</p>
                <div className="flex gap-2">
                  <button onClick={a.approve} className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-emerald-950">✓ Approve &amp; send</button>
                  <button onClick={a.rejectSend} className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-purple-medium/60 border border-glass-border text-purple-gray hover:text-white">✎ Edit mutation</button>
                </div>
              </div>
            )}
            {a.isRunning && !a.pendingApproval && <div className="text-xs text-purple-gray animate-pulse px-1">Thinking…</div>}
          </div>

          {/* hops (iterations) + exploit model — BOTH configurable, with hover help on where each comes from */}
          <div className="px-4 py-1.5 flex items-center gap-2 text-[10px] font-mono text-muted/80 border-t border-glass-border/40">
            <span className="flex-none" title="Agent iterations (tool-hops): the agent pauses after 'max' hops and you message it to continue.">hops: {a.toolHops}/</span>
            <input
              type="number"
              min={1}
              value={a.maxHops}
              onChange={(e) => a.setMaxHops(parseInt(e.target.value, 10))}
              title="Max iterations (tool-hops) before the agent pauses for you. Change it here — saved in this browser only (localStorage 'repeaterMaxHops'); default 24."
              className="flex-none w-11 bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5"
            />
            <span className="flex-none">· model:</span>
            <select
              value={a.repeaterModel}
              onChange={(e) => a.setRepeaterModel(e.target.value)}
              title="Exploit model — independent of the chat model and always thinking-free (curated pack). The default comes from the scanner's MUTATION_MODEL; pick a curated model here to override for this session, or '(scanner / chat fallback)' to defer to it."
              className="flex-1 min-w-0 bg-glass-bg border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5"
            >
              <option value="">(scanner MUTATION_MODEL · chat fallback)</option>
              {/* Preserve a chosen model that's outside the curated list (e.g. the scanner's
                  MUTATION_MODEL) — but ONLY when it's servable by the active provider. An
                  OpenRouter slug ("vendor/model") isn't shown on Anthropic/Z.ai; the select
                  then falls to the empty "chat fallback" option, matching what's actually sent. */}
              {a.repeaterModel && !modelOptions.includes(a.repeaterModel) &&
                (providerId === 'openrouter' ? a.repeaterModel.includes('/') : !a.repeaterModel.includes('/')) && (
                <option value={a.repeaterModel}>{a.repeaterModel} (scanner)</option>
              )}
              {modelOptions.map((id) => (
                <option key={id} value={id}>{curatedModelName(id)}</option>
              ))}
            </select>
          </div>

          {/* live auth token — replaces the masked `...<redacted>` header at send time.
              Stays in this browser session only; never persisted by the CLI. */}
          <div className="px-4 py-1.5 flex items-center gap-2 text-[10px] font-mono text-muted/80 border-t border-glass-border/40">
            <span className="flex-none" title="The scanner masks captured tokens on disk. Paste a fresh token to replay authenticated requests — session only.">
              · live auth:
            </span>
            <input
              type="password"
              value={a.liveToken}
              onChange={(e) => a.setLiveToken(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="paste Bearer/JWT to replace <redacted> — session only"
              title="Live auth token — replaces the masked Authorization header when sending. Stored only in this browser session (cleared on tab close), never sent to the CLI's disk."
              className="flex-1 min-w-0 bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5 placeholder:text-muted/40"
            />
            <span className={`flex-none ${a.liveToken ? 'text-emerald-400' : 'text-muted/40'}`} title={a.liveToken ? 'A live token is set and will be injected on send.' : 'No live token — redacted auth will 401.'}>
              {a.liveToken ? '● live' : '○ masked'}
            </span>
          </div>

          {/* auto-auth — heal a 401/403 automatically: FORGE a JWT with a scan-cracked secret
              (no credentials), or re-LOGIN. Acquired token is injected and the send retried.
              Secret/credentials live in this browser session only. */}
          <div className="px-4 py-1.5 text-[10px] font-mono text-muted/80 border-t border-glass-border/40">
            <button type="button" onClick={() => setShowAutoAuth((v) => !v)} className="flex items-center gap-1.5 hover:text-white">
              <span className="text-muted/60">{showAutoAuth ? '▾' : '▸'}</span>
              <span>· auto-auth</span>
              <span className={autoAuthReady(a.autoAuth) ? 'text-emerald-400' : 'text-muted/40'}>{autoAuthReady(a.autoAuth) ? '● on' : '○ off'}</span>
              <span className="text-muted/40">— heal 401/403</span>
              <span
                role="img"
                aria-label="auto-auth help"
                onClick={(e) => e.stopPropagation()}
                className="ml-0.5 grid place-items-center w-3.5 h-3.5 rounded-full border border-muted/40 text-muted/60 text-[8px] leading-none cursor-help hover:text-coral hover:border-coral"
                title={
                  'Heals a 401/403 automatically and retries the send.\n\n' +
                  '• Forge JWT — signs a fresh JWT in your browser with an HS256 secret the scan CRACKED (auto-filled if a "Weak JWT Secret" finding exists) plus your claims, e.g. {"sub":"admin","role":"admin"}.\n' +
                  '• Login — POSTs credentials to a login URL and reads the token back from the response field (default: access_token).\n\n' +
                  'The acquired token replaces the masked Authorization header and the request is re-sent. The raw captured token is masked on disk by design, so it cannot be auto-loaded — paste one in "live auth" or use a mode above. Secrets stay in this browser session only.'
                }
              >
                ℹ
              </span>
            </button>
            {showAutoAuth && (
              <div className="mt-1.5 pl-3 space-y-1.5">
                <div className="flex items-center gap-1 bg-purple-medium/40 border border-glass-border rounded-full p-0.5 w-fit">
                  {(['forge', 'login'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => a.setAutoAuth({ ...a.autoAuth, mode: m })}
                      className={`px-2.5 py-0.5 rounded-full transition-colors ${(a.autoAuth.mode || 'login') === m ? 'bg-coral text-white' : 'text-muted hover:text-white'}`}
                    >
                      {m === 'forge' ? 'Forge JWT' : 'Login'}
                    </button>
                  ))}
                </div>
                {(a.autoAuth.mode || 'login') === 'forge' ? (
                  <>
                    <input
                      value={a.autoAuth.secret || ''}
                      onChange={(e) => a.setAutoAuth({ ...a.autoAuth, secret: e.target.value })}
                      spellCheck={false}
                      placeholder="cracked HS256 secret (auto-filled from scan if found)"
                      className="w-full bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5 placeholder:text-muted/40"
                    />
                    <input
                      value={a.autoAuth.claims || ''}
                      onChange={(e) => a.setAutoAuth({ ...a.autoAuth, claims: e.target.value })}
                      spellCheck={false}
                      placeholder={'claims JSON — {"sub":"admin","role":"admin"}'}
                      className="w-full bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5 placeholder:text-muted/40"
                    />
                    <p className="text-[9px] text-muted/40">exp is set fresh on each forge · HS256/384/512</p>
                  </>
                ) : (
                  <>
                    <input
                      value={a.autoAuth.loginUrl}
                      onChange={(e) => a.setAutoAuth({ ...a.autoAuth, loginUrl: e.target.value })}
                      spellCheck={false}
                      placeholder="login URL — https://host/api/auth/login"
                      className="w-full bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5 placeholder:text-muted/40"
                    />
                    <input
                      value={a.autoAuth.body}
                      onChange={(e) => a.setAutoAuth({ ...a.autoAuth, body: e.target.value })}
                      spellCheck={false}
                      placeholder={'login body JSON — {"username":"admin","password":"admin123"}'}
                      className="w-full bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5 placeholder:text-muted/40"
                    />
                    <div className="flex items-center gap-2">
                      <span className="flex-none text-muted/60">token field:</span>
                      <input
                        value={a.autoAuth.tokenField}
                        onChange={(e) => a.setAutoAuth({ ...a.autoAuth, tokenField: e.target.value })}
                        spellCheck={false}
                        placeholder="access_token"
                        className="flex-1 min-w-0 bg-transparent border-b border-glass-border/40 focus:outline-none focus:border-coral text-purple-200 font-mono text-[10px] px-1 py-0.5 placeholder:text-muted/40"
                      />
                    </div>
                  </>
                )}
                {/* Dry-run: actually acquire a token with the current config and report ✓/✗ */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={!autoAuthReady(a.autoAuth) || authTest.status === 'testing'}
                    onClick={async () => {
                      setAuthTest({ status: 'testing' });
                      try {
                        const tok = await acquireToken(a.autoAuth);
                        setAuthTest(tok
                          ? { status: 'ok', detail: `${tok.slice(0, 12)}…` }
                          : { status: 'bad', detail: (a.autoAuth.mode || 'login') === 'forge' ? 'forge failed — check secret/claims' : 'no token — check URL / body / token field' });
                      } catch (e) {
                        setAuthTest({ status: 'bad', detail: e instanceof Error ? e.message : 'error' });
                      }
                    }}
                    className="flex-none px-2 py-0.5 rounded-full border border-glass-border/50 text-purple-200 hover:border-coral/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Run the login/forge now and check it returns a token (session only)."
                  >
                    {authTest.status === 'testing' ? 'testing…' : 'test'}
                  </button>
                  <span className="text-[9px]">
                    {authTest.status === 'ok'
                      ? <span className="text-emerald-400">✓ token acquired ({authTest.detail})</span>
                      : authTest.status === 'bad'
                        ? <span className="text-red-400">✗ {authTest.detail}</span>
                        : <span className="text-muted/40">verify before relying on it</span>}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Tasks */}
          {a.tasks.length > 0 && (
            <div className="px-4 py-3 border-t border-glass-border/60 max-h-[34%] overflow-auto">
              <h4 className="flex items-center text-[11px] font-bold uppercase tracking-widest text-purple-gray mb-2">
                📋 Tasks <span className="ml-auto text-coral font-mono">{a.tasks.filter((t) => t.status === 'done').length}/{a.tasks.length}</span>
              </h4>
              <div className="space-y-1.5">
                {a.tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <span className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 grid place-items-center text-[10px] ${t.status === 'done' ? 'bg-emerald-500 text-emerald-950' : 'border border-amber-400 text-amber-400'}`}>{t.status === 'done' ? '✓' : '▸'}</span>
                    <span className={t.status === 'done' ? 'text-muted line-through' : 'text-amber-300'}>{t.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-glass-border/60">
            <input
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAgentSend(); } }}
              placeholder="Message the AI agent…"
              disabled={a.isRunning}
              className="flex-1 input-premium px-3 py-2 rounded-xl disabled:opacity-60"
            />
            {a.isRunning ? (
              <button onClick={a.stop} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold" aria-label="Stop">■ Stop</button>
            ) : (
              <button onClick={handleAgentSend} disabled={!agentInput.trim()} className="p-2 rounded-xl bg-coral text-white hover:bg-coral-hover disabled:opacity-40" aria-label="Send to agent"><PaperAirplaneIcon className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
