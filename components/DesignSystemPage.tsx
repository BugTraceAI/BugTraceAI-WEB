import React, { useState } from 'react';
import { formatSecretPreview } from '../lib/maskedSecret.ts';
import { SlidingSegmentedControl } from './cli/SlidingSegmentedControl.tsx';
import { ToggleSwitch } from './cli/ToggleSwitch.tsx';

type Segment = 'benchmark' | 'history';
type Engine = 'web' | 'api';

const SectionHeading: React.FC<{ eyebrow: string; title: string; description: string }> = ({ eyebrow, title, description }) => (
  <div className="mb-3">
    <span className="label-mini label-mini-accent">{eyebrow}</span>
    <h2 className="mt-1 text-base font-bold tracking-tight text-ui-text-main">{title}</h2>
    <p className="mt-1 text-xs text-ui-text-muted">{description}</p>
  </div>
);

const Specimen: React.FC<{ label: string; note?: string; children: React.ReactNode }> = ({ label, note, children }) => (
  <div className="card-premium p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="label-mini">{label}</span>
      <span className="badge-mini">Reference</span>
    </div>
    {children}
    {note && <p className="mt-3 text-[11px] leading-relaxed text-ui-text-dim">{note}</p>}
  </div>
);

const StatusBadge: React.FC<{ tone: 'success' | 'warning' | 'error' | 'neutral'; children: React.ReactNode }> = ({ tone, children }) => {
  const toneClass = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    error: 'border-error/30 bg-error/10 text-error',
    neutral: 'border-white/10 bg-white/[0.03] text-ui-text-muted',
  }[tone];
  const dotClass = {
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    neutral: 'bg-ui-text-dim',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${toneClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {children}
    </span>
  );
};

