import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, StopIcon, TerminalIcon, TrashIcon } from '../Icons.tsx';
import { useSettings } from '../../contexts/SettingsProvider.tsx';
import { useBtaiApiConnection } from '../../hooks/useBtaiApiConnection.ts';
import { useBtaiApiScan } from '../../hooks/useBtaiApiScan.ts';
import { createBtaiApi } from '../../lib/btaiApi.ts';

const statusLabel = (status: string): string => status.replace(/_/g, ' ');

const phaseLabel = (phase?: string | null): string => {
  const labels: Record<string, string> = {
    discovery: 'Discovery',
    schema_probe: 'Schema probe',
    schema_attack: 'Schema attack',
    blind_attack: 'Blind attack',
    auth_probe: 'Auth probe',
    aggregation: 'Aggregation',
    ai_analysis: 'AI analysis',
    // Older manifests used this internal name. Keep them readable without
    // suggesting that the local Apex/Ollama provider was selected.
    apex_analysis: 'AI analysis',
  };
  if (!phase) return 'Finished';
  return labels[phase.toLowerCase()] || phase.replace(/_/g, ' ');
};

const API_PHASES = [
  { label: 'Discover', keys: ['discovery'] },
  { label: 'Schema', keys: ['schema_probe', 'schema_attack'] },
  { label: 'Probe', keys: ['blind_attack'] },
  { label: 'Auth', keys: ['auth_probe'] },
  { label: 'Aggregate', keys: ['aggregation'] },
  { label: 'AI review', keys: ['ai_analysis', 'apex_analysis'] },
];

interface ApiScanLauncherProps {
  onBusyChange?: (busy: boolean) => void;
  /** A CLI scan owns the shared output surface, so API start must be blocked. */
  blockedByCli?: boolean;
}

