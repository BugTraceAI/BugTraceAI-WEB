// components/cli/ScanDashboard.tsx
// Composite dashboard for real-time scan monitoring.
// Combines pipeline progress, agent grid, findings, metrics, and log output.
import React from 'react';
import { PipelineBar } from './PipelineBar';
import { AgentGrid } from './AgentGrid';
import { ScanConsole } from './ScanConsole';
import type { LogEntry } from './ScanConsole';
import type { PipelineState, AgentState, MetricsState, Finding } from '../../hooks/useScanSocket';

interface ScanDashboardProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  isConnected: boolean;
  isScanning: boolean;
  pipeline: PipelineState;
  agents: AgentState[];
  metrics: MetricsState;
  findings: Finding[];
}

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const severityColors: Record<string, string> = {
  critical: 'text-red-300 bg-red-900/40 border-red-700/50',
  high: 'text-orange-300 bg-orange-900/30 border-orange-700/40',
  medium: 'text-yellow-300 bg-yellow-900/30 border-yellow-700/40',
  low: 'text-blue-300 bg-blue-900/30 border-blue-700/40',
  info: 'text-gray-400 bg-gray-800/40 border-gray-700/40',
};

export const ScanDashboard: React.FC<ScanDashboardProps> = ({
  logs,
  onClearLogs,
  isConnected,
  isScanning,
  pipeline,
  agents,
  metrics,
  findings,
}) => {
  const hasDashboardData = pipeline.currentPhase || agents.length > 0;

  // Sort findings: most severe first, newest first within same severity
  const sortedFindings = [...findings]
    .sort((a, b) => (severityOrder[a.severity?.toLowerCase()] ?? 5) - (severityOrder[b.severity?.toLowerCase()] ?? 5));

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Pipeline progress bar */}
      {hasDashboardData && (
        <PipelineBar pipeline={pipeline} />
      )}

      {/* Middle section: metrics + agents + findings */}
      {hasDashboardData && (
        <div className="flex flex-col gap-2">
          {/* Metrics row */}
          {(metrics.urlsDiscovered > 0 || metrics.urlsAnalyzed > 0) && (
            <div className="flex items-center gap-4 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">URLs</span>
                <span className="text-xs font-mono text-white/80">{metrics.urlsDiscovered}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted">Analyzed</span>
                <span className="text-xs font-mono text-emerald-400/80">{metrics.urlsAnalyzed}</span>
              </div>
              {findings.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted">Findings</span>
                  <span className="text-xs font-mono text-red-400 font-bold">{findings.length}</span>
                </div>
              )}
            </div>
          )}

          {/* Agent grid */}
          {agents.length > 0 && (
            <AgentGrid agents={agents} />
          )}

          {/* Findings mini-table */}
          {sortedFindings.length > 0 && (
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
              <div className="px-3 py-1.5 border-b border-white/[0.04]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Findings ({sortedFindings.length})
                </span>
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                {sortedFindings.slice(0, 20).map((f, i) => {
                  const sevClass = severityColors[f.severity?.toLowerCase()] || severityColors.info;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1 text-[11px] border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02]">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${sevClass}`}>
                        {f.severity?.toUpperCase() || 'N/A'}
                      </span>
                      <span className="font-semibold text-white/90 w-14 truncate">{f.type}</span>
                      {f.parameter && (
                        <span className="text-coral/80 font-mono truncate max-w-[100px]">{f.parameter}</span>
                      )}
                      <span className="text-muted truncate flex-1">{f.url || f.details}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log console takes remaining space */}
      <div className="flex-1 min-h-0">
        <ScanConsole
          logs={logs}
          onClear={onClearLogs}
          isConnected={isConnected}
          isScanning={isScanning}
        />
      </div>
    </div>
  );
};
