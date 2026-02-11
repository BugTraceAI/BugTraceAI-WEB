// components/cli/AgentGrid.tsx
import React from 'react';
import type { AgentState } from '../../hooks/useScanSocket';

interface AgentGridProps {
  agents: AgentState[];
}

const statusColors: Record<string, string> = {
  active: 'text-coral',
  complete: 'text-emerald-400',
  error: 'text-red-400',
  idle: 'text-white/30',
};

const statusIcons: Record<string, string> = {
  active: '\u25B6',   // play
  complete: '\u2713',  // check
  error: '\u2717',     // cross
  idle: '\u25CB',      // circle
};

export const AgentGrid: React.FC<AgentGridProps> = ({ agents }) => {
  if (agents.length === 0) return null;

  // Sort: active first, then complete, then idle
  const sorted = [...agents].sort((a, b) => {
    const order: Record<string, number> = { active: 0, error: 1, complete: 2, idle: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
      {sorted.map((agent) => {
        const color = statusColors[agent.status] || statusColors.idle;
        const icon = statusIcons[agent.status] || statusIcons.idle;

        return (
          <div
            key={agent.agent}
            className={`
              flex items-center gap-2 px-2.5 py-1.5 rounded-md
              bg-white/[0.02] border border-white/[0.04]
              ${agent.status === 'active' ? 'border-coral/20 bg-coral/[0.03]' : ''}
              ${agent.status === 'complete' && agent.vulns > 0 ? 'border-red-500/20 bg-red-500/[0.03]' : ''}
            `}
          >
            <span className={`text-xs ${color} flex-shrink-0`}>
              {agent.status === 'active' ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral animate-pulse" />
              ) : (
                icon
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold tracking-wider text-white/80 truncate">
                {agent.agent}
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted">
                {agent.queue > 0 && <span>Q:{agent.queue}</span>}
                {agent.processed > 0 && <span className="text-emerald-400/70">{agent.processed}</span>}
                {agent.vulns > 0 && <span className="text-red-400 font-bold">{agent.vulns} vuln{agent.vulns !== 1 ? 's' : ''}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
