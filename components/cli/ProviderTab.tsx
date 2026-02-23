// components/cli/ProviderTab.tsx
// version 0.0.3 - Test validates key before Save is enabled
// CLI provider configuration — manages which LLM provider the CLI scanner uses.
// Reads/writes via CLI API: GET /api/provider, GET /api/providers, PUT /api/provider, POST /api/provider/test
import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsProvider.tsx';

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

export function ProviderTab() {
    const { cliUrl, cliConnected } = useSettings();

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
                }
            } catch { /* ignore */ }
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

    if (error) {
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
                        <span className="title-standard">CLI Scanner Configuration</span>
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
                    <button
                        onClick={loadProviderData}
                        className="btn-mini btn-mini-secondary h-9 px-5"
                    >
                        Reload
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave || isSaving}
                        className="btn-mini btn-mini-primary h-9 px-6 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Saving...' : 'Save Provider'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            </div>
        </div>
    );
}