export const DesignSystemPage: React.FC = () => {
  const [segment, setSegment] = useState<Segment>('benchmark');
  const [engine, setEngine] = useState<Engine>('web');
  const [toggleOn, setToggleOn] = useState(true);
  const [model, setModel] = useState('Gemini 3.6 Flash');

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <header className="card-premium flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="label-mini label-mini-accent">BugTraceAI visual language</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ui-text-main">Design System Preview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ui-text-muted">
              A shared reference for controls, typography, surfaces and states. Every specimen is interactive but has no application side effects.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="badge-mini badge-mini-accent">Preview</span>
            <span className="badge-mini">v0.1</span>
          </div>
        </header>

        <section>
          <SectionHeading eyebrow="Controls" title="Switches and selectors" description="The compact control language used for navigation and mode changes." />
          <div className="grid gap-4 md:grid-cols-2">
            <Specimen label="Segmented switch" note="Model Lab reference: one compact group, one clear active state. The coral indicator slides between equal-sized options.">
              <SlidingSegmentedControl
                value={segment}
                onChange={value => setSegment(value as Segment)}
                ariaLabel="Segmented switch preview"
                options={[{ value: 'benchmark', label: 'Benchmark' }, { value: 'history', label: 'History' }]}
              />
            </Specimen>

            <Specimen label="Engine selector" note="The same segmented pattern applied to Scan Web and Scan API.">
              <div className="flex items-center gap-2">
                <span className="label-mini">Engine</span>
              <SlidingSegmentedControl
                  value={engine}
                  onChange={value => setEngine(value as Engine)}
                  ariaLabel="Engine selector preview"
                  options={[{ value: 'web', label: 'Scan Web' }, { value: 'api', label: 'Scan API' }]}
                />
              </div>
            </Specimen>

            <Specimen label="Combo / select" note="Quiet at rest, coral focus ring, readable technical value.">
              <label className="label-mini mb-1.5 block" htmlFor="design-system-model">Select model</label>
              <select id="design-system-model" value={model} onChange={event => setModel(event.target.value)} className="input-premium w-full px-3 py-2.5">
                <option>Gemini 3.6 Flash</option>
                <option>Claude Haiku 4.5</option>
                <option>DeepSeek V4 Pro</option>
              </select>
            </Specimen>

            <Specimen label="Toggle / switch" note="Use for binary settings only; selectors handle mutually exclusive modes.">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ui-text-main">Mutation probe</p>
                  <p className="mt-0.5 text-[11px] text-ui-text-muted">Run optional active checks</p>
                </div>
                <ToggleSwitch checked={toggleOn} onChange={setToggleOn} ariaLabel="Toggle mutation probe" />
              </div>
            </Specimen>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Actions" title="Buttons and actions" description="Primary actions are coral; secondary actions stay quiet and compact." />
          <Specimen label="Action hierarchy">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-mini btn-mini-primary"><span aria-hidden="true">↻</span> Sync</button>
              <button type="button" className="btn-mini btn-mini-secondary">+ URLs</button>
              <button type="button" className="btn-mini btn-mini-secondary !text-error !border-error/30">Stop</button>
              <button type="button" disabled className="btn-mini btn-mini-primary opacity-30">Save Provider</button>
            </div>
          </Specimen>
        </section>

        <section>
          <SectionHeading eyebrow="Forms" title="Inputs and technical data" description="Inputs share one height, focus treatment and label rhythm." />
          <div className="grid gap-4 md:grid-cols-2">
            <Specimen label="Input / idle">
              <label className="label-mini mb-1.5 block" htmlFor="design-system-url">Target URL</label>
              <input id="design-system-url" className="input-premium w-full px-3 py-2.5 font-mono" defaultValue="https://example.com" />
            </Specimen>
            <Specimen label="Input / focus" note="The password field stays masked; a short confirmation preview exposes only the final five characters.">
              <label className="label-mini mb-1.5 block" htmlFor="design-system-key">API key</label>
              <input id="design-system-key" type="password" className="input-premium w-full border-coral px-3 py-2.5 font-mono shadow-[0_0_0_3px_rgba(255,127,80,0.14)]" defaultValue="sk-or-v1-demo-key-abc12" />
              <p className="mt-2 text-[11px] text-ui-text-dim" aria-live="polite">
                Preview: <code className="font-mono text-ui-text-muted">{formatSecretPreview('sk-or-v1-demo-key-abc12')}</code>
              </p>
            </Specimen>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Feedback" title="Statuses and badges" description="Small semantic signals keep the interface scannable without adding noise." />
          <Specimen label="Status scale">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="success">API connected</StatusBadge>
              <StatusBadge tone="success">Ready</StatusBadge>
              <StatusBadge tone="warning">CLI misconfigured</StatusBadge>
              <StatusBadge tone="error">Offline</StatusBadge>
              <StatusBadge tone="neutral">5 events</StatusBadge>
            </div>
          </Specimen>
        </section>

        <section>
          <SectionHeading eyebrow="Surfaces" title="Cards, rows and provider lists" description="Surfaces use the same border, radius and spacing rules across the product." />
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Specimen label="Active provider card">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ui-text-main">OpenRouter</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ui-text-muted">Multi-model routing for broad security analysis.</p>
                  </div>
                  <StatusBadge tone="success">Active</StatusBadge>
                </div>
              </div>
            </Specimen>
            <Specimen label="List rows">
              <div className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                {['OpenRouter', 'Anthropic', 'Local (Ollama)'].map((item, index) => (
                  <button key={item} type="button" className="flex w-full items-center justify-between bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]">
                    <span className="text-sm font-semibold text-ui-text-main">{item}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${index === 0 ? 'text-coral' : 'text-ui-text-dim'}`}>{index === 0 ? 'Recommended' : 'Available'}</span>
                  </button>
                ))}
              </div>
            </Specimen>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Typography" title="Type scale and voice" description="Labels identify; titles orient; body copy explains; monospace marks technical values." />
          <Specimen label="Type specimens">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="label-mini label-mini-accent">Section label</span>
                <p className="title-standard mt-1">Active Provider</p>
                <p className="mt-1 text-sm text-ui-text-muted">Short explanatory copy with a calm, technical tone.</p>
              </div>
              <div>
                <span className="label-mini">Technical value</span>
                <p className="mt-1 font-mono text-sm text-ui-text-main">/btai-api · 8005 · web-api</p>
                <p className="mt-1 text-[11px] text-ui-text-dim">Use monospace for URLs, IDs and configuration values.</p>
              </div>
            </div>
          </Specimen>
        </section>

        <footer className="pb-2 text-center text-[10px] uppercase tracking-[0.16em] text-ui-text-dim">
          Preview only · no application settings are changed
        </footer>
      </div>
    </div>
  );
};
