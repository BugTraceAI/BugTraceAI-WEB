// components/MobileDashboard.tsx
// Pocket monitor — ultra-minimal mobile scan status
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useScanSocket } from '../hooks/useScanSocket';
import { usePastReports } from '../hooks/usePastReports';
import { useCliConnection } from '../hooks/useCliConnection';
import { startScan } from '../lib/cliApi.ts';
import { BugTraceAILogo } from './Icons.tsx';
import { APP_VERSION } from '../constants.ts';

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
  info: 'text-gray-400 bg-gray-800/40',
};

export const MobileDashboard: React.FC = () => {
  const { progress, pipeline, findings, agents, metrics, logs, subscribe, unsubscribe } = useScanSocket();
  const { activeScans, reports, handleStopScan, handlePauseScan, handleResumeScan } = usePastReports();
  const { isConnected: cliConnected, version: cliVersion } = useCliConnection({ autoConnect: true });

  const [targetUrl, setTargetUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxUrls, setMaxUrls] = useState(50);
  const [isStarting, setIsStarting] = useState(false);
  const [scanError, setScanError] = useState('');

  const handleStartScan = async () => {
    setScanError('');
    try { new URL(targetUrl); } catch { setScanError('Invalid URL'); return; }
    setIsStarting(true);
    try {
      const res = await startScan({ target_url: targetUrl, max_depth: maxDepth, max_urls: maxUrls });
      subscribe(res.scan_id);
      setTargetUrl('');
    } catch (e: any) {
      setScanError(e.message || 'Failed to start scan');
    } finally {
      setIsStarting(false);
    }
  };

  // Auto-subscribe to active scan (guarded — only when scan ID actually changes)
  const subscribedIdRef = useRef<number | null>(null);
  useEffect(() => {
    const running = activeScans.find(s => ['running', 'initializing', 'pending'].includes(s.status));
    if (running) {
      if (subscribedIdRef.current !== running.id) {
        subscribedIdRef.current = running.id;
        subscribe(running.id);
      }
    } else if (subscribedIdRef.current !== null) {
      subscribedIdRef.current = null;
      unsubscribe();
    }
  }, [activeScans, subscribe, unsubscribe]);

  const activeScan = activeScans.find(s => ['running', 'initializing', 'pending', 'paused'].includes(s.status));

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(f => { const s = (f.severity || 'info').toLowerCase(); if (s in c) c[s]++; });
    return c;
  }, [findings]);

  const [showFindings, setShowFindings] = useState(false);

  const phaseLabel = PHASE_LABELS[pipeline.currentPhase] || pipeline.currentPhase || '';

  const PHASES = ['reconnaissance', 'discovery', 'strategy', 'exploitation', 'validation', 'reporting'] as const;
  const currentIdx = PHASES.indexOf(pipeline.currentPhase as any);

  const activeAgents = useMemo(() =>
    agents.filter(a => a.status === 'active' || a.vulns > 0),
  [agents]);

  const recentLogs = useMemo(() =>
    logs.filter(l => l.level !== 'DEBUG').slice(-5).reverse(),
  [logs]);

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

          {/* Connection + versions */}
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${cliConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className={`text-[11px] ${cliConnected ? 'text-green-400' : 'text-red-400'}`}>
              {cliConnected ? 'CLI Connected' : 'CLI Disconnected'}
            </span>
            <div className="flex items-center gap-2 ml-auto text-[10px] text-ui-text-dim">
              <span>WEB {APP_VERSION}</span>
              {cliVersion && <><span className="opacity-30">|</span><span>CLI {cliVersion}</span></>}
            </div>
          </div>

          {activeScan ? (
            <>
              {/* Scan card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {/* Progress bar (top edge) */}
                <div className="h-1 bg-white/[0.04]">
                  <div className="h-full bg-ui-accent transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
                </div>

                <div className="p-4 space-y-3">
                  {/* Target + progress */}
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-ui-text-dim truncate flex-1 mr-2">{activeScan.target_url}</div>
                    <span className="text-[11px] text-off-white font-bold shrink-0">{progress}%</span>
                  </div>

                  {/* Status badge + phase */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      activeScan.status === 'paused'
                        ? 'bg-yellow-900/40 text-yellow-300'
                        : 'bg-ui-accent/20 text-ui-accent'
                    }`}>
                      {activeScan.status}
                    </span>
                    {phaseLabel && <span className="text-[11px] text-ui-text-dim">{phaseLabel}</span>}
                  </div>

                  {/* Pipeline phases */}
                  <div className="flex items-center gap-1">
                    {PHASES.map((p, i) => {
                      const done = i < currentIdx;
                      const active = i === currentIdx;
                      return (
                        <div key={p} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`h-1.5 w-full rounded-full transition-all ${
                            done ? 'bg-green-500' : active ? 'bg-ui-accent animate-pulse' : 'bg-white/[0.06]'
                          }`} />
                          <span className={`text-[8px] leading-none ${
                            done ? 'text-green-400' : active ? 'text-ui-accent' : 'text-ui-text-dim/50'
                          }`}>
                            {PHASE_LABELS[p]}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Metrics row */}
                  {(metrics.urlsDiscovered > 0 || metrics.urlsAnalyzed > 0) && (
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-ui-text-dim">URLs: <span className="text-off-white font-bold">{metrics.urlsDiscovered}</span></span>
                      <span className="text-ui-text-dim">Analyzed: <span className="text-off-white font-bold">{metrics.urlsAnalyzed}</span></span>
                    </div>
                  )}

                  {/* Active agents */}
                  {activeAgents.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeAgents.map(a => (
                        <span key={a.agent} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === 'active'
                            ? 'bg-ui-accent/15 text-ui-accent border border-ui-accent/20'
                            : 'bg-white/[0.04] text-ui-text-dim border border-white/[0.06]'
                        }`}>
                          {a.agent.replace('Agent', '')}
                          {a.vulns > 0 && <span className="text-red-300 ml-1">{a.vulns}</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Findings summary — tap to expand */}
                  {findings.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowFindings(!showFindings)}
                        className="flex items-center gap-1.5 flex-wrap w-full text-left"
                      >
                        <span className="text-[11px] text-ui-text-dim">{findings.length} findings:</span>
                        {Object.entries(sevCounts)
                          .filter(([, n]) => n > 0)
                          .map(([sev, n]) => (
                            <span key={sev} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SEV_STYLE[sev] || 'text-gray-300 bg-gray-900/30'}`}>
                              {n} {sev}
                            </span>
                          ))}
                        <span className="text-[10px] text-ui-text-dim ml-auto">{showFindings ? '\u25B2' : '\u25BC'}</span>
                      </button>

                      {showFindings && (
                        <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5">
                          {findings.slice().reverse().map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-[10px] py-1 border-t border-white/[0.04] first:border-0">
                              <span className={`shrink-0 font-bold px-1 py-0.5 rounded ${SEV_STYLE[(f.severity || 'info').toLowerCase()] || 'text-gray-300 bg-gray-900/30'}`}>
                                {(f.severity || 'info').slice(0, 4).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-off-white font-bold truncate">{f.type}{f.parameter ? ` \u00B7 ${f.parameter}` : ''}</div>
                                <div className="text-ui-text-dim truncate">{f.url}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Live activity feed */}
              {recentLogs.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-ui-text-dim font-bold uppercase tracking-wider">Live</span>
                  </div>
                  {recentLogs.map((l, i) => (
                    <div key={i} className="text-[10px] leading-relaxed truncate">
                      <span className={
                        l.level === 'CRITICAL' ? 'text-red-300' :
                        l.level === 'ERROR' ? 'text-red-400' :
                        l.level === 'WARNING' ? 'text-yellow-300' :
                        'text-ui-text-dim'
                      }>
                        {l.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}

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
            /* Idle — scan launcher */
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="text-off-white font-bold text-sm">New Scan</div>
              <input
                type="url"
                value={targetUrl}
                onChange={e => { setTargetUrl(e.target.value); setScanError(''); }}
                placeholder="https://example.com"
                className="w-full h-11 px-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-off-white text-sm placeholder:text-ui-text-dim focus:outline-none focus:border-ui-accent"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-ui-text-dim block mb-1">Max Depth</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxDepth}
                    onChange={e => setMaxDepth(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    className="w-full h-9 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-off-white text-sm text-center focus:outline-none focus:border-ui-accent"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-ui-text-dim block mb-1">Max URLs</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={maxUrls}
                    onChange={e => setMaxUrls(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                    className="w-full h-9 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-off-white text-sm text-center focus:outline-none focus:border-ui-accent"
                  />
                </div>
              </div>
              {scanError && <div className="text-[11px] text-red-400">{scanError}</div>}
              <button
                onClick={handleStartScan}
                disabled={!targetUrl.trim() || isStarting || !cliConnected}
                className="w-full h-11 rounded-xl bg-ui-accent text-white text-sm font-bold disabled:opacity-30 active:scale-95 transition-transform"
              >
                {isStarting ? 'Starting...' : 'Start Scan'}
              </button>
              {!cliConnected && (
                <div className="text-[11px] text-red-400 text-center">CLI not connected</div>
              )}
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
