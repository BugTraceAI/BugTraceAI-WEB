// components/HttpEditor.tsx
// Lightweight HTTP request/response editor: line numbers + syntax highlighting,
// editable (transparent textarea overlaid on a highlighted <pre>) or read-only.
// Pure React/CSS — no Monaco/CDN, safe for offline/cPanel deploys.
import React, { useRef, useState, useMemo, useEffect } from 'react';

// Palette matched to the AI Repeater mockup (BugTraceAI theme).
const C = {
  dim: '#8a7fa8', text: '#f8f9fa', body: '#cabfe6',
  method: '#2ecc71', header: '#60a5fa', secret: '#ff7f50',
  s2xx: '#2ecc71', s3xx: '#c084fc', s4xx: '#ffc107', s5xx: '#ff3131',
};

const editorStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, "JetBrains Mono", "Cascadia Code", Consolas, monospace',
  fontSize: 12.5, lineHeight: '1.65', padding: '12px 14px', whiteSpace: 'pre',
  tabSize: 2, margin: 0, border: 0,
};

const statusColor = (code: number): string =>
  code >= 500 ? C.s5xx : code >= 400 ? C.s4xx : code >= 300 ? C.s3xx : code >= 100 ? C.s2xx : C.text;

function tokenizeLine(line: string, idx: number, isResponse: boolean): React.ReactNode {
  if (idx === 0) {
    if (isResponse) {
      const parts = line.split(/\s+/);
      const code = parseInt(parts[1] || '', 10);
      return (<>
        <span style={{ color: C.dim }}>{parts[0] || ''} </span>
        <span style={{ color: statusColor(code), fontWeight: 700 }}>{parts.slice(1).join(' ')}</span>
      </>);
    }
    const m = line.match(/^(\S+)\s+(.*)$/);
    if (m) {
      const vIdx = m[2].lastIndexOf(' HTTP/');
      const path = vIdx >= 0 ? m[2].slice(0, vIdx) : m[2];
      const ver = vIdx >= 0 ? m[2].slice(vIdx) : '';
      return (<>
        <span style={{ color: C.method, fontWeight: 700 }}>{m[1]}</span>{' '}
        <span style={{ color: C.text }}>{path}</span><span style={{ color: C.dim }}>{ver}</span>
      </>);
    }
    return <span style={{ color: C.text }}>{line}</span>;
  }
  const h = line.match(/^([A-Za-z0-9-]+):\s?(.*)$/);
  if (h) {
    const secret = /cookie|authorization|token|session|secret|api[-_]?key/i.test(h[1]) || h[2].length > 44;
    return (<>
      <span style={{ color: C.header }}>{h[1]}</span><span style={{ color: C.dim }}>: </span>
      <span style={{ color: secret ? C.secret : C.text }}>{h[2]}</span>
    </>);
  }
  return <span style={{ color: C.body }}>{line || '​'}</span>;
}

function highlight(value: string, isResponse: boolean): React.ReactNode[] {
  const lines = value.length ? value.split('\n') : [''];
  const out: React.ReactNode[] = [];
  lines.forEach((ln, i) => {
    out.push(<React.Fragment key={i}>{tokenizeLine(ln, i, isResponse)}</React.Fragment>);
    if (i < lines.length - 1) out.push('\n');
  });
  return out;
}

// Search overlay: renders the EXACT text transparently with matches wrapped in <mark>,
// so their coloured background shows THROUGH the syntax layer above it (identical layout →
// backgrounds sit precisely behind the matching text). The active match is tagged for scroll.
function searchMarks(value: string, query: string, activeIdx: number): React.ReactNode[] | null {
  if (!query) return null;
  const q = query.toLowerCase();
  const lower = value.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let pos = 0, no = 0, k = 0;
  for (; ;) {
    const f = lower.indexOf(q, pos);
    if (f === -1) { nodes.push(<span key={k++}>{value.slice(pos)}</span>); break; }
    if (f > pos) nodes.push(<span key={k++}>{value.slice(pos, f)}</span>);
    const isActive = no === activeIdx;
    nodes.push(
      <mark key={k++} data-active={isActive ? '1' : undefined}
        style={{ color: 'transparent', borderRadius: 2, background: isActive ? 'rgba(255,127,80,0.9)' : 'rgba(255,199,0,0.4)' }}>
        {value.slice(f, f + query.length)}
      </mark>
    );
    pos = f + query.length; no++;
  }
  return nodes;
}

interface HttpEditorProps {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  isResponse?: boolean;
  // Burp-style always-on search bar pinned to the BOTTOM of the editor (Response only):
  // counts matches and lets you step through them with next/prev.
  bottomFind?: boolean;
}

