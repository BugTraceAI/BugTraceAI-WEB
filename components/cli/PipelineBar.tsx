// components/cli/PipelineBar.tsx
import React from 'react';
import type { PipelineState } from '../../hooks/useScanSocket';

const PHASES = [
  { key: 'reconnaissance', label: 'RECON' },
  { key: 'discovery', label: 'DISCOVERY' },
  { key: 'strategy', label: 'STRATEGY' },
  { key: 'exploitation', label: 'EXPLOIT' },
  { key: 'validation', label: 'VALIDATE' },
  { key: 'reporting', label: 'REPORT' },
] as const;

interface PipelineBarProps {
  pipeline: PipelineState;
}

export const PipelineBar: React.FC<PipelineBarProps> = ({ pipeline }) => {
  const currentIdx = PHASES.findIndex(p => p.key === pipeline.currentPhase);
  const isComplete = pipeline.currentPhase === 'complete';

  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      {PHASES.map((phase, idx) => {
        const isDone = isComplete || idx < currentIdx;
        const isActive = !isComplete && idx === currentIdx;
        const isPending = !isComplete && idx > currentIdx;

        return (
          <React.Fragment key={phase.key}>
            {idx > 0 && (
              <div className={`flex-shrink-0 w-4 h-px ${isDone ? 'bg-emerald-500/60' : isActive ? 'bg-coral/40' : 'bg-white/10'}`} />
            )}
            <div className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold tracking-wider transition-all
              ${isDone ? 'text-emerald-400 bg-emerald-500/10' : ''}
              ${isActive ? 'text-coral bg-coral/10 border border-coral/20' : ''}
              ${isPending ? 'text-white/25' : ''}
            `}>
              <span className="flex-shrink-0">
                {isDone && <span>&#10003;</span>}
                {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral animate-pulse" />}
                {isPending && <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/20" />}
              </span>
              <span>{phase.label}</span>
              {isActive && pipeline.progress > 0 && pipeline.progress < 1 && (
                <span className="text-coral/70">{Math.round(pipeline.progress * 100)}%</span>
              )}
            </div>
          </React.Fragment>
        );
      })}
      {pipeline.statusMsg && (
        <>
          <div className="flex-1" />
          <span className="text-[10px] text-muted truncate max-w-[200px]">{pipeline.statusMsg}</span>
        </>
      )}
    </div>
  );
};
