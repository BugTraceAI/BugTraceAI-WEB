// components/cli/ScanDashboard.tsx
// Composite dashboard for real-time scan monitoring.
// Combines pipeline progress, agent grid, findings, metrics, and log output.
import React, { useState } from 'react';
import { PipelineBar } from './PipelineBar';
import { ScanConsole } from './ScanConsole';
import { ChevronDownIcon, ChevronUpIcon } from '../Icons';
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
  const [findingsOpen, setFindingsOpen] = useState(false);
  const hasDashboardData = pipeline.currentPhase || agents.length > 0;

  // Filter out Unknowns and reverse: newest first
  const filteredFindings = findings
    .filter(f => f.type?.toLowerCase() !== 'unknown')
    .reverse();

  return (
    <div className="flex flex-col h-full gap-2">
      {/* NEW SUPER BAR: Unified Pipeline + Metrics + Agents-with-findings */}
      {hasDashboardData && (
        <div className="flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] shadow-sm space-y-2">
            {/* Row 1: Pipeline */}
            <PipelineBar pipeline={pipeline} />

            {/* Row 2: Metrics + Agent pills + Findings button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 pr-3 border-r border-white/[0.05] flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted">URLs</span>
                  <span className="text-xs font-mono text-white/80">{metrics.urlsDiscovered}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted">Analyzed</span>
                  <span className="text-xs font-mono text-emerald-400/80">{metrics.urlsAnalyzed}</span>
                </div>
              </div>

              {/* Agent pills — wrap naturally, bar grows taller */}
              <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                {agents.filter(a => a.vulns > 0).map(agent => (
                  <div key={agent.agent} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-red-100/90">{agent.agent}</span>
                    <span className="text-[10px] font-black text-red-500">{agent.vulns}</span>
                  </div>
                ))}
              </div>

              {/* Findings Count Badge as Toggle */}
              {filteredFindings.length > 0 && (
                <button
                  onClick={() => setFindingsOpen(!findingsOpen)}
                  title="Live detections from scanning agents. These are raw signals before final validation."
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-200 flex-shrink-0 ${findingsOpen ? 'bg-coral text-white' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">Findings ({filteredFindings.length})</span>
                  {findingsOpen ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Findings Accordion */}
          {findingsOpen && filteredFindings.length > 0 && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="max-h-[30vh] overflow-y-auto">
                {filteredFindings.map((f, i) => {
                  const sevClass = severityColors[f.severity?.toLowerCase()] || severityColors.info;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 text-[11px] border-b border-white/[0.02] last:border-0 hover:bg-white/[0.03]">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border min-w-[60px] text-center ${sevClass}`}>
                        {f.severity?.toUpperCase() || 'N/A'}
                      </span>
                      <span className="font-bold text-white/90 w-20 truncate">{f.type}</span>
                      {f.parameter && (
                        <span className="text-coral/80 font-mono px-1.5 py-0.5 bg-coral/5 rounded truncate max-w-[120px]">{f.parameter}</span>
                      )}
                      <span className="text-muted truncate flex-1 font-mono opacity-80">{f.url || f.details}</span>
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
