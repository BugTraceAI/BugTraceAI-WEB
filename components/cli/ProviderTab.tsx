// components/cli/ProviderTab.tsx
// version 0.0.3 - Test validates key before Save is enabled
// Provider configuration for both engines. The WEB/CLI panel keeps its existing
// connector; the API panel talks to BugTraceAI-API and persists its ordered
// primary + fallback model chain through the API REST contract.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettings } from '../../contexts/SettingsProvider.tsx';
import { useBtaiApiConnection } from '../../hooks/useBtaiApiConnection.ts';
import { createBtaiApi, BtaiApiProviderDetail, BtaiApiProviderSummary } from '../../lib/btaiApi.ts';
import { formatSecretPreview } from '../../lib/maskedSecret.ts';
import { CURATED_MODEL_KEYS, curatedModelName } from '../../lib/curatedModels.ts';
import { SlidingSegmentedControl } from './SlidingSegmentedControl.tsx';

interface ProviderPreset {
    provider: string;
    name: string;
    base_url: string;
    models: Record<string, string>;
    features?: { description?: string };
}

interface ProviderListItem {
    id: string;
    name: string;
    recommended?: boolean;
    api_key_configured: boolean;
}

const apiModelLabel = (providerId: string, model: string): string => {
    if (providerId !== 'openrouter') return model;
    const knownLabels: Record<string, string> = {
        'minimax/minimax-m3': 'MiniMax M3',
        'anthropic/claude-haiku-4.5': 'Claude Haiku 4.5',
    };
    return knownLabels[model] || curatedModelName(model);
};

const MODEL_SLOT_COUNT = 3;

/** Keep the UI shape stable while allowing providers with fewer fallbacks. */
const modelChainSlots = (profile?: Pick<BtaiApiProviderSummary, 'model' | 'model_chain'> | null): string[] => {
    const chain = profile?.model_chain?.length ? profile.model_chain : (profile?.model ? [profile.model] : []);
    return Array.from({ length: MODEL_SLOT_COUNT }, (_, index) => chain[index] || '');
};

const sameModelChain = (left: string[], right: string[]): boolean =>
    left.slice(0, MODEL_SLOT_COUNT).every((model, index) => model === (right[index] || '')) &&
    right.slice(0, MODEL_SLOT_COUNT).every((model, index) => model === (left[index] || ''));

