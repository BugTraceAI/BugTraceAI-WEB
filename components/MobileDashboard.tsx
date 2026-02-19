// components/MobileDashboard.tsx
// Pocket monitor — ultra-minimal mobile scan status
import React, { useEffect, useMemo } from 'react';
import { useScanSocket } from '../hooks/useScanSocket';
import { usePastReports } from '../hooks/usePastReports';
import { useCliConnection } from '../hooks/useCliConnection';
import { BugTraceAILogo } from './Icons.tsx';

const PHASE_LABELS: Record<string, string> = {
  reconnaissance: 'Recon',
  discovery: 'Discovery',
  strategy: 'Strategy',
  exploitation: 'Exploiting',
  validation: 'Validating',
  reporting: 'Reporting',
  complete: 'Complete',
};

const SEV_STYLE: Record<string, string> = {
  critical: 'text-red-300 bg-red-900/40',
  high: 'text-orange-300 bg-orange-900/30',
  medium: 'text-yellow-300 bg-yellow-900/30',
  low: 'text-blue-300 bg-blue-900/30',
};

export const MobileDashboard: React.FC = () => {
  const { progress, pipeline, findings, subscribe, unsubscribe } = useScanSocket();
  const { activeScans, reports, handleStopScan, handlePauseScan, handleResumeScan } = usePastReports();
  const { isConnected: cliConnected, version: cliVersion } = useCliConnection({ autoConnect: true });

  // Auto-subscribe to active scan
  useEffect(() => {
    const running = activeScans.find(s => ['running', 'initializing', 'pending'].includes(s.status));
    if (running) subscribe(running.id);
    else unsubscribe();
  }, [activeScans, subscribe, unsubscribe]);

  const activeScan = activeScans.find(s => ['running', 'initializing', 'pending', 'paused'].includes(s.status));

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(f => { const s = f.severity.toLowerCase(); if (s in c) c[s]++; });
    return c;
  }, [findings]);

  const phaseLabel = PHASE_LABELS[pipeline.currentPhase] || pipeline.currentPhase || '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <BugTraceAILogo className="h-5 w-5" />
          <span className="text-off-white font-bold text-sm tracking-tight">BugTraceAI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${cliConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <a href="/" onClick={() => { try { sessionStorage.setItem('preferDesktop', 'true'); } catch {} }} className="text-[11px] text-ui-accent font-medium px-2.5 py-1 rounded-lg bg-ui-accent/10">
            Desktop
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* Connection */}
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${cliConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className={`text-[11px] ${cliConnected ? 'text-green-400' : 'text-red-400'}`}>
              {cliConnected ? 'CLI Connected' : 'CLI Disconnected'}
            </span>
            {cliVersion && <span className="text-[11px] text-ui-text-dim ml-auto">v{cliVersion}</span>}
          </div>

          {activeScan ? (
            <>
              {/* Scan card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {/* Progress bar (top edge, no label clutter) */}
                <div className="h-1 bg-white/[0.04]">
                  <div className="h-full bg-ui-accent transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
                </div>

                <div className="p-4 space-y-3">
                  {/* Target */}
                  <div className="text-[11px] text-ui-text-dim truncate">{activeScan.target_url}</div>

                  {/* Status row: badge + phase + progress% */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      activeScan.status === 'paused'
                        ? 'bg-yellow-900/40 text-yellow-300'
                        : 'bg-ui-accent/20 text-ui-accent'
                    }`}>
                      {activeScan.status}
                    </span>
                    {phaseLabel && <span className="text-[11px] text-ui-text-dim">{phaseLabel}</span>}
                    <span className="text-[11px] text-off-white font-bold ml-auto">{progress}%</span>
                  </div>

                  {/* Findings inline (only if any) */}
                  {findings.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-ui-text-dim">{findings.length} findings:</span>
                      {Object.entries(sevCounts)
                        .filter(([, n]) => n > 0)
                        .map(([sev, n]) => (
                          <span key={sev} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEV_STYLE[sev] || 'text-gray-300 bg-gray-900/30'}`}>
                            {n} {sev}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Controls — outside the card, breathing room */}
              <div className="flex gap-2.5">
                {activeScan.status === 'running' && (
                  <button
                    onClick={() => handlePauseScan(activeScan.id)}
                    className="flex-1 h-11 rounded-xl bg-yellow-900/20 border border-yellow-500/20 text-yellow-300 text-xs font-bold active:scale-95 transition-transform"
                  >
                    Pause
                  </button>
                )}
                {activeScan.status === 'paused' && (
                  <button
                    onClick={() => handleResumeScan(activeScan.id)}
                    className="flex-1 h-11 rounded-xl bg-green-900/20 border border-green-500/20 text-green-300 text-xs font-bold active:scale-95 transition-transform"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => { if (confirm('Stop this scan?')) handleStopScan(activeScan.id); }}
                  className="flex-1 h-11 rounded-xl bg-red-900/20 border border-red-500/20 text-red-300 text-xs font-bold active:scale-95 transition-transform"
                >
                  Stop
                </button>
              </div>
            </>
          ) : (
            /* Idle */
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl py-12 text-center space-y-2">
              <div className="text-3xl opacity-50">&#128225;</div>
              <div className="text-off-white font-bold text-sm">No active scan</div>
              <div className="text-[11px] text-ui-text-dim">Start a scan from desktop</div>
            </div>
          )}

          {/* Scan complete CTA */}
          {!activeScan && findings.length > 0 && (
            <a href="/" className="block text-center text-[11px] text-ui-accent font-medium py-2">
              View full report on desktop &rarr;
            </a>
          )}

          {/* Past scans — one-liner */}
          {reports.length > 0 && (
            <div className="flex items-center justify-between text-[11px] px-1">
              <span className="text-ui-text-dim">{reports.length} past scan{reports.length !== 1 ? 's' : ''}</span>
              <a href="/" className="text-ui-accent">Desktop &rarr;</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
