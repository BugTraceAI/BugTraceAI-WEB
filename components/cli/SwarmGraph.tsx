// components/cli/SwarmGraph.tsx
/* Live "swarm" pipeline graph — the cinematic view of a scan, embedded in the scan console.
 *
 * Renders the FULL pipeline the way the design mockup does — recon tools → discovered URLs →
 * ThinkingAgent (WET→DRY dedup) → specialists with L1–L6 escalation ladders → AgenticValidator
 * (CDP) → Reporter (parallel threads) — and drives the progression from the REAL coarse signals
 * we already have (pipeline.currentPhase, agents[], findings[], metrics, URLs parsed from the log).
 *
 * It's a representation, not an event-by-event source of truth: where a precise micro-signal isn't
 * available the section animates by phase. Anyone who wants the literal detail flips to the Events view.
 *
 * Pure SVG + React (no graph library). Pan (drag) + zoom (wheel/buttons) for large scopes.
 * Product strings are English; design tokens match the app (coral / purple / glass).
 */
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { PipelineState, AgentState, MetricsState, Finding } from '../../hooks/useScanSocket';
import type { LogEntry } from './ScanConsole';

interface SwarmGraphProps {
  pipeline: PipelineState;
  agents: AgentState[];
  findings: Finding[];
  metrics: MetricsState;
  logs: LogEntry[];
  agentLevels?: Record<string, { level: string; confirmed: boolean }>;
  isScanning: boolean;
  reserveRight?: boolean;   // split view: events overlay covers the right ~44% — keep the camera in the left clear zone
}

const ORDER = ['reconnaissance', 'discovery', 'strategy', 'exploitation', 'validation', 'reporting'];
// Early agents shown near the root; each beats when it's the one currently working.
const EARLY = [
  { key: 'gospider', label: 'GoSpider', phase: 0, color: '#4ade80' },
  { key: 'nuclei', label: 'Nuclei', phase: 0, color: '#facc15' },
  { key: 'auth', label: 'AuthDiscovery', phase: 0, color: '#a78bfa' },
  { key: 'dast', label: 'DASTySAST', phase: 1, color: '#38bdf8' },
];
// Canonical swarm — shown when the backend hasn't reported live agents yet (representative).
const CANON = [
  { key: 'sqli', name: 'SQLiAgent' }, { key: 'xss', name: 'XSSAgent' }, { key: 'csti', name: 'CSTIAgent' },
  { key: 'xxe', name: 'XXEAgent' }, { key: 'idor', name: 'IDORAgent' }, { key: 'ssrf', name: 'SSRFAgent' },
  { key: 'lfi', name: 'LFIAgent' }, { key: 'jwt', name: 'JWTAgent' },
];
const REP_THREADS = ['CVSS scoring', 'PoC · SQLi', 'PoC · XSS', 'PoC · CSTI', 'PoC · IDOR', 'Technical report', 'Executive summary'];
// Faithful per-agent escalation ladders — verified against the CLI agents (each rung: [shortTag, fullName]).
//  cdp: routes to the AgenticValidator (browser-executable only). full: runs ALL rungs even after confirm (impact analysis, no short-circuit).
//  confirmAt: representative rung index that confirms (we don't get the exact rung from the backend, so this is indicative).
type Ladder = { levels: [string, string][]; cdp?: boolean; full?: boolean; confirmAt?: number };
const LADDERS: Record<string, Ladder> = {
  xss: { cdp: true, confirmAt: 2, levels: [['L.5', 'smart probe'], ['L1', 'polyglot+OOB'], ['L2', 'static bombing'], ['L3', 'LLM bombing'], ['L4', 'HTTP manipulator'], ['L5', 'browser'], ['L6', 'CDP']] },
  csti: { cdp: true, confirmAt: 2, levels: [['pb', 'smart probe'], ['L0', 'WET payload'], ['L1', 'template probe'], ['L2', 'static bombing'], ['L3', 'LLM bombing'], ['L4', 'HTTP manipulator'], ['L5', 'browser'], ['L6', 'CDP']] },
  sqli: { confirmAt: 1, levels: [['L0', 'WET payload'], ['L1', 'error-based'], ['L2', 'boolean+union'], ['L3', 'OOB+time'], ['L4', 'SQLMap']] },
  idor: { full: true, confirmAt: 0, levels: [['P1', 'retest diff'], ['P2', 'HTTP methods'], ['P3', 'impact'], ['P4', 'horizontal'], ['P5', 'vertical']] },
  xxe: { confirmAt: 2, levels: [['H', 'heuristic 7'], ['B', 'LLM bypass'], ['S', 'schema DTD'], ['∅', 'blind→manual']] },
  jwt: { confirmAt: 0, levels: [['N', 'none-alg'], ['H', 'brute HS256'], ['K', 'key confusion']] },
  lfi: { confirmAt: 0, levels: [['P', 'smart probe'], ['F', 'Go fuzzer'], ['W', 'PHP wrappers']] },
  rce: { confirmAt: 0, levels: [['T', 'time-based'], ['E', 'eval-based'], ['A', 'auth gate'], ['O', 'output-based']] },
  ssrf: { confirmAt: 0, levels: [['F', 'Go fuzzer'], ['L', 'LLM strategy']] },
  openredirect: { confirmAt: 0, levels: [['P', 'payload probe'], ['B', 'browser confirm']] },
};
const DEFAULT_LADDER: Ladder = { confirmAt: 1, levels: [['L1', 'probe'], ['L2', 'payloads'], ['L3', 'LLM'], ['L4', 'manipulator']] };