export const ApiScanLauncher: React.FC<ApiScanLauncherProps> = ({ onBusyChange, blockedByCli = false }) => {
  const { btaiApiUrl } = useSettings();
  const { isConnected, status: connectionStatus, providerConfigured, refresh } = useBtaiApiConnection({ pollInterval: 30000 });
  const { scan, results, isStarting, isPolling, error, start, stop, clear } = useBtaiApiScan(btaiApiUrl);
  const [target, setTarget] = useState('');
  const [depth, setDepth] = useState<'standard' | 'deep'>('standard');
  const [schemaUrl, setSchemaUrl] = useState('');
  const [authType, setAuthType] = useState<'bearer' | 'basic'>('bearer');
  const [authToken, setAuthToken] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const active = Boolean(scan && !['completed', 'failed', 'stopped', 'cancelled'].includes(scan.status.toLowerCase()));
  const isFinished = Boolean(scan && !active && !isStarting);
  // Completed results are persisted in Reports, so do not keep the terminal
  // status card in the launcher. Failed/stopped scans remain visible so their
  // error state and recovery context are not lost.
  const showStatusCard = Boolean(isStarting || (scan && scan.status.toLowerCase() !== 'completed'));
  const providerUnavailable = isConnected && providerConfigured === false;
  const currentPhase = String(scan?.current_phase || '').toLowerCase();
  const currentPhaseIndex = API_PHASES.findIndex(phase => phase.keys.includes(currentPhase));
  const visualPhaseIndex = currentPhaseIndex >= 0
    ? currentPhaseIndex
    : Math.min(API_PHASES.length - 1, Math.floor((scan?.progress || 0) * API_PHASES.length));
  const showApiAnimation = Boolean(isStarting || active || isPolling);
  useEffect(() => {
    onBusyChange?.(active || isStarting || isPolling);
  }, [active, isStarting, isPolling, onBusyChange]);

  // The status card is rendered below the configuration form. Reveal it as
  // soon as the POST begins so the user gets immediate feedback instead of
  // believing that clicking “Start API scan” did nothing while the API queues.
  useEffect(() => {
    if (!isStarting) return undefined;
    const frame = window.requestAnimationFrame(() => {
      statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isStarting]);
  const validTarget = useMemo(() => {
    try {
      const url = new URL(target);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, [target]);
  const canStart = validTarget && isConnected && !blockedByCli;

  // Rehydrated terminal scans keep their target in the scan record. Restore it
  // into the form so a completed scan still offers a usable launch button after
  // a reload or engine switch.
  useEffect(() => {
    if (!target.trim() && scan?.target) setTarget(scan.target);
  }, [scan?.target, target]);

  const handleStart = async () => {
    setFormError(null);
    if (!validTarget) {
      setFormError('Enter a valid http:// or https:// target URL.');
      return;
    }
    if (blockedByCli) {
      setFormError('A Web / CLI scan is already running. Stop it before starting an API scan.');
      return;
    }
    if (!isConnected) {
      setFormError('BugTraceAI-API is not connected. Check Settings → System Status.');
      return;
    }
    const request = {
      target: target.trim(),
      depth,
      schema_url: schemaUrl.trim() || undefined,
      auth: authToken.trim() ? { type: authType, token: authToken.trim() } : undefined,
      launch_origin: 'web-api' as const,
    };
    await start(request);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2 pb-1" data-testid="api-scan-launcher">

      {providerUnavailable && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[11px] leading-relaxed text-warning" role="alert">
          <span className="font-bold uppercase tracking-[0.1em]">AI provider key not configured.</span>{' '}
          The scan can still run, but the report will be partial — without a provider you may miss more than half of the complete analysis because AI enrichment, prioritisation, and PoC generation are skipped. Configure it in <strong>Provider → API Provider</strong> for the full result.
        </div>
      )}

      {blockedByCli && !active && (
        <div className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-[11px] leading-relaxed text-coral" role="status">
          A Web / CLI scan is currently using the live output channel. Stop it before launching an API scan.
        </div>
      )}

      <div className="card-premium flex-shrink-0 overflow-hidden !rounded-3xl border-white/10">
        <div className="border-b border-white/10 bg-white/[0.025] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-mini label-mini-accent">Scan API</p>
              <p className="mt-1 text-xs text-ui-text-muted">Configure the target contract and optional authentication.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge-mini badge-mini-secondary">Origin: WEB → API</span>
              <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${isConnected ? 'text-success' : 'text-error'}`}>
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success shadow-lg shadow-success/50' : 'bg-error'}`} />
                {isConnected ? (providerUnavailable ? 'API scan-only' : 'API connected') : `API ${connectionStatus || 'offline'}`}
              </span>
              {!isConnected && <button type="button" onClick={() => void refresh()} className="text-[10px] font-bold text-coral underline hover:text-white">Retry</button>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="label-mini mb-1.5 ml-1 block">Target URL <span className="text-coral">*</span></span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input value={target} onChange={event => setTarget(event.target.value)} disabled={active || isStarting} placeholder="https://api.example.com" data-testid="api-scan-target" className="input-premium h-10 min-w-0 flex-1 px-4 py-2.5" type="url" />
              {active || isStarting ? (
                <button type="button" onClick={() => void stop()} disabled={isStarting} data-testid="api-scan-stop-button" className="btn-mini btn-mini-secondary h-10 shrink-0 whitespace-nowrap !text-error border border-error-border/40 disabled:opacity-50">
                  <StopIcon className="mr-2 h-3.5 w-3.5" />Stop
                </button>
              ) : (
                <button type="button" onClick={() => void handleStart()} disabled={!canStart} data-testid="api-scan-start-button" className={`btn-mini h-10 shrink-0 whitespace-nowrap ${canStart ? 'btn-mini-primary shadow-glow-coral' : 'btn-mini-secondary opacity-30 grayscale cursor-not-allowed'}`} title={blockedByCli ? 'Stop the running Web / CLI scan first' : !isConnected ? 'Connect BugTraceAI-API in Settings > System Status' : 'Start API audit'}>
                  <TerminalIcon className="mr-2 h-3.5 w-3.5" />Start Scan
                </button>
              )}
            </div>
            <span className="mt-1.5 block text-[11px] text-ui-text-muted">Base URL of the API to discover and audit.</span>
          </label>
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen(open => !open)}
            aria-expanded={advancedOpen}
            aria-controls="api-advanced-options"
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-left transition-colors hover:border-coral/30 hover:bg-coral/5"
          >
            <span>
              <span className="label-mini block">Advanced options</span>
              <span className="mt-1 block text-[11px] text-ui-text-muted">Discovery depth, schema seeding and target authentication</span>
            </span>
            {advancedOpen ? <ChevronUpIcon className="h-4 w-4 text-muted" /> : <ChevronDownIcon className="h-4 w-4 text-muted" />}
          </button>
        </div>

        {advancedOpen && <div id="api-advanced-options" className="grid grid-cols-1 gap-4 border-t border-white/10 px-5 pb-5 pt-4 md:grid-cols-2">
          <label className="block">
            <span className="label-mini mb-1.5 ml-1 block">Discovery depth</span>
            <select value={depth} onChange={event => setDepth(event.target.value as 'standard' | 'deep')} disabled={active || isStarting} className="input-premium h-10 w-full px-4 py-2.5">
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
            <span className="mt-1.5 block text-[11px] text-ui-text-muted">Standard is recommended for the first pass.</span>
          </label>
          <label className="block">
            <span className="label-mini mb-1.5 ml-1 block">Schema URL <span className="normal-case text-muted/60">(optional)</span></span>
            <input value={schemaUrl} onChange={event => setSchemaUrl(event.target.value)} disabled={active || isStarting} placeholder="https://target/openapi.json" className="input-premium h-10 w-full px-4 py-2.5" type="url" />
            <span className="mt-1.5 block text-[11px] text-ui-text-muted">OpenAPI/Swagger document used to seed discovery.</span>
          </label>
          <label className="block">
            <span className="label-mini mb-1.5 ml-1 block">Target auth <span className="normal-case text-muted/60">(optional)</span></span>
            <select value={authType} onChange={event => setAuthType(event.target.value as 'bearer' | 'basic')} disabled={active || isStarting} className="input-premium h-10 w-full px-4 py-2.5">
              <option value="bearer">Bearer token</option>
              <option value="basic">Basic token</option>
            </select>
            <span className="mt-1.5 block text-[11px] text-ui-text-muted">Authentication scheme sent to the target.</span>
          </label>
          <label className="block">
            <span className="label-mini mb-1.5 ml-1 block">Auth token <span className="normal-case text-muted/60">(optional)</span></span>
            <input value={authToken} onChange={event => setAuthToken(event.target.value)} disabled={active || isStarting} placeholder="Enter token for this scan" className="input-premium h-10 w-full px-4 py-2.5" type="password" autoComplete="off" />
            <span className="mt-1.5 block text-[11px] text-ui-text-muted">Used for this request only; it is never persisted in reports.</span>
          </label>
        </div>}

        {(formError || error) && <p className="mx-5 mb-4 rounded-xl border border-error-border bg-error-bg px-3 py-2 text-xs text-error">{formError || error}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-ui-text-dim">{blockedByCli ? 'Blocked while a Web / CLI scan is running' : isConnected ? (providerUnavailable ? 'Ready — partial report without provider' : 'Ready to start an API audit') : 'Connect the API engine in Settings → System Status'}</p>
          {isFinished && <button type="button" onClick={clear} className="btn-mini btn-mini-secondary h-9 px-5 whitespace-nowrap"><TrashIcon className="mr-2 h-3.5 w-3.5" />Clear</button>}
        </div>
      </div>

      {showStatusCard && (
        <div ref={statusRef} className="card-premium flex-shrink-0 overflow-hidden !rounded-3xl border-white/10" data-testid="api-scan-status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-5 py-4">
            <div><p className="label-mini label-mini-accent">API scan status</p><p className="mt-1 font-mono text-xs text-ui-text-muted">{scan?.scan_id || 'Starting…'} · {scan?.target || target.trim()}</p></div>
            <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isStarting || active ? 'bg-coral/15 text-coral' : scan?.status?.toLowerCase() === 'completed' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>{statusLabel(scan?.status || 'starting')}</span>
          </div>
          {showApiAnimation && (
            <div className="api-scan-visual mx-5 mt-4" aria-label="API scan activity">
              <div className="api-scan-radar" aria-hidden="true">
                <span className="api-scan-radar-ring api-scan-radar-ring-one" />
                <span className="api-scan-radar-ring api-scan-radar-ring-two" />
                <span className="api-scan-radar-sweep" />
                <span className="api-scan-radar-core" />
              </div>
              <div className="api-scan-visual-content">
                <div className="flex items-center justify-between gap-3">
                  <p className="label-mini label-mini-accent">HTTP analysis pipeline</p>
                  <span className="api-scan-live-indicator"><span />LIVE</span>
                </div>
                <p className="mt-1 max-w-xl text-[11px] text-ui-text-muted">Sequential request discovery and evidence correlation for the API target.</p>
                <div className="api-scan-phase-list" aria-label="API scan phases">
                  {API_PHASES.map((phase, index) => (
                    <div key={phase.label} className={`api-scan-phase ${index < visualPhaseIndex ? 'is-complete' : ''} ${index === visualPhaseIndex ? 'is-active' : ''}`}>
                      <span className="api-scan-phase-dot" />
                      <span>{phase.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="px-5 py-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full bg-gradient-to-r from-coral to-orange-400 transition-all duration-500 ${isStarting ? 'w-1/3 animate-pulse' : ''}`} style={isStarting ? undefined : { width: `${Math.max(0, Math.min(100, (scan?.progress || 0) * 100))}%` }} /></div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-ui-text-muted"><span>{isStarting ? 'Starting API scan…' : isPolling ? (phaseLabel(scan?.current_phase) || 'Polling API status…') : phaseLabel(scan?.current_phase)}{scan?.analysis_provider ? ` · ${scan.analysis_provider}${scan.analysis_model ? ` / ${scan.analysis_model.split('/').pop()}` : ''}` : ''}</span><span className="shrink-0">{isStarting ? 'Queued' : `${Math.round((scan?.progress || 0) * 100)}% · ${scan?.findings_count || 0} findings`}</span></div>
            {results && <p className="mt-3 text-xs text-success">Results received: {results.findings?.length || 0} findings and {results.endpoints?.length || 0} endpoints. Open Reports to view the persisted report.</p>}
            {scan?.error && <p className="mt-3 text-xs text-error">{scan.error}</p>}
            {scan?.warning && <p className="mt-3 text-xs text-yellow-300">{scan.warning}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
