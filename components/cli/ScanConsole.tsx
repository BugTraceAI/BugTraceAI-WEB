// components/cli/ScanConsole.tsx
/* eslint-disable max-lines -- CLI scan console component.
 * Real-time WebSocket-based scan output display with animated log streaming.
 * Manages WebSocket lifecycle, log buffering, auto-scroll, and formatting.
 */
import React, { useEffect, useRef, useState } from 'react';
import { TrashIcon, ShareIcon, ListBulletIcon } from '../Icons.tsx';
import { SwarmGraph } from './SwarmGraph.tsx';
import type { PipelineState, AgentState, MetricsState, Finding } from '../../hooks/useScanSocket';

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: string;
}

interface ScanConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  isConnected: boolean;
  isScanning?: boolean;
  pipeline?: PipelineState;
  agents?: AgentState[];
  metrics?: MetricsState;
  findings?: Finding[];
  agentLevels?: Record<string, { level: string; confirmed: boolean }>;
}

const MAX_BUFFER_SIZE = 10000;

// Detect special log messages for visual treatment
function getLogStyle(log: LogEntry): string {
  const msg = log.message;
  if (log.level === 'CRITICAL' || msg.includes('[VULN FOUND]')) return 'log-vuln-found';
  if (msg.includes('[PHASE]') && msg.includes('complete')) return 'log-phase-complete';
  if (log.level === 'ERROR') return 'log-critical';
  return '';
}

function getLogIcon(log: LogEntry): string {
  const msg = log.message;
  if (msg.includes('[SCAN STARTED]')) return '\u{1F680}';
  if (msg.includes('[SCAN COMPLETE]')) return '\u{1F3C6}';
  if (msg.includes('[SCAN PAUSED]')) return '\u23F8\uFE0F';
  if (msg.includes('[SCAN RESUMED]')) return '\u25B6\uFE0F';
  if (msg.includes('[PHASE]')) return '\u2705';
  if (msg.includes('[VULN FOUND]') || log.level === 'CRITICAL') return '\u{1F6A8}';
  if (msg.includes('[SPECIALIST]')) return '\u{1F52C}';
  if (msg.includes('[RECON]')) return '\u{1F4E1}';
  if (msg.includes('[JSOrchestrator]') || msg.includes('[JSAnalysisAgent]')) return '\u{1F4DC}';
  if (msg.includes('[DAST]')) return '\u{1F50D}';
  if (msg.includes('[EXPLOITATION]')) return '\u26A1';
  if (msg.includes('[STRATEGY]')) return '\u{1F9E0}';
  if (msg.includes('[VALIDATION]')) return '\u{1F3AF}';
  if (msg.includes('[REPORTING]')) return '\u{1F4CB}';
  if (msg.includes('[PIPELINE]')) return '\u2699\uFE0F';
  if (msg.includes('[URL]')) return '\u{1F310}';
  if (msg.includes('[AGENT]')) return '\u{1F916}';
  if (msg.includes('[PROGRESS]')) return '\u{1F4CA}';
  if (log.level === 'ERROR') return '\u274C';
  if (log.level === 'WARNING') return '\u26A0\uFE0F';
  return '\u25CF';
}

