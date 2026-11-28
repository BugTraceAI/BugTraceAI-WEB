import { useMemo, useState } from 'react';
import {
  type WorkbenchState,
  selectExchange,
  selectNode,
  exchangeForStep,
  formatRawRequest,
  formatRawResponse,
} from './workbenchModel';

// Tailwind classes map to tokens in tailwind.config.js (purple-deep, purple-medium, coral, off-white, purple-gray, success, warning, error).
const severityClass: Record<string, string> = {
  critical: 'bg-error-bg text-error border-error-border shadow-glow-error',
  high: 'bg-error-bg text-error border-error-border',
  medium: 'bg-warning-bg text-warning border-warning-border',
  low: 'bg-success-bg text-success border-success-border',
  info: 'bg-glass-bg text-purple-gray border-glass-border',
};

export interface WorkbenchPageProps {
  initialState: WorkbenchState;
}

export function WorkbenchPage({ initialState }: WorkbenchPageProps) {
  const [state, setState] = useState<WorkbenchState>(initialState);

  const activeExchange = useMemo(
    () => state.exchanges.find((e) => e.id === state.selectedExchangeId) ?? state.exchanges[0],
    [state.exchanges, state.selectedExchangeId],
  );

  const selectedNode = state.nodes.find((n) => n.id === state.selectedNodeId) ?? null;

  return (
    <div className="flex h-full min-h-screen bg-purple-deep text-off-white font-sans">
      <nav aria-label="Primary" className="w-14 border-r border-glass-border bg-dashboard-bg flex flex-col items-center py-4 gap-4">
        <div className="w-8 h-8 rounded-xl bg-coral shadow-glow-coral" aria-hidden="true" />
      </nav>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 px-6 py-3 border-b border-glass-border bg-glass-bg backdrop-blur-lg">
          {['Recon', 'Discovery', 'Scanning', 'Validation', 'Reporting'].map((phase, i) => (
            <span
              key={phase}
              className={`px-3 py-1 rounded-full text-xs border ${
                i === 2 ? 'bg-coral text-purple-deep border-coral' : 'border-glass-border text-purple-gray'
              }`}
            >
              {phase}
            </span>
          ))}
        </header>

        <section className="grid grid-cols-2 gap-4 p-6 min-h-0 flex-1" aria-label="Request and response">
          <article className="rounded-card bg-purple-medium border border-glass-border shadow-dashboard overflow-hidden flex flex-col">
            <h2 className="px-4 py-2 text-sm font-semibold text-purple-gray border-b border-glass-border">Request</h2>
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-off-white overflow-auto">
              {activeExchange ? formatRawRequest(activeExchange.request) : 'No exchange selected'}
            </pre>
          </article>
          <article className="rounded-card bg-purple-medium border border-glass-border shadow-dashboard overflow-hidden flex flex-col">
            <h2 className="px-4 py-2 text-sm font-semibold text-purple-gray border-b border-glass-border">Response</h2>
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-off-white overflow-auto">
              {activeExchange ? formatRawResponse(activeExchange.response) : ''}
            </pre>
          </article>
        </section>

        <section aria-label="Swarm graph" className="mx-6 mb-6 rounded-card-lg bg-dashboard-card border border-glass-border h-64 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {state.edges.map((e) => {
              const a = state.nodes.find((n) => n.id === e.from);
              const b = state.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              return <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#FF7F50" strokeOpacity="0.5" strokeWidth="0.003" />;
            })}
          </svg>
          {state.nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setState((s) => selectNode(s, n.id))}
              aria-pressed={state.selectedNodeId === n.id}
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs border backdrop-blur-xs transition ${
                severityClass[n.severity ?? 'info']
              } ${state.selectedNodeId === n.id ? 'ring-2 ring-coral' : ''}`}
            >
              {n.label}
            </button>
          ))}
        </section>
      </main>

      <aside aria-label="Agent timeline" className="w-96 border-l border-glass-border bg-glass-bg backdrop-blur-lg p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-purple-gray mb-3">Agent reasoning</h2>
        <ol className="space-y-3">
          {state.timeline.map((step) => {
            const linked = exchangeForStep(state, step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => linked && setState((s) => selectExchange(s, linked.id))}
                  className="w-full text-left rounded-card bg-purple-medium border border-glass-border p-3 hover:bg-purple-light transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{step.title}</span>
                    <span className="text-xs text-purple-gray capitalize">{step.status}</span>
                  </div>
                  <p className="text-xs text-purple-gray mt-1">{step.detail || step.role}</p>
                </button>
              </li>
            );
          })}
        </ol>
        {selectedNode && (
          <div className="mt-6 rounded-card bg-purple-medium border border-glass-border p-3 text-xs">
            <p className="font-semibold">{selectedNode.label}</p>
            <p className="text-purple-gray">{selectedNode.kind} · {selectedNode.role}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