export const HttpEditor: React.FC<HttpEditorProps> = ({ value, onChange, readOnly, isResponse, bottomFind }) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLPreElement>(null);
  const scrollLayerRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const lineCount = (value.length ? value.split('\n').length : 1);
  const gutter = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  const [wrap, setWrap] = useState(true);

  // ── Find within this response (Burp-style bottom bar — long responses need search, not scroll-and-read) ──
  const [find, setFind] = useState('');
  const [active, setActive] = useState(0);
  const matchCount = useMemo(() => {
    if (!find) return 0;
    const q = find.toLowerCase(), v = value.toLowerCase();
    let c = 0, p = 0;
    while ((p = v.indexOf(q, p)) !== -1) { c++; p += q.length; }
    return c;
  }, [find, value]);

  // Word-wrap ON by default so long lines (request line + payload) are fully visible
  // instead of looking truncated. No-wrap keeps the aligned line-number gutter.
  const ws: React.CSSProperties = {
    ...editorStyle,
    whiteSpace: wrap ? 'pre-wrap' : 'pre',
    wordBreak: wrap ? 'break-all' : 'normal',
    overflowWrap: wrap ? 'anywhere' : 'normal',
  };

  const sync = (top: number, left: number) => {
    if (preRef.current) { preRef.current.scrollTop = top; preRef.current.scrollLeft = left; }
    if (gutRef.current) gutRef.current.scrollTop = top;
    if (hlRef.current) { hlRef.current.scrollTop = top; hlRef.current.scrollLeft = left; }
  };
  const master = () => taRef.current || scrollLayerRef.current;

  useEffect(() => { if (active >= matchCount) setActive(matchCount ? matchCount - 1 : 0); }, [matchCount, active]);
  // Bring the current match into view by scrolling the MASTER (textarea/scroll-div) → sync propagates.
  useEffect(() => {
    if (!find || matchCount === 0) return;
    const mk = hlRef.current?.querySelector('mark[data-active="1"]') as HTMLElement | null;
    const el = master();
    if (mk && el) { const top = Math.max(0, mk.offsetTop - 48); el.scrollTop = top; sync(top, el.scrollLeft); }
  }, [find, active, matchCount, wrap]);

  const nav = (dir: number) => { if (matchCount) setActive((a) => (((a + dir) % matchCount) + matchCount) % matchCount); };
  const onFindKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); nav(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); setFind(''); setActive(0); e.currentTarget.blur(); }
  };
  const onContainerKey = (e: React.KeyboardEvent) => {
    if (bottomFind && (e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault(); findInputRef.current?.focus(); findInputRef.current?.select();
    }
  };
  const toolBtn = 'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-muted/60 hover:text-coral bg-dashboard-bg/60 flex items-center';

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent" onKeyDown={onContainerKey}>
      {/* editor row: gutter + surface */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* top-right control: word-wrap toggle (Find is the bottom bar) */}
        <div className="absolute top-1 right-2 z-20 flex items-center gap-1">
          <button type="button" onClick={() => setWrap((w) => !w)} className={toolBtn}
            title={wrap ? 'Word-wrap ON — click for no-wrap (+ line numbers)' : 'No-wrap — click to wrap long lines'}>
            {wrap ? 'wrap' : 'no-wrap'}
          </button>
        </div>

        {/* line-number gutter (only when not wrapping, so numbers stay aligned) */}
        {!wrap && (
          <div
            ref={gutRef}
            className="flex-none overflow-hidden text-right select-none"
            style={{ ...editorStyle, padding: '12px 8px', color: 'rgba(138,127,168,0.45)', whiteSpace: 'pre', minWidth: 40 }}
            aria-hidden
          >
            {gutter}
          </div>
        )}
        {/* editor surface */}
        <div className="relative flex-1 min-w-0">
          {/* search-highlight layer — BEHIND the syntax layer; only its <mark> backgrounds show through */}
          {find && (
            <pre
              ref={hlRef}
              className="absolute inset-0 overflow-auto no-scrollbar pointer-events-none"
              style={{ ...ws, color: 'transparent' }}
              aria-hidden
            >
              {searchMarks(value, find, active)}
            </pre>
          )}
          <pre
            ref={preRef}
            className="absolute inset-0 overflow-auto no-scrollbar pointer-events-none"
            style={ws}
            aria-hidden
          >
            {highlight(value, !!isResponse)}
          </pre>
          {!readOnly && (
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onScroll={(e) => sync(e.currentTarget.scrollTop, e.currentTarget.scrollLeft)}
              spellCheck={false}
              wrap={wrap ? 'soft' : 'off'}
              className="absolute inset-0 overflow-auto resize-none focus:outline-none"
              style={{ ...ws, background: 'transparent', color: 'transparent', caretColor: '#fff' }}
            />
          )}
          {readOnly && (
            /* transparent scroll layer so the read-only pre can scroll + sync the gutter/highlight */
            <div
              ref={scrollLayerRef}
              className="absolute inset-0 overflow-auto"
              onScroll={(e) => sync(e.currentTarget.scrollTop, e.currentTarget.scrollLeft)}
            >
              <pre style={{ ...ws, visibility: 'hidden' }} aria-hidden>{value || ' '}</pre>
            </div>
          )}
        </div>
      </div>

      {/* ── Burp-style search bar pinned to the bottom (Response only) ── */}
      {bottomFind && (
        <div className="flex-none flex items-center gap-2 px-3 py-1.5 border-t border-glass-border/60 bg-dashboard-bg/50">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.2} className="text-muted/60 flex-none">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={findInputRef}
            value={find}
            onChange={(e) => { setFind(e.target.value); setActive(0); }}
            onKeyDown={onFindKey}
            placeholder="Search response…  (Enter = next · Shift+Enter = prev)"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent text-[11.5px] text-white font-mono focus:outline-none placeholder:text-muted/40"
          />
          <button type="button" onClick={() => nav(-1)} disabled={!matchCount} title="Previous (Shift+Enter)"
            className="text-muted/70 hover:text-coral disabled:opacity-25 px-1 text-sm leading-none">↑</button>
          <button type="button" onClick={() => nav(1)} disabled={!matchCount} title="Next (Enter)"
            className="text-muted/70 hover:text-coral disabled:opacity-25 px-1 text-sm leading-none">↓</button>
          <span className="font-mono tabular-nums text-[10.5px] min-w-[92px] text-right select-none whitespace-nowrap"
            style={{ color: find && matchCount === 0 ? '#ff7f50' : 'rgba(202,191,230,0.8)' }}>
            {find ? (matchCount ? `${active + 1} / ${matchCount} match${matchCount === 1 ? '' : 'es'}` : 'No matches') : '0 matches'}
          </span>
        </div>
      )}
    </div>
  );
};
