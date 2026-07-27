// components/FinisherAssistant.tsx
// "The Finisher" / AI Repeater — Burp/Caido-style MULTI-TAB container.
// Holds up to `maxTabs` independent repeater SESSIONS, each rendered by <RepeaterPane>
// with its own useRepeaterAgent state. Inactive tabs stay MOUNTED (hidden) so a running
// agent loop and edited request/response survive tab switches. Tab list is owned by App
// so "Send to Repeater" accumulates tabs and they persist across view navigation.
import React from 'react';
import { ExploitSeed } from '../types.ts';
import { ArrowPathIcon } from './Icons.tsx';
import { RepeaterPane } from './RepeaterPane.tsx';
import { repeaterTabLabel } from '../services/finisherSeed.ts';

export interface RepeaterTab {
  id: number;
  seed: ExploitSeed | null;
}

interface FinisherAssistantProps {
  tabs: RepeaterTab[];
  activeTabId: number | null;
  maxTabs: number;
  onSelectTab: (id: number) => void;
  onCloseTab: (id: number) => void;
  onNewTab: () => void;
  onShowApiKeyWarning: () => void;
}

export const FinisherAssistant: React.FC<FinisherAssistantProps> = ({
  tabs, activeTabId, maxTabs, onSelectTab, onCloseTab, onNewTab, onShowApiKeyWarning,
}) => {
  const atCap = tabs.length >= maxTabs;

  return (
    <div className="h-full flex flex-col bg-dashboard-bg/40">
      {/* ── Tab bar ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 pt-2 border-b border-glass-border overflow-x-auto">
        {tabs.map((t) => {
          const active = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => onSelectTab(t.id)}
              title={repeaterTabLabel(t.seed)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer text-[12px] whitespace-nowrap border-b-2 transition-colors ${
                active ? 'bg-purple-medium/40 text-white border-coral' : 'text-muted hover:text-white border-transparent'
              }`}
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${active ? 'text-coral' : 'opacity-60'}`} />
              <span className="font-mono max-w-[160px] truncate">{repeaterTabLabel(t.seed)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onCloseTab(t.id); }}
                className="text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                aria-label="Close tab"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          onClick={onNewTab}
          disabled={atCap}
          title={atCap ? `Maximum ${maxTabs} tabs reached` : 'New repeater tab'}
          className="flex-none px-2.5 py-1.5 text-lg leading-none text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ＋
        </button>
        <span className="ml-auto flex-none self-center pr-2 text-[10px] font-mono text-muted/60">{tabs.length}/{maxTabs}</span>
      </div>

      {/* ── Panes (all mounted; only active visible) ──────────── */}
      <div className="flex-1 min-h-0 relative">
        {tabs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral/20 to-purple-accent/20 border border-glass-border flex items-center justify-center mb-3">
              <ArrowPathIcon className="h-6 w-6 text-coral" />
            </div>
            <p className="text-sm text-purple-gray mb-1">No repeater sessions open.</p>
            <p className="text-xs text-muted mb-4 max-w-sm">Use “AIrepeater” on a finding, or open a blank session to paste a request.</p>
            <button onClick={onNewTab} className="text-xs font-bold px-4 py-2 rounded-xl bg-coral text-white hover:bg-coral-hover shadow-glow-coral">＋ New session</button>
          </div>
        ) : (
          tabs.map((t) => (
            <div key={t.id} className={`absolute inset-0 ${t.id === activeTabId ? '' : 'hidden'}`}>
              <RepeaterPane seed={t.seed} tabId={t.id} onShowApiKeyWarning={onShowApiKeyWarning} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