// columns
const RX = 66, EX = 250, HX = 470, AX = 650, VX = 1030, PX = 1200, WX = 1350, FX = 1560;

function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
function parseTarget(logs: LogEntry[]): string {
  for (const l of logs) { const m = l.message.match(/https?:\/\/([^/\s]+)/); if (m) return m[1]; }
  return 'target';
}
function specKey(name: string): string { return name.toLowerCase().replace(/agent$/, '').replace(/[^a-z]/g, ''); }
// Canonical vuln type — collapses "XSSAgentV4" and "XSS" (and similar duplicates) to one node.
const TYPE_KEYS = ['sqli', 'xss', 'csti', 'ssti', 'xxe', 'idor', 'ssrf', 'lfi', 'rce', 'jwt', 'prototypepollution', 'headerinjection', 'apisecurity', 'massassignment', 'openredirect', 'fileupload', 'graphql', 'deserial'];
function canonType(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const k of TYPE_KEYS) if (n.includes(k)) return k;
  return n;
}
// distinct colour per vuln type — each agent gets its own colour (node, line and particles)
const TYPE_COLOR: Record<string, string> = {
  sqli: '#ff6b6b', xss: '#4dd2ff', csti: '#c792ea', xxe: '#ffd166', idor: '#06d6a0',
  ssrf: '#f78c6b', lfi: '#83e765', rce: '#ff5c8a', jwt: '#82aaff', ssti: '#ff8fab',
  prototypepollution: '#e0c46c', headerinjection: '#7fdbca', apisecurity: '#c3e88d',
  massassignment: '#ffcb6b', graphql: '#e535ab', deserial: '#b39ddb', openredirect: '#ffb3c1',
};
function agentColor(name: string): string { return TYPE_COLOR[canonType(name)] || '#FF7F50'; }
function ladderFor(name: string): Ladder { return LADDERS[canonType(name)] || DEFAULT_LADDER; }

// Normalize an escalation-level label ("L0.5"/"L.5"/"L3"/"pb"/"H") so a live event level matches a ladder rung tag.
const _normLvl = (s: string) => String(s).trim().toLowerCase().replace(/^l/, '').replace(/^0(?=\.)/, '');
function levelRungIndex(levels: [string, string][], live: string | undefined): number {
  if (!live) return -1;
  const target = _normLvl(live);
  return levels.findIndex(([tag]) => _normLvl(tag) === target);
}