function ApiProviderPanel({ apiUrl, isConnected, status, version, refresh }: {
    apiUrl: string;
    isConnected: boolean;
    status: string | null;
    version?: string;
    refresh: () => Promise<void>;
}) {
    const fallbackProfiles: BtaiApiProviderSummary[] = [
        { id: 'openrouter', name: 'OpenRouter', detail: 'Multi-model routing for broad security analysis', recommended: true, models: ['minimax/minimax-m3', ...CURATED_MODEL_KEYS.filter(model => !model.includes('#')), 'anthropic/claude-haiku-4.5'], model_chain: ['minimax/minimax-m3', 'deepseek/deepseek-v4-pro', 'anthropic/claude-haiku-4.5'] },
        { id: 'anthropic', name: 'Anthropic', detail: 'Claude models for long-context reasoning', models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'], model_chain: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] },
        { id: 'zai', name: 'Z.ai', detail: 'GLM models for fast specialist passes', models: ['glm-4.7-flash', 'glm-4.5-flash', 'glm-4.6', 'glm-4.7-flashx', 'glm-5', 'glm-4.7', 'glm-4.5-air', 'glm-4.5-airx', 'glm-4.5'], model_chain: ['glm-4.5'] },
        { id: 'local', name: 'Local', detail: 'Self-hosted provider profile', models: ['apex-master:latest'], model_chain: ['apex-master:latest'] },
    ].map(profile => ({ ...profile, kind: profile.id === 'local' ? 'ollama' : 'openai', base_url: '', model: profile.models?.[0] || '', api_key_configured: false }));
    const client = useMemo(() => createBtaiApi(apiUrl), [apiUrl]);
    const [current, setCurrent] = useState<BtaiApiProviderDetail | null>(null);
    const [profiles, setProfiles] = useState<BtaiApiProviderSummary[]>([]);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>(['', '', '']);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [keyValidated, setKeyValidated] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const availableProfiles = profiles.length ? profiles : fallbackProfiles;
    const selectedProfile = availableProfiles.find(profile => profile.id === selectedProvider);
    const providerReady = Boolean(current && (current.api_key_configured || current.kind === 'ollama'));
    const hasNewKey = apiKeyInput.trim().length > 0;
    const activeModelChain = modelChainSlots(current);
    const modelChanged = !sameModelChain(selectedModels, activeModelChain);
    const providerChanged = Boolean(selectedProvider && selectedProvider !== current?.provider);
    const hasChanges = providerChanged || modelChanged || hasNewKey;
    const selectedProviderHasCredentials = Boolean(selectedProfile?.api_key_configured || selectedProfile?.kind === 'ollama');
    const canSave = Boolean(selectedProvider && hasChanges && (
        ((providerChanged || modelChanged) && selectedProviderHasCredentials) ||
        (hasNewKey && keyValidated)
    ));
    const canTest = !isTesting && Boolean(selectedProvider && (hasNewKey || selectedProfile?.api_key_configured));

    const handleModelSlotChange = (slot: number, value: string) => {
        setSelectedModels(previous => {
            const next = modelChainSlots({ model: previous[0], model_chain: previous });
            next[slot] = value;
            // A model may only occur once in the ordered chain.  If the user
            // selects a model already used by another slot, clear that slot so
            // the request cannot accidentally make duplicate provider calls.
            if (value) {
                next.forEach((model, index) => {
                    if (index !== slot && model === value) next[index] = '';
                });
            }
            return next;
        });
        setMessage(null);
    };

    const loadApiProvider = useCallback(async () => {
        if (!apiUrl || !isConnected) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [currentProvider, providerList] = await Promise.all([client.getProvider(), client.listProviders()]);
            setCurrent(currentProvider);
            setProfiles(providerList);
            setSelectedProvider(currentProvider.provider);
            setSelectedModels(modelChainSlots(currentProvider));
            setMessage(null);
        } catch (loadError: unknown) {
            setMessage({ type: 'error', text: loadError instanceof Error ? loadError.message : 'Could not load API provider configuration.' });
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, client, isConnected]);

    useEffect(() => { void loadApiProvider(); }, [loadApiProvider]);

    const handleTest = async () => {
        if (!selectedProvider) return;
        setIsTesting(true);
        setKeyValidated(false);
        setMessage(null);
        try {
            const result = await client.testProvider({ provider: selectedProvider, model: selectedModels[0], ...(hasNewKey ? { api_key: apiKeyInput.trim() } : {}) });
            setMessage({ type: result.success ? 'success' : 'error', text: result.message });
            setKeyValidated(result.success);
        } catch (testError: unknown) {
            setMessage({ type: 'error', text: testError instanceof Error ? testError.message : 'Could not test API provider.' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!selectedProvider || !canSave) return;
        setIsSaving(true);
        setMessage(null);
        try {
            const saved = await client.updateProvider({ provider: selectedProvider, models: selectedModels.filter(Boolean), ...(hasNewKey ? { api_key: apiKeyInput.trim() } : {}) });
            setCurrent(saved);
            setSelectedProvider(saved.provider);
            setSelectedModels(modelChainSlots(saved));
            setProfiles(await client.listProviders());
            setApiKeyInput('');
            setKeyValidated(false);
            setMessage({ type: 'success', text: 'API provider updated successfully.' });
        } catch (saveError: unknown) {
            setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : 'Could not save API provider.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
            <div className="card-premium overflow-hidden !rounded-3xl border-white/10">
                <div className="px-5 py-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-coral/20 bg-coral/10 text-coral" aria-hidden="true">⌘</div>
                            <span className="title-standard">Active Provider</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-success shadow-lg shadow-success/50' : 'bg-error'}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isConnected ? 'text-success' : 'text-error'}`}>{isConnected ? 'API connected' : `API ${status || 'offline'}`}</span>
                            {!isConnected && <button type="button" onClick={() => void refresh()} className="text-[10px] font-bold text-coral underline">Retry</button>}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div>
                            <p className="text-sm font-bold text-ui-text-main">{current?.name || 'BugTraceAI-API'}</p>
                            <p className="mt-1 text-[11px] text-ui-text-muted">Standalone provider · <code className="text-coral/80">{apiUrl || 'not configured'}</code>{version ? ` · v${version}` : ''}</p>
                        </div>
                        <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isConnected ? providerReady ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}>{isConnected ? providerReady ? 'Ready' : 'Scan-only' : 'Offline'}</span>
                    </div>

                    {isConnected && current && !providerReady && (
                        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning" role="alert">
                            The API engine is reachable, but this provider has no key. Discovery and checks still run, but the report is partial — without a provider you may miss more than half of the complete analysis because AI enrichment, prioritisation, and PoC generation are skipped. Configure and test a key below for the full result.
                        </div>
                    )}

                    <div className="mt-5">
                        <div className="mb-1.5 flex items-center justify-between"><label htmlFor="api-provider-profile" className="label-mini">Switch Provider</label><span className="badge-mini badge-mini-secondary">API runtime</span></div>
                        <select id="api-provider-profile" value={selectedProvider} onChange={event => { const nextProvider = event.target.value; const nextProfile = availableProfiles.find(profile => profile.id === nextProvider); setSelectedProvider(nextProvider); setSelectedModels(modelChainSlots(nextProfile)); setApiKeyInput(''); setKeyValidated(false); setMessage(null); }} disabled={!isConnected || isLoading || isSaving} className="input-premium w-full px-4 py-2.5">
                            {!selectedProvider && <option value="">Connect to load providers</option>}
                            {availableProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}{profile.recommended ? ' (Recommended)' : ''}</option>)}
                        </select>
                        {selectedProfile?.features?.description && <p className="mt-1.5 text-[11px] text-ui-text-muted">{selectedProfile.features.description}</p>}
                    </div>

                    <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="label-mini">API model chain</span>
                            <span className="badge-mini badge-mini-secondary">up to 3 · ordered</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {['Primary model', 'Fallback model 1', 'Fallback model 2'].map((slotLabel, slot) => {
                                const currentValue = selectedModels[slot] || '';
                                const options = (selectedProfile?.models || []).filter(model => model === currentValue || !selectedModels.some((selected, index) => index !== slot && selected === model));
                                return (
                                    <div key={slotLabel} className="min-w-0">
                                        <span className="mb-1 block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ui-text-dim">{slotLabel}</span>
                                        <select
                                            id={`api-provider-model-${slot}`}
                                            aria-label={slotLabel}
                                            value={currentValue}
                                            onChange={event => handleModelSlotChange(slot, event.target.value)}
                                            disabled={!isConnected || isLoading || isSaving || !selectedProfile?.models?.length || (slot > 0 && !selectedModels[0])}
                                            className="input-premium w-full min-w-0 px-3 py-2.5"
                                        >
                                            {slot > 0 && <option value="">No fallback</option>}
                                            {options.map(model => <option key={model} value={model}>{apiModelLabel(selectedProfile?.id || '', model)}</option>)}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-ui-text-dim">The API tries these models in order for AI enrichment and PoC generation. Fallbacks are used only after an error or refusal; discovery and attack tools do not use an LLM.</p>
                    </div>

                    <div>
                        <label htmlFor="api-provider-key" className="label-mini mb-1.5 block">API Key {selectedProfile?.api_key_configured && <span className="ml-1 text-[10px] text-success">(already configured)</span>}</label>
                        <input id="api-provider-key" type="password" value={apiKeyInput} onChange={event => { setApiKeyInput(event.target.value); setKeyValidated(false); setMessage(null); }} disabled={!isConnected || isLoading || isSaving} placeholder={selectedProfile?.api_key_configured ? 'Leave blank to keep current key' : 'Enter API key for this provider'} className="input-premium w-full px-4 py-2.5" autoComplete="off" />
                        {apiKeyInput.trim() && <p className="mt-1.5 text-[11px] text-ui-text-dim" aria-live="polite">Preview: <code className="font-mono text-ui-text-muted">{formatSecretPreview(apiKeyInput)}</code></p>}
                        {!apiKeyInput.trim() && selectedProfile?.api_key_configured && selectedProfile.api_key_hint && <p className="mt-1.5 text-[11px] text-ui-text-dim">Current key: <code className="font-mono text-ui-text-muted">{selectedProfile.api_key_hint}</code></p>}
                        <p className="mt-1.5 text-[11px] text-ui-text-dim">Stored in the API configuration volume, never returned to the browser.</p>
                    </div>

                    <button type="button" onClick={() => void handleTest()} disabled={!isConnected || !canTest} className="w-full rounded-lg border border-coral/40 bg-coral/20 px-4 py-2 text-sm font-semibold text-coral transition-colors hover:bg-coral/30 disabled:cursor-not-allowed disabled:opacity-40">{isTesting ? 'Testing...' : 'Test API Key'}</button>
                    {message && <p className={`text-center text-sm ${message.type === 'success' ? 'text-success' : 'text-error'}`}>{message.text}</p>}

                    <button type="button" onClick={() => void handleSave()} disabled={!isConnected || !canSave || isSaving} className="btn-mini btn-mini-primary h-9 w-full justify-center disabled:cursor-not-allowed disabled:opacity-30">{isSaving ? 'Saving...' : 'Save API Provider'}</button>
                    <p className="text-[11px] text-ui-text-dim">Provider selection and credentials are persisted by BugTraceAI-API; <code className="text-coral/80">APEX_PROVIDER</code> can pin a deployment.</p>
                    </div>
                </div>
            <div className="card-premium px-5 py-3 text-[11px] leading-relaxed text-ui-text-muted">
                API scans from <strong className="text-ui-text-main">Scan Target → Scan API</strong> use this provider and are stored with the <code className="text-coral/80">web-api</code> origin in Reports.
            </div>
        </div>
    );
}

export function ProviderTab() {
    const { cliUrl, cliConnected, btaiApiUrl } = useSettings();
    const [providerEngine, setProviderEngine] = useState<'web' | 'api'>('web');
    const apiConnection = useBtaiApiConnection({ pollInterval: 30000 });

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Current CLI provider state (from GET /api/provider)
    const [activeProvider, setActiveProvider] = useState<string>('');
    const [activePreset, setActivePreset] = useState<ProviderPreset | null>(null);
    const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

    // Available providers list
    const [providers, setProviders] = useState<ProviderListItem[]>([]);

    // Form state
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState('');

    // Test state — key must be tested before save is allowed
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [keyValidated, setKeyValidated] = useState(false);

    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadProviderData = useCallback(async () => {
        if (!cliConnected || !cliUrl) {
            setIsLoading(false);
            setError('CLI is not connected. Start the CLI API server to configure providers.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [providerResp, listResp] = await Promise.all([
                fetch(`${cliUrl}/api/provider`, { signal: AbortSignal.timeout(5000) }),
                fetch(`${cliUrl}/api/providers`, { signal: AbortSignal.timeout(5000) }),
            ]);

            if (!providerResp.ok) throw new Error('Failed to fetch current provider');

            const providerData = await providerResp.json();
            setActiveProvider(providerData.provider);
            setActivePreset(providerData);
            setApiKeyConfigured(!!providerData.api_key_configured);
            setSelectedProvider(providerData.provider);

            if (listResp.ok) {
                const listData: ProviderListItem[] = await listResp.json();
                setProviders(listData);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to connect to CLI API');
        } finally {
            setIsLoading(false);
        }
    }, [cliUrl, cliConnected]);

    useEffect(() => {
        loadProviderData();
    }, [loadProviderData]);

    // Fetch preset when selected provider changes
    useEffect(() => {
        if (!selectedProvider || !cliUrl || !cliConnected) return;
        if (selectedProvider === activeProvider && activePreset) {
            setSelectedPreset(activePreset);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const resp = await fetch(`${cliUrl}/api/providers/${selectedProvider}`, { signal: AbortSignal.timeout(5000) });
                if (cancelled) return;
                if (resp.ok) {
                    const data = await resp.json();
                    setSelectedPreset(data);
                } else {
                    console.warn(`[ProviderTab] Failed to fetch preset for ${selectedProvider}: ${resp.status}`);
                }
            } catch (e) {
                if (!cancelled) {
                    console.warn(`[ProviderTab] Failed to fetch preset for ${selectedProvider}:`, e);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedProvider, cliUrl, cliConnected, activeProvider, activePreset]);

    const handleTestKey = async () => {
        if (!cliUrl) return;
        setIsTesting(true);
        setTestResult(null);
        setKeyValidated(false);
        setSaveMessage(null);
        try {
            const body: Record<string, string> = { provider: selectedProvider };
            if (apiKeyInput.trim()) body.api_key = apiKeyInput.trim();
            const resp = await fetch(`${cliUrl}/api/provider/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(20000),
            });
            if (resp.ok) {
                const data = await resp.json();
                setTestResult({ success: data.success, message: data.message });
                setKeyValidated(data.success);
            } else {
                setTestResult({ success: false, message: 'Could not reach test endpoint.' });
            }
        } catch {
            setTestResult({ success: false, message: 'Could not reach CLI API.' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!cliUrl) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const body: Record<string, string> = { provider: selectedProvider };
            if (apiKeyInput.trim()) body.api_key = apiKeyInput.trim();
            const resp = await fetch(`${cliUrl}/api/provider`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || `Failed with status ${resp.status}`);
            }
            setSaveMessage({ type: 'success', text: 'Provider updated successfully' });
            setApiKeyInput('');
            setKeyValidated(false);
            setTestResult(null);
            await loadProviderData();
        } catch (e: any) {
            setSaveMessage({ type: 'error', text: e.message || 'Failed to save provider' });
        } finally {
            setIsSaving(false);
        }
    };

    // Switching provider only (no new key) = can save directly if key already configured
    const isProviderSwitch = selectedProvider !== activeProvider && !apiKeyInput.trim();
    const hasNewKey = apiKeyInput.trim().length > 0;
    const hasChanges = selectedProvider !== activeProvider || hasNewKey;

    // Save enabled: provider switch with existing key OR new key that passed test
    const canSave = hasChanges && (
        (isProviderSwitch && providers.find(p => p.id === selectedProvider)?.api_key_configured) ||
        (hasNewKey && keyValidated)
    );

    // Test enabled: there's a key to test (new input or existing configured key)
    const canTest = !isTesting && (
        hasNewKey || (selectedProvider === activeProvider && apiKeyConfigured)
    );

    // Reset test state when key input or provider changes
    const resetTestState = () => {
        setTestResult(null);
        setKeyValidated(false);
        setSaveMessage(null);
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-purple-gray">Loading provider configuration...</div>
            </div>
        );
    }

    if (error && providerEngine === 'web') {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-yellow-400">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                </div>
                <p className="text-sm text-ui-text-muted text-center max-w-md">{error}</p>
                <button onClick={loadProviderData} className="btn-mini btn-mini-secondary">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex-shrink-0 flex justify-between items-center p-3 m-4 card-premium !rounded-3xl border-white/10">
                <div className="flex items-center gap-4 ml-3">
                    <div className="flex flex-col">
                        <span className="label-mini label-mini-accent">LLM Provider</span>
                        <span className="title-standard">{providerEngine === 'web' ? 'WEB / CLI Configuration' : 'API Configuration'}</span>
                    </div>
                    {hasChanges && (
                        <span className="badge-mini badge-mini-accent animate-pulse shadow-[0_0_10px_rgba(255,127,80,0.2)]">
                            Unsaved Changes
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 pr-1">
                    {saveMessage && (
                        <span className={`label-mini px-3 py-1.5 rounded-lg border ${saveMessage.type === 'success'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-red-400 bg-red-500/10 border-red-500/20'
                            }`}>
                            {saveMessage.text}
                        </span>
                    )}
                    {providerEngine === 'web' && <>
                        <button onClick={loadProviderData} className="btn-mini btn-mini-secondary h-9 px-5">Reload</button>
                        <button onClick={handleSave} disabled={!canSave || isSaving} className="btn-mini btn-mini-primary h-9 px-6 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed">{isSaving ? 'Saving...' : 'Save Provider'}</button>
                    </>}
                </div>
            </div>

            <div className="mx-4 flex flex-wrap items-center gap-3" role="group" aria-label="Provider engine">
                <span className="label-mini px-1">Provider</span>
                <SlidingSegmentedControl
                    value={providerEngine}
                    onChange={value => setProviderEngine(value as 'web' | 'api')}
                    ariaLabel="Provider engine"
                    testIdPrefix="provider-engine"
                    options={[{ value: 'web', label: 'Web provider' }, { value: 'api', label: 'API provider' }]}
                />
            </div>

            {providerEngine === 'api' ? (
                <ApiProviderPanel apiUrl={btaiApiUrl} isConnected={apiConnection.isConnected} status={apiConnection.status} version={apiConnection.version} refresh={apiConnection.refresh} />
            ) : <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Active Provider Card */}
                <div className="card-premium overflow-hidden">
                    <div className="px-5 py-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-coral/5 border border-coral/10 text-coral">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <span className="title-standard">Active Provider</span>
                        </div>

                        <div className="space-y-4">
                            {/* Current status */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                <div>
                                    <p className="text-sm font-bold text-ui-text-main">
                                        {providers.find(p => p.id === activeProvider)?.name || activeProvider}
                                    </p>
                                    <p className="text-[11px] text-ui-text-muted mt-0.5">
                                        {activePreset?.features?.description || activePreset?.base_url || 'No description'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${apiKeyConfigured
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {apiKeyConfigured ? 'Key Configured' : 'No Key'}
                                    </span>
                                </div>
                            </div>

                            {/* Provider selector */}
                            <div>
                                <label className="label-mini block mb-1.5">Switch Provider</label>
                                <select
                                    value={selectedProvider}
                                    onChange={(e) => {
                                        setSelectedProvider(e.target.value);
                                        setApiKeyInput('');
                                        resetTestState();
                                    }}
                                    className="w-full input-premium p-2"
                                >
                                    {providers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}{p.recommended ? ' (Recommended)' : ''}</option>
                                    ))}
                                </select>
                                {selectedPreset?.features?.description && (
                                    <p className="text-[11px] text-ui-text-muted mt-1.5">
                                        {selectedPreset.features.description}
                                    </p>
                                )}
                            </div>

                            {/* API Key input */}
                            <div>
                                <label className="label-mini block mb-1.5">
                                    API Key {apiKeyConfigured && selectedProvider === activeProvider && (
                                        <span className="text-green-400 text-[10px] ml-1">(already configured)</span>
                                    )}
                                </label>
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    onChange={(e) => {
                                        setApiKeyInput(e.target.value);
                                        resetTestState();
                                    }}
                                    placeholder={apiKeyConfigured && selectedProvider === activeProvider
                                        ? 'Leave blank to keep current key'
                                        : 'Enter API key for this provider'
                                    }
                                    className="w-full input-premium px-4 py-2"
                                />
                                {apiKeyInput.trim() && <p className="text-[11px] text-ui-text-dim mt-1.5" aria-live="polite">Preview: <code className="font-mono text-ui-text-muted">{formatSecretPreview(apiKeyInput)}</code></p>}
                                <p className="text-[11px] text-ui-text-dim mt-1.5">
                                    The key is stored in the CLI's configuration file, not in the browser.
                                </p>
                            </div>

                            {/* Test Key */}
                            <button
                                onClick={handleTestKey}
                                disabled={!canTest}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-coral bg-coral/20 border border-coral/40 rounded-lg hover:bg-coral/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {isTesting ? 'Testing...' : 'Test API Key'}
                            </button>
                            {testResult && (
                                <p className={`text-sm text-center ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {testResult.message}
                                </p>
                            )}
                            {hasNewKey && !keyValidated && !isTesting && !testResult && (
                                <p className="text-[11px] text-yellow-400/80 text-center">
                                    Test the API key before saving.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info card */}
                <div className="card-premium overflow-hidden">
                    <div className="px-5 py-4">
                        <p className="text-[11px] text-ui-text-muted leading-relaxed">
                            This configures the LLM provider used by the <strong className="text-ui-text-main">CLI scanner</strong> for vulnerability analysis.
                            <strong className="text-ui-text-main"> OpenRouter is recommended</strong> — it routes each scanning task to the best model across multiple providers (Qwen, Grok, Gemini, DeepSeek).
                            The CLI stores the API key securely in its own configuration file (<code className="text-coral/80">bugtraceaicli.conf</code>).
                        </p>
                    </div>
                </div>
            </div>}
        </div>
    );
}