export const ScanConsole: React.FC<ScanConsoleProps> = ({
  logs,
  onClear,
  isConnected,
  isScanning = false,
  pipeline,
  agents = [],
  metrics,
  findings = [],
  agentLevels = {},
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  // Split "director view" is default: full-bleed cinematic graph + superimposed live events (the technical truth) at once.
  const [view, setView] = useState<'split' | 'graph' | 'events'>('split');
  const consoleRef = useRef<HTMLDivElement>(null);
  const prevLogsLength = useRef(logs.length);

  useEffect(() => {
    if (autoScroll && consoleRef.current && logs.length > prevLogsLength.current) {
      consoleRef.current.scrollTop = 0;
    }
    prevLogsLength.current = logs.length;
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (consoleRef.current) {
      const { scrollTop } = consoleRef.current;
      const isAtTop = scrollTop < 50;
      setAutoScroll(isAtTop);
    }
  };

  const getLevelColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'DEBUG': return 'text-gray-500';
      case 'INFO': return 'text-purple-gray';
      case 'WARNING': return 'text-yellow-300';
      case 'ERROR': return 'text-red-400';
      case 'CRITICAL': return 'text-red-300 font-semibold';
      default: return 'text-purple-gray';
    }
  };

  const getLevelBadge = (level: LogEntry['level']): string => {
    switch (level) {
      case 'DEBUG': return 'bg-gray-800/60 text-gray-500 border-gray-700/50';
      case 'INFO': return 'bg-blue-900/30 text-blue-400 border-blue-800/40';
      case 'WARNING': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40';
      case 'ERROR': return 'bg-red-900/30 text-red-400 border-red-700/40';
      case 'CRITICAL': return 'bg-red-800/50 text-red-200 border-red-600/50';
      default: return 'bg-gray-800/60 text-gray-500 border-gray-700/50';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch { return timestamp; }
  };

  const displayLogs = logs.slice(-MAX_BUFFER_SIZE).reverse();
  const droppedCount = logs.length - displayLogs.length;
  // Idle = nothing to show yet. In Split this avoids a DOUBLE empty state (graph's "No scan running"
  // + the overlay radar): we render one centred radar instead of the graph/overlay panes.
  const idle = !isScanning && displayLogs.length === 0;

  return (
    <div className="flex flex-col h-full console-container shadow-dashboard relative" data-testid="scan-console">
      {/* Scanning scanline effect */}
      {isScanning && isConnected && <div className="scan-line" />}

      {/* Header bar - Silmmer and without redundant buttons */}
      <div className="console-header !py-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isConnected
                ? 'bg-success shadow-lg shadow-success/50'
                : 'bg-muted'
                }`} />
              {isConnected && (
                <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-success radar-ping" />
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${isConnected ? 'text-success/80' : 'text-muted'
              }`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Separator */}
          <span className="text-purple-medium/30">|</span>

          {/* Line count */}
          <span className="text-[10px] text-muted/60 font-mono">
            {displayLogs.length} Events
          </span>

          {/* Scanning indicator */}
          {isScanning && isConnected && (
            <>
              <span className="text-purple-medium/30">|</span>
              <span className="flex items-center gap-1.5 text-[10px] text-coral/80 font-bold uppercase tracking-wider">
                Stream Active
              </span>
            </>
          )}
        </div>

        {/* View toggle: Split (director) / Graph / Events */}
        <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5">
          <button
            onClick={() => setView('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${view === 'split' ? 'bg-coral text-white' : 'text-muted hover:text-white'}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3"><rect x="3" y="4" width="8" height="16" rx="1.5" /><rect x="13" y="4" width="8" height="16" rx="1.5" /></svg> Split
          </button>
          <button
            onClick={() => setView('graph')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${view === 'graph' ? 'bg-coral text-white' : 'text-muted hover:text-white'}`}
          >
            <ShareIcon className="h-3 w-3" /> Graph
          </button>
          <button
            onClick={() => setView('events')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${view === 'events' ? 'bg-coral text-white' : 'text-muted hover:text-white'}`}
          >
            <ListBulletIcon className="h-3 w-3" /> Events
          </button>
        </div>
      </div>

      {/* Console body — director view: full-bleed graph + superimposed events. Idle → ONE centred radar. */}
      <div className="console-body flex-1 min-h-0 relative overflow-hidden" data-testid="scan-console-body">
        {idle ? (
          /* Single centred empty state — no double (graph "No scan running" + overlay radar) */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted select-none" data-testid="scan-console-idle">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border border-purple-medium/40" />
              <div className="absolute inset-3 rounded-full border border-purple-medium/30" />
              <div className="absolute inset-6 rounded-full border border-purple-medium/20" />
              <div className="absolute inset-0 radar-sweep" style={{ transformOrigin: 'center center' }}>
                <div className="absolute top-0 left-1/2 w-px h-1/2 origin-bottom"
                  style={{ background: 'linear-gradient(to top, rgba(255,127,80,0.5), transparent)', boxShadow: '0 0 8px rgba(255,127,80,0.3)' }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-coral shadow-lg shadow-coral/50" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border border-coral/30 radar-ping" />
              </div>
            </div>
            <p className="text-sm text-purple-gray">Awaiting scan data...</p>
            <p className="text-xs mt-1.5 text-muted/70">{isConnected ? 'Connected and ready' : 'Start a scan to begin'}</p>
          </div>
        ) : (
          <>
            {view !== 'events' && (
              <div className="absolute inset-0" data-testid="scan-console-graph">
                <SwarmGraph
                  pipeline={pipeline ?? { currentPhase: '', progress: 0, statusMsg: '' }}
                  agents={agents}
                  findings={findings}
                  metrics={metrics ?? { urlsDiscovered: 0, urlsAnalyzed: 0 }}
                  logs={logs}
                  isScanning={isScanning}
                  agentLevels={agentLevels}
                  reserveRight={view === 'split'}
                />
              </div>
            )}
            {view !== 'graph' && (
              <div
                ref={consoleRef}
                onScroll={handleScroll}
                data-testid="scan-console-logs"
                className={view === 'split' ? 'director-events-overlay' : 'director-events-full'}
              >
                {displayLogs.length > 0 && (
                  <div className="space-y-px">
                    {displayLogs.map((log, index) => {
                      const isNew = index < 3;
                      const isLast = index === 0;
                      const specialStyle = getLogStyle(log);
                      const icon = getLogIcon(log);

                      return (
                        <div
                          key={index}
                          className={`
                            flex items-start gap-2.5 py-1.5 px-3 rounded-lg
                            ${specialStyle}
                            ${isNew ? 'log-entry-animated' : ''}
                            hover:bg-white/[0.04] hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.01)] hover:scale-[1.002] transition-all duration-200
                          `}
                        >
                          {/* Icon */}
                          <span className="text-xs leading-6 select-none w-5 text-center flex-shrink-0" aria-hidden="true">
                            {icon}
                          </span>

                          {/* Timestamp */}
                          <span className="text-[11px] text-gray-600 whitespace-nowrap select-none leading-6 font-mono tabular-nums">
                            {formatTimestamp(log.timestamp)}
                          </span>

                          {/* Level Badge */}
                          <span className={`
                            px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider
                            whitespace-nowrap select-none border leading-4
                            ${getLevelBadge(log.level)}
                          `}>
                            {log.level}
                          </span>

                          {/* Message */}
                          <span className={`flex-1 whitespace-pre-wrap break-all leading-6 ${getLevelColor(log.level)} ${isLast && isScanning ? 'typing-cursor' : ''}`}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