export const SwarmGraph: React.FC<SwarmGraphProps> = ({ pipeline, agents, findings, metrics, logs, isScanning, agentLevels = {}, reserveRight = true }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const vpRef = useRef<SVGGElement>(null);
  const tf = useRef({ s: 1, tx: 0, ty: 0 });
  const drag = useRef({ on: false, x: 0, y: 0 });
  const [zoomPct, setZoomPct] = useState(100);

  const complete = pipeline.currentPhase === 'complete' || (!isScanning && logs.slice(-30).some(l => /\[SCAN COMPLETE\]/i.test(l.message)));
  const phaseIdx = complete ? 99 : ORDER.indexOf(pipeline.currentPhase);
  const reached = useCallback((i: number) => complete || phaseIdx >= i, [complete, phaseIdx]);
  const active = useCallback((i: number) => !complete && phaseIdx === i, [complete, phaseIdx]);

  // is anything actually happening? (don't draw a lone "target" node when idle)
  const hasActivity = isScanning || logs.length > 0 || phaseIdx >= 0 || complete;
  // the latest live event — shown as a moving ticker top-right so the graph never feels static
  const currentEvent = logs.length ? logs[logs.length - 1].message : '';

  const target = useMemo(() => parseTarget(logs), [logs]);
  // which single agent is live RIGHT NOW — drives the "beat" so you can see where we are
  const actor = useMemo(() => {
    if (complete || phaseIdx < 0) return '';
    // strategy/validation/reporting are single-agent; recon & discovery agents run in parallel (handled per-agent)
    return (['', '', 'thinking', 'exploit', 'validator', 'reporter'][phaseIdx]) || '';
  }, [phaseIdx, complete]);
  // DAST/discovery is the slow phase — show live "i/n" progress on the DASTySAST node
  const dastProgress = useMemo(() => {
    for (let k = logs.length - 1; k >= Math.max(0, logs.length - 40); k--) {
      const m = logs[k].message.match(/Analyzing URL\s+(\d+)\s*\/\s*(\d+)/i);
      if (m) return `${m[1]}/${m[2]}`;
    }
    return metrics.urlsDiscovered > 0 ? `${metrics.urlsAnalyzed}/${metrics.urlsDiscovered}` : '';
  }, [logs, metrics]);
  const authProgress = useMemo(() => {
    for (let k = logs.length - 1; k >= Math.max(0, logs.length - 1000); k--) {
      // CLI emits "Auth discovery complete — N JWTs, N cookies" (verbose_events.py); tolerate the
      // legacy "completed" too. A one-word drift here previously left the auth node stuck on "scanning".
      const completed = logs[k].message.match(/Auth discovery complete(?:d)?\s+—\s+(\d+) JWTs?,\s+(\d+) cookies?/i);
      if (completed) return `${completed[1]} JWT · ${completed[2]} cookie`;
      const scanning = logs[k].message.match(/Auth scan\s+(\d+)\s*\/\s*(\d+)/i);
      if (scanning) return `scanning ${scanning[1]}/${scanning[2]}`;
      if (/Auth discovery scanning/i.test(logs[k].message)) return 'starting';
    }
    return '';
  }, [logs]);
  // once exploitation starts, recon/discovery has "left its files" and disconnects — the pipeline runs on from ThinkingAgent
  const disconnected = reached(3);

  // specialists: real agents[] if present, else canonical swarm. Confirmed state from agents.vulns OR findings.
  const specData = useMemo(() => {
    const rawBase = agents.length
      ? agents.map(a => ({ name: a.agent, status: a.status as string | undefined, vulns: a.vulns || 0, queue: a.queue || 0, processed: a.processed || 0 }))
      : CANON.map(c => ({ name: c.name, status: undefined as string | undefined, vulns: 0, queue: 0, processed: 0 }));
    // dedupe by vuln type — agents[] can report both "XSSAgentV4" and "XSS" for the same finding
    const byType = new Map<string, { name: string; status: string | undefined; vulns: number; queue: number; processed: number }>();
    for (const s of rawBase) {
      const t = canonType(s.name);
      const ex = byType.get(t);
      if (!ex) { byType.set(t, s); continue; }
      const name = /agent/i.test(ex.name) ? ex.name : (/agent/i.test(s.name) ? s.name : (ex.name.length >= s.name.length ? ex.name : s.name));
      const status = ex.status === 'active' || s.status === 'active' ? 'active' : (ex.status || s.status);
      byType.set(t, { name, status, vulns: Math.max(ex.vulns, s.vulns), queue: Math.max(ex.queue, s.queue), processed: Math.max(ex.processed, s.processed) });
    }
    const base = [...byType.values()];
    const withState = base.slice(0, 12).map(s => {
      const k = specKey(s.name);
      const fromFindings = findings.filter(f => {
        const t = (f.type || '').toLowerCase().replace(/[^a-z]/g, '');
        return k.length >= 3 && (t.includes(k) || k.includes(t.slice(0, 4)));
      }).length;
      const vulns = Math.max(s.vulns, fromFindings);
      let state: 'confirmed' | 'clear' | 'work' | 'idle';
      if (vulns > 0) state = 'confirmed';
      else if (s.status === 'complete') state = 'clear';
      else if (s.status === 'active') state = 'work';
      else if (reached(4) || complete) state = 'clear';        // past exploit → no-vuln agents are done
      else if (active(3) || reached(3)) state = 'work';        // in exploit, unknown status → assume working
      else state = 'idle';
      return { ...s, vulns, state };
    });
    // show only agents that actually did work — confirmed vulns or currently escalating.
    // agents with no WET candidate (never activated) or cleared with no vuln are dropped from the list.
    const shown = withState.filter(s => s.state === 'confirmed' || s.state === 'work');
    // CDP-validated agents (XSS/CSTI → AgenticValidator) on top; self-validating agents below.
    shown.sort((a, b) => {
      const ac = (canonType(a.name) === 'xss' || canonType(a.name) === 'csti') ? 0 : 1;
      const bc = (canonType(b.name) === 'xss' || canonType(b.name) === 'csti') ? 0 : 1;
      return ac !== bc ? ac - bc : a.name.localeCompare(b.name);
    });
    return { list: shown, dispatched: withState.length };
  }, [agents, findings, complete, active, reached]);
  const specialists = specData.list;

  const totalVulns = useMemo(() => specialists.reduce((n, s) => n + (s.vulns > 0 ? 1 : 0), 0) || findings.length, [specialists, findings]);
  const dryCount = specData.dispatched;
  const wetCount = dryCount * 2 + 1;
  // Only browser-executable findings (XSS / CSTI / DOM) go through the CDP AgenticValidator.
  // HTTP-validated findings (SQLi, LFI, RCE, IDOR, …) self-confirm and go straight to the report.
  const isCdp = (name: string) => { const t = canonType(name); return t === 'xss' || t === 'csti'; };
  const cdpConfirmed = specialists.filter(s => s.state === 'confirmed' && isCdp(s.name)).length;

  // ---- layout ----
  const model = useMemo(() => {
    const TOP = 26;
    // specialists (tall rows for ladder)
    const DY_S = 50;
    const specY = specialists.map((_, i) => TOP + 20 + i * DY_S);
    const specCy = specY.length ? (specY[0] + specY[specY.length - 1]) / 2 : 200;
    // recon/discovery agents column
    const toolY = EARLY.map((_, i) => specCy - 45 + i * 30);
    // report threads fanned around center at WX
    const DY_T = 26;
    const tStart = specCy - ((REP_THREADS.length - 1) * DY_T) / 2;
    const threadY = REP_THREADS.map((_, i) => tStart + i * DY_T);
    const height = Math.max(360, Math.max(specY[specY.length - 1] || 0, threadY[threadY.length - 1] || 0) + 34);
    return { specY, specCy, toolY, threadY, height };
  }, [specialists]);

  const VBW = 1720;
  const VBH = model.height;
  const cy = model.specCy;

  // ---- pan & zoom ----
  const apply = useCallback(() => {
    if (vpRef.current) vpRef.current.setAttribute('transform', `translate(${tf.current.tx},${tf.current.ty}) scale(${tf.current.s})`);
    setZoomPct(Math.round(tf.current.s * 100));
  }, []);
  const clientToVB = useCallback((cx: number, cyy: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cyy;
    const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }, []);
  const zoomAt = useCallback((vx: number, vy: number, factor: number) => {
    if (vpRef.current) vpRef.current.style.transition = 'none';   // manual zoom is instant (no glide)
    const s = tf.current.s, ns = Math.min(6, Math.max(0.2, s * factor));
    tf.current.tx = vx - (ns / s) * (vx - tf.current.tx);
    tf.current.ty = vy - (ns / s) * (vy - tf.current.ty);
    tf.current.s = ns; apply();
  }, [apply]);
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const p = clientToVB(e.clientX, e.clientY); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12); };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [clientToVB, zoomAt]);
  const onPointerDown = (e: React.PointerEvent) => { if (vpRef.current) vpRef.current.style.transition = 'none'; drag.current = { on: true, x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return; const svg = svgRef.current; if (!svg) return; const ctm = svg.getScreenCTM(); if (!ctm) return;
    tf.current.tx += (e.clientX - drag.current.x) / ctm.a; tf.current.ty += (e.clientY - drag.current.y) / ctm.d;
    drag.current.x = e.clientX; drag.current.y = e.clientY; apply();
  };
  const endDrag = () => { drag.current.on = false; };
  const fit = () => { if (vpRef.current) vpRef.current.style.transition = 'none'; tf.current = { s: 1, tx: 0, ty: 0 }; apply(); };
  const toggleFullscreen = () => {
    const root = svgRef.current?.closest('[data-testid="scan-console"]') as HTMLElement | null; if (!root) return;
    if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.();
  };
  // ---- camera: glide + zoom so the ACTIVE phase is big and centred (events float over the right) ----
  const cyRef = useRef(cy); cyRef.current = cy;
  const focusPhase = useCallback((idx: number) => {
    const svg = svgRef.current, vp = vpRef.current; if (!svg || !vp) return;
    const b = svg.viewBox.baseVal;
    // anchors tuned for split (events overlay covers the right ~44% → keep the action in the left clear zone)
    const MAP: Record<number, [number, number, number]> = {
      0: [180, 1.5, 0.30], 1: [250, 1.5, 0.30], 2: [400, 1.5, 0.32],
      3: [AX + 90, 1.2, 0.34], 4: [VX - 60, 1.4, 0.32], 5: [PX + 120, 1.35, 0.27],
    };
    let cx: number, s: number, ax: number;
    if (idx >= 99) {
      // completion overview — fit the WHOLE pipeline. In split, fit it into the left clear zone so it never slides under the overlay.
      if (reserveRight) { cx = 820; s = 0.56; ax = 0.29; }
      else { cx = b.width / 2; s = 0.82; ax = 0.5; }
    } else {
      const m = MAP[idx]; if (!m) return;
      cx = m[0]; s = m[1]; ax = reserveRight ? m[2] : Math.min(0.5, m[2] + 0.16);   // no overlay → recentre toward the middle
    }
    tf.current = { s, tx: b.width * ax - s * cx, ty: b.height * 0.5 - s * cyRef.current };
    vp.style.transition = '';   // fall back to the CSS glide (.swarm-vp)
    apply();
  }, [apply, reserveRight]);
  useEffect(() => { focusPhase(complete ? 99 : phaseIdx); }, [phaseIdx, complete, focusPhase]);

  // reveal helper: fade in a group once its phase is reached
  const rv = (phase: number) => ({ opacity: reached(phase) ? 1 : 0, transition: 'opacity .55s ease' });

  // idle — nothing launched yet: clean empty state, no lone "target" node
  if (!hasActivity) {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center text-center select-none overflow-hidden">
        <div className="absolute inset-0 swarm-grid pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="swarm-scan" /></div>
        <div className="w-3 h-3 rounded-full bg-coral/70 mb-3 swarm-beat relative" />
        <p className="text-sm text-purple-gray">No scan running</p>
        <p className="text-xs mt-1 text-muted/70">Launch a scan to watch the live pipeline graph build</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* cinematic layer — cyber grid + scanline sweep + vignette (hacker-movie vibe) */}
      <div className="absolute inset-0 swarm-grid pointer-events-none" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="swarm-scan" /></div>
      <div className="absolute inset-0 swarm-vignette pointer-events-none" />
      {/* live event ticker — the current thing happening (never static) */}
      <div className="absolute top-2 right-3 z-10 flex items-center gap-2 max-w-[52%] bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-coral shrink-0 swarm-beat" />
        <span className="text-[10px] font-mono text-off-white/80 truncate">{currentEvent || 'pipeline & swarm · live'}</span>
      </div>
      <div className="absolute left-2 top-2 z-10 text-[9.5px] text-muted/60 tracking-wide select-none pointer-events-none">scroll = zoom · drag = pan</div>
      <div className="absolute left-3 bottom-3 z-10 flex flex-col gap-1.5">
        <button onClick={() => zoomAt(VBW / 2, VBH / 2, 1.25)} className="swarm-zbtn" title="Zoom in">+</button>
        <button onClick={() => zoomAt(VBW / 2, VBH / 2, 1 / 1.25)} className="swarm-zbtn" title="Zoom out">−</button>
        <button onClick={toggleFullscreen} className="swarm-zbtn text-[13px]" title="Fullscreen (director view)">⤢</button>
      </div>
      <button onClick={fit} className="absolute left-[52px] bottom-3 z-10 text-[9.5px] font-bold text-muted bg-black/40 border border-white/10 rounded-md px-2 py-1.5 select-none hover:text-coral hover:border-coral/40 transition-colors" title="Reset zoom">{zoomPct}%</button>

      <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full swarm-svg"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag} onPointerCancel={endDrag}>
        <g ref={vpRef} className="swarm-vp">
          {/* ===== links ===== */}
          {/* root → recon/discovery agents (spawned) */}
          {EARLY.map((t, i) => (
            <path key={'lre' + i} className="no-flow" d={linkPath(RX, cy, EX, model.toolY[i])} fill="none" stroke={t.color} strokeOpacity={disconnected ? 0.06 : 0.32} strokeWidth={1.3} style={{ ...rv(t.phase), transition: 'opacity .5s ease, stroke-opacity .6s ease' }} />
          ))}
          {/* recon/discovery agents → ThinkingAgent (feed candidates) */}
          {EARLY.map((t, i) => (
            <path key={'leh' + i} className="no-flow" d={linkPath(EX, model.toolY[i], HX, cy)} fill="none"
              stroke={t.color} strokeOpacity={disconnected ? 0.05 : reached(2) ? 0.45 : 0.18} strokeWidth={1.3} style={{ ...rv(2), transition: 'opacity .5s ease, stroke-opacity .6s ease' }} />
          ))}
          {/* Strategy handoff — a flurry of coloured "lights" fly from recon to the ThinkingAgent, then recon disconnects */}
          {active(2) && EARLY.flatMap((t, i) => [0, 1, 2].map(k => (
            <circle key={`peh${i}-${k}`} r={2.4} fill={t.color} style={{ filter: `drop-shadow(0 0 5px ${t.color})` }}>
              <animateMotion dur="1.2s" repeatCount="indefinite" path={linkPath(EX, model.toolY[i], HX, cy)} begin={`${k * 0.4}s`} />
            </circle>
          )))}
          {/* hub → specialists — static "wire" in each agent's colour (the task was already dispatched; the AGENT beats, not the line) */}
          {specialists.map((s, i) => {
            const col = agentColor(s.name);
            return <path key={'ls' + i} className="no-flow" d={linkPath(HX, cy, AX, model.specY[i])} fill="none" stroke={col} strokeOpacity={0.5} strokeWidth={1.5} style={rv(2)} />;
          })}
          {/* confirmed findings flow: XSS/CSTI → CDP validator; everything else self-validates → straight to report */}
          {specialists.map((s, i) => {
            if (s.state !== 'confirmed') return null;
            return isCdp(s.name)
              ? <path key={'lv' + i} d={linkPath(AX, model.specY[i], VX, cy)} fill="none" stroke="rgba(124,147,255,.42)" strokeWidth={1.4} style={rv(4)} />
              : <path key={'lr' + i} d={linkPath(AX, model.specY[i], PX, cy)} fill="none" stroke="rgba(46,204,113,.28)" strokeWidth={1.2} style={rv(4)} />;
          })}
          {/* validator → reporter */}
          <path className="no-flow" d={linkPath(VX, cy, PX, cy)} fill="none" stroke={reached(5) ? 'rgba(46,204,113,.4)' : 'rgba(176,168,192,.18)'} strokeWidth={1.5} style={rv(5)} />
          {reached(5) && <circle r={2.6} fill="#2ECC71" style={{ filter: 'drop-shadow(0 0 4px #2ECC71)' }}>
            <animateMotion dur="1.6s" repeatCount="indefinite" path={linkPath(VX, cy, PX, cy)} />
          </circle>}
          {/* reporter → threads */}
          {REP_THREADS.map((_, i) => (
            <path key={'lt' + i} d={linkPath(PX, cy, WX, model.threadY[i])} fill="none" stroke="rgba(46,204,113,.3)" strokeWidth={1.2} style={rv(5)} />
          ))}

          {/* ===== root (target) ===== */}
          <g transform={`translate(${RX},${cy})`}>
            <circle className={isScanning ? 'swarm-ping' : ''} r={13} fill="none" stroke="rgba(255,127,80,.35)" strokeWidth={1.3} />
            <circle r={6} fill="#FF7F50" className={isScanning ? 'swarm-beat' : ''} />
            <text x={0} y={-16} textAnchor="middle" className="swarm-root">{target}</text>
            <text x={0} y={26} textAnchor="middle" className="swarm-mini">{metrics.urlsDiscovered} urls · {totalVulns} vulns</text>
          </g>

          {/* ===== early agents (recon tools + DAST) — the ACTIVE one beats to show where we are ===== */}
          {EARLY.map((t, i) => {
            // ALL early agents keep beating through recon+discovery until Strategy starts.
            // Tricky (recon really finishes first) but far livelier — recon+discovery reads as one active block.
            let st: 'active' | 'done' | 'pending';
            if (reached(2)) st = 'done';                  // strategy reached → early work is done
            else if (phaseIdx >= t.phase) st = 'active';  // its phase has started, still pre-strategy → keep beating
            else st = 'pending';
            const ac = t.color;
            const col = st === 'active' ? { s: ac, f: ac } : st === 'done' ? { s: ac, f: ac + '55' } : { s: 'rgba(138,128,165,.6)', f: 'rgba(61,43,95,.5)' };
            return (
              <g key={t.key} transform={`translate(${EX},${model.toolY[i]})`} style={{ opacity: disconnected ? 0.28 : (reached(t.phase) ? 1 : 0), transition: 'opacity .6s ease' }}>
                {st === 'active' && <>
                  <circle className="swarm-pulse-ring" r={6} fill="none" stroke={ac} strokeWidth={1.6} />
                  <circle className="swarm-pulse-ring b" r={6} fill="none" stroke={ac} strokeWidth={1.6} />
                </>}
                <circle r={st === 'active' ? 5 : 3.4} fill={col.f} stroke={col.s} strokeWidth={1.6}
                  className={st === 'active' ? 'swarm-beat' : ''} style={{ filter: st === 'active' ? `drop-shadow(0 0 9px ${ac})` : st === 'done' ? `drop-shadow(0 0 3px ${ac}88)` : 'none' }} />
                <text x={-9} y={3} textAnchor="end" className="swarm-tool" style={st === 'pending' ? undefined : { fill: ac }}>{t.label}</text>
                {t.key === 'dast' && st === 'active' && dastProgress && (
                  <text x={-9} y={15} textAnchor="end" className="swarm-astat is-work">scanning {dastProgress}</text>
                )}
                {t.key === 'auth' && authProgress && (
                  <text x={-9} y={15} textAnchor="end" className={`swarm-astat ${st === 'active' ? 'is-work' : ''}`}>{authProgress}</text>
                )}
              </g>
            );
          })}

          {/* ===== ThinkingAgent hub (WET→DRY) ===== */}
          <g transform={`translate(${HX},${cy})`} style={rv(2)}>
            {actor === 'thinking' && <>
              <circle className="swarm-pulse-ring" r={12} fill="none" stroke="#FF7F50" strokeWidth={1.6} />
              <circle className="swarm-pulse-ring b" r={12} fill="none" stroke="#FF7F50" strokeWidth={1.6} />
            </>}
            <circle r={8} className={actor === 'thinking' ? 'swarm-beat' : ''} fill={reached(3) ? 'rgba(46,204,113,.18)' : 'rgba(255,127,80,.18)'} stroke={reached(3) ? '#2ECC71' : '#FF7F50'} strokeWidth={1.7} style={{ filter: actor === 'thinking' ? 'drop-shadow(0 0 8px rgba(255,127,80,.8))' : 'none' }} />
            <text x={0} y={-28} textAnchor="middle" className="swarm-htitle">STRATEGY</text>
            <text x={0} y={-16} textAnchor="middle" className="swarm-hname">ThinkingAgent</text>
            <text x={0} y={26} textAnchor="middle" className={`swarm-hsub ${reached(3) ? 'dry' : ''}`}>
              {reached(2) ? `WET ${wetCount} → DRY ${dryCount}` : 'idle'}
            </text>
          </g>

          {/* ===== specialists — each with its OWN faithful ladder + real queue i/N ===== */}
          {specialists.map((s, i) => {
            const y = model.specY[i]; const col = agentColor(s.name);
            const escalating = s.state === 'work' && active(3);
            const ld = ladderFor(s.name); const levels = ld.levels; const n = levels.length;
            const cAt = Math.min(ld.confirmAt ?? 1, n - 1);
            const cdpLit = !!ld.cdp && s.state === 'confirmed' && reached(4);   // CDP rung lights once validation is reached
            const q = s.queue || 0; const proc = Math.min(s.processed || 0, q);
            const isXxe = canonType(s.name) === 'xxe';
            // Live escalation: while the agent is still working, light rungs up to the level it's currently on.
            const liveIdx = s.state === 'confirmed' ? -1 : levelRungIndex(levels, agentLevels[canonType(s.name)]?.level);
            const rung = (li: number): { f: string; st: string } => {
              if (s.state === 'clear') return { f: 'rgba(46,204,113,.24)', st: '#2ECC71' };
              if (s.state === 'confirmed') {
                if (cdpLit && li === n - 1) return { f: 'rgba(124,147,255,.34)', st: '#7c93ff' };            // CDP-validated rung (blue)
                if (ld.full) return li === n - 1 ? { f: 'rgba(255,49,49,.35)', st: '#FF3131' } : { f: 'rgba(255,127,80,.28)', st: '#FF7F50' }; // impact: all lit
                if (li < cAt) return { f: 'rgba(255,127,80,.28)', st: '#FF7F50' };
                if (li === cAt) return { f: 'rgba(255,49,49,.35)', st: '#FF3131' };
              }
              // live escalation — climbed rungs light up as the agent advances L1→L6 (before confirmation)
              if (liveIdx >= 0 && li <= liveIdx) {
                return li === liveIdx
                  ? { f: 'rgba(255,127,80,.30)', st: '#FF7F50' }               // current live rung (bright)
                  : { f: 'rgba(255,127,80,.15)', st: 'rgba(255,127,80,.55)' };  // already-climbed rungs (dim)
              }
              return { f: 'rgba(255,255,255,0.06)', st: 'rgba(255,255,255,0.1)' };
            };
            const range = `${levels[0][0]}→${levels[n - 1][0]}`;
            return (
              <g key={canonType(s.name)} transform={`translate(${AX},${y})`} style={{ transition: 'transform .45s ease' }}>
                <g className="sw-popin" style={{ animationDelay: `${(i % 14) * 0.08}s` }}>
                  {escalating && <circle className="swarm-pulse-ring" r={7} fill="none" stroke={col} strokeWidth={1.3} style={{ animationDelay: `${(i % 5) * 0.28}s` }} />}
                  <circle r={s.state === 'confirmed' ? 6 : 4.6} fill={col + '22'} stroke={col} strokeWidth={2}
                    className={escalating ? 'swarm-beat' : ''}
                    style={{ filter: s.state === 'confirmed' ? `drop-shadow(0 0 6px ${col})` : escalating ? `drop-shadow(0 0 5px ${col})` : 'none', ...(escalating ? { animationDelay: `${(i % 5) * 0.28}s` } : {}) }} />
                  <text x={13} y={-6} className={`swarm-actor ${cdpLit ? 'is-cdp' : ''}`} style={cdpLit ? undefined : { fill: col }}>{s.name}</text>
                  {/* faithful per-agent ladder — real rungs (tag + colour by state) */}
                  {levels.map(([tag], li) => {
                    const c = rung(li);
                    return (
                      <g key={li}>
                        <rect x={13 + li * 20} y={2} width={16} height={7} rx={2} fill={c.f} stroke={c.st} strokeWidth={0.6}
                          className={escalating ? 'sw-seg run' : ''} style={escalating ? { animationDelay: `${li * 0.2}s` } : undefined} />
                        <text x={13 + li * 20 + 8} y={7.4} textAnchor="middle" className="swarm-seg-tag">{tag}</text>
                      </g>
                    );
                  })}
                  {/* real queue i/N counter (agent telemetry: processed/queue) */}
                  {q > 0 && <text x={13 + n * 20 + 3} y={8} className={`swarm-acnt ${proc >= q && s.state !== 'work' ? 'done' : ''}`}>{proc}/{q}</text>}
                  <text x={13} y={22} className={`swarm-astat is-${cdpLit ? 'cdp' : s.state}`}>
                    {s.state === 'confirmed'
                      ? (cdpLit ? `CDP-validated @ ${levels[n - 1][0]}` : `CONFIRMED @ ${levels[cAt][0]}${ld.full ? ' · impact' : ''}`)
                      : s.state === 'clear' ? (isXxe ? 'blind → manual' : 'no vuln')
                        : escalating ? `escalating ${range}…` : 'queued'}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ===== AgenticValidator (CDP) ===== */}
          <g transform={`translate(${VX},${cy})`} style={rv(4)}>
            {actor === 'validator' && <>
              <circle className="swarm-pulse-ring" r={12} fill="none" stroke="#7c93ff" strokeWidth={1.6} />
              <circle className="swarm-pulse-ring b" r={12} fill="none" stroke="#7c93ff" strokeWidth={1.6} />
            </>}
            <circle r={7.5} className={actor === 'validator' ? 'swarm-beat' : ''} fill={reached(5) ? 'rgba(46,204,113,.18)' : 'rgba(124,147,255,.16)'} stroke={reached(5) ? '#2ECC71' : '#7c93ff'} strokeWidth={1.7} style={{ filter: actor === 'validator' ? 'drop-shadow(0 0 8px rgba(124,147,255,.8))' : 'none' }} />
            <text x={0} y={-26} textAnchor="middle" className="swarm-htitle">VALIDATION</text>
            <text x={0} y={-14} textAnchor="middle" className="swarm-hname">AgenticValidator</text>
            <text x={0} y={25} textAnchor="middle" className="swarm-hsub">{reached(4) ? `CDP · ${cdpConfirmed} XSS/CSTI` : 'idle'}</text>
          </g>

          {/* ===== Reporter + parallel threads ===== */}
          <g transform={`translate(${PX},${cy})`} style={rv(5)}>
            {actor === 'reporter' && <>
              <circle className="swarm-pulse-ring" r={12} fill="none" stroke="#FF7F50" strokeWidth={1.6} />
              <circle className="swarm-pulse-ring b" r={12} fill="none" stroke="#FF7F50" strokeWidth={1.6} />
            </>}
            <circle r={7.5} className={actor === 'reporter' ? 'swarm-beat' : ''} fill={complete ? 'rgba(46,204,113,.18)' : 'rgba(255,127,80,.16)'} stroke={complete ? '#2ECC71' : '#FF7F50'} strokeWidth={1.7} style={{ filter: actor === 'reporter' ? 'drop-shadow(0 0 8px rgba(255,127,80,.8))' : 'none' }} />
            <text x={0} y={-26} textAnchor="middle" className="swarm-htitle">REPORTING</text>
            <text x={0} y={-14} textAnchor="middle" className="swarm-hname">Reporter</text>
            <text x={0} y={25} textAnchor="middle" className={`swarm-hsub ${complete ? 'dry' : ''}`}>{reached(5) ? `‖ ${REP_THREADS.length} threads` : 'idle'}</text>
          </g>
          {REP_THREADS.map((t, i) => (
            <g key={'t' + i} transform={`translate(${WX},${model.threadY[i]})`} style={rv(5)}>
              <circle r={3.4} fill={complete ? 'rgba(46,204,113,.16)' : 'rgba(255,193,7,.16)'} stroke={complete ? '#2ECC71' : '#FFC107'} strokeWidth={1.6}
                className={active(5) ? 'sw-thread run' : ''} />
              <text x={-9} y={3} textAnchor="end" className={`swarm-tool ${complete ? 'done' : active(5) ? 'work' : ''}`}>{t}</text>
            </g>
          ))}
          {/* threads → Final Report (converge into the deliverable) */}
          {REP_THREADS.map((_, i) => (
            <path key={'lf' + i} d={linkPath(WX, model.threadY[i], FX - 16, cy)} fill="none"
              stroke={complete ? 'rgba(46,204,113,.32)' : 'rgba(255,193,7,.22)'} strokeWidth={1.1} style={rv(5)} />
          ))}
          {/* ===== Final Report — the deliverable the pipeline produces (the finale) ===== */}
          <g transform={`translate(${FX},${cy})`} style={rv(5)}>
            {complete && <circle className="swarm-ping" r={28} fill="none" stroke="#2ECC71" strokeWidth={1.4} />}
            <rect x={-15} y={-20} width={30} height={40} rx={3}
              fill={complete ? 'rgba(46,204,113,.16)' : 'rgba(255,127,80,.12)'} stroke={complete ? '#2ECC71' : '#FF7F50'} strokeWidth={1.7}
              style={{ filter: complete ? 'drop-shadow(0 0 9px rgba(46,204,113,.55))' : 'none' }} />
            {[-10, -4, 2, 8].map(yy => (
              <line key={yy} x1={-9} y1={yy} x2={9} y2={yy} stroke={complete ? 'rgba(46,204,113,.55)' : 'rgba(255,127,80,.45)'} strokeWidth={1.3} />
            ))}
            {complete && (
              <g transform="translate(15,-18)">
                <circle r={7.5} fill="#2ECC71" style={{ filter: 'drop-shadow(0 0 5px rgba(46,204,113,.85))' }} />
                <path d="M-3.4,0.3 L-1.1,2.8 L3.6,-3" fill="none" stroke="#0a2417" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            <text x={0} y={-28} textAnchor="middle" className="swarm-htitle" style={complete ? { fill: '#8ff0b8' } : undefined}>FINAL REPORT</text>
            <text x={0} y={33} textAnchor="middle" className={`swarm-hsub ${complete ? 'dry' : ''}`}>{complete ? `${totalVulns} findings · report.html` : 'compiling…'}</text>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default SwarmGraph;
