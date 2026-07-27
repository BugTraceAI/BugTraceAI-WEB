// components/SettingsModal.tsx
// version 0.0.55 - OpenRouter recommended flag; updated provider descriptions
/* eslint-disable max-lines -- Settings modal component (380 lines).
 * API configuration form with key validation, model selection, and caching.
 * Includes OpenRouter model fetching, cache management, key testing, and CLI connector.
 * Form-heavy component with validation logic - splitting would fragment settings flow.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, CogIcon, CheckCircleIcon, ArrowPathIcon } from './Icons.tsx';
import { Spinner } from './Spinner.tsx';
import { useSettings } from '../contexts/SettingsProvider.tsx';
import { testApi } from '../services/Service.ts';
import {
    testCliConnection,
    testBackendConnection,
    type CliConnectionResult,
    type BackendHealthResult,
} from '../services/cliConnector.ts';
import { OPEN_ROUTER_MODELS } from '../constants.ts';
import { CURATED_MODEL_KEYS, DEFAULT_CHAT_MODEL_KEY, curatedModelName } from '../lib/curatedModels.ts';
import type { ApiKeys } from '../types.ts';
import { WEB_PROVIDER_CONFIGS } from '../lib/providers.ts';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'api' | 'visuals' | 'status' | 'danger' | 'chat';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
    const {
        apiKeys: globalApiKeys, setApiKeys: setGlobalApiKeys,
        openRouterModel: globalOpenRouterModel, setOpenRouterModel: setGlobalOpenRouterModel,
        saveApiKeys: globalSaveApiKeys, setSaveApiKeys: setGlobalSaveApiKeys,
        providerId: globalProviderId, setProviderId: setGlobalProviderId,
        cliUrl, setCliUrl, cliConnected, cliVersion, setCli,
        maxToolHops: globalMaxToolHops, setMaxToolHops: setGlobalMaxToolHops,
    } = useSettings();

    // Tab state
    const [activeTab, setActiveTab] = useState<'api' | 'status' | 'danger' | 'chat'>(initialTab && initialTab !== 'visuals' ? initialTab : 'api');

    // Sync active tab when modal opens with initialTab
    useEffect(() => {
        if (isOpen && initialTab && initialTab !== 'visuals') {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Local state for the modal form
    const [localApiKeys, setLocalApiKeys] = useState<ApiKeys>(globalApiKeys);
    const [localOpenRouterModel, setLocalOpenRouterModel] = useState(globalOpenRouterModel);
    const [localSaveApiKeys, setLocalSaveApiKeys] = useState(globalSaveApiKeys);
    const [localMaxToolHops, setLocalMaxToolHops] = useState(globalMaxToolHops);

    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
    const [isKeyValidated, setIsKeyValidated] = useState(false);
    const openRouterInputRef = useRef<HTMLInputElement>(null);

    // Provider state
    const [localProviderId, setLocalProviderId] = useState(globalProviderId);

    // OpenRouter model picker — loads the curated pack (lib/curatedModels.ts), not the live catalog.
    const [openRouterModels, setOpenRouterModels] = useState<string[]>(CURATED_MODEL_KEYS);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

    // System Status state
    const [isTestingBackend, setIsTestingBackend] = useState(false);
    const [isTestingCli, setIsTestingCli] = useState(false);
    const [backendStatus, setBackendStatus] = useState<BackendHealthResult | null>(null);
    const [cliStatus, setCliStatus] = useState<CliConnectionResult | null>(null);

    // Database config state
    const [dbConfig, setDbConfig] = useState({
        host: 'localhost',
        port: '5432',
        database: 'bugtraceai_web',
        user: 'bugtraceai',
    });

    // Danger Zone state
    const [dangerConfirmation, setDangerConfirmation] = useState('');
    const [showDangerConfirm, setShowDangerConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [clearResult, setClearResult] = useState<{ success: boolean; message: string; deleted?: any } | null>(null);

    // Sync local state with global context when modal opens or global state changes
    useEffect(() => {
        if (isOpen) {
            setLocalApiKeys(globalApiKeys);
            // Snap the stored model to the ACTIVE provider on open — a model saved under one
            // provider must not leak into another's picker as an unlisted value (which the
            // browser renders as the first option while state still holds the wrong id, so a
            // blind Save would persist a model that doesn't belong to the provider).
            const cfg = WEB_PROVIDER_CONFIGS[globalProviderId];
            if (cfg?.defaultModel) {
                // non-OpenRouter: keep a provider-native id (no "/"), else the provider default
                setLocalOpenRouterModel(
                    globalOpenRouterModel && !globalOpenRouterModel.includes('/')
                        ? globalOpenRouterModel : cfg.defaultModel
                );
            } else {
                // OpenRouter: keep only if it's in the curated pack
                setLocalOpenRouterModel(
                    CURATED_MODEL_KEYS.includes(globalOpenRouterModel) ? globalOpenRouterModel : DEFAULT_CHAT_MODEL_KEY
                );
            }
            setLocalSaveApiKeys(globalSaveApiKeys);
            setLocalMaxToolHops(globalMaxToolHops);
            setTestResult(null);
            // If the active provider already has a key saved, mark as validated
            const existingKey = globalProviderId === 'openrouter'
                ? globalApiKeys.openrouter
                : (globalApiKeys[globalProviderId] || '');
            setIsKeyValidated(!!existingKey.trim());
            // Reset system status
            setBackendStatus(null);
            setCliStatus(null);
            // Reset danger zone state
            setDangerConfirmation('');
            setShowDangerConfirm(false);
            setClearResult(null);
        }
    }, [isOpen, globalApiKeys, globalOpenRouterModel, globalSaveApiKeys, globalMaxToolHops]);

    // Sync local provider ID when modal opens
    useEffect(() => {
        if (isOpen) setLocalProviderId(globalProviderId);
    }, [isOpen, globalProviderId]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                openRouterInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // The OpenRouter picker loads the curated pack from lib/curatedModels.ts (a hand-picked,
    // verified set) instead of the ~340-model live catalog. If the stored model isn't in the
    // pack (e.g. an older saved value), snap to the curated default.
    const fetchOpenRouterModels = useCallback(async () => {
        setFetchModelsError(null);
        setIsFetchingModels(false);
        setOpenRouterModels(CURATED_MODEL_KEYS);
        if (!CURATED_MODEL_KEYS.includes(localOpenRouterModel)) {
            setLocalOpenRouterModel(DEFAULT_CHAT_MODEL_KEY);
        }
    }, [localOpenRouterModel]);

    useEffect(() => {
        if (isOpen && localProviderId === 'openrouter') {
            fetchOpenRouterModels();
        }
    }, [isOpen, localProviderId, fetchOpenRouterModels]);

    const handleSaveSettings = () => {
        const activeKey = localProviderId === 'openrouter'
            ? localApiKeys.openrouter
            : (localApiKeys[localProviderId] || '');
        // Only require validation if a key is actually present. Allows saving an empty key.
        if (activeKey.trim() && !isKeyValidated) {
            setTestResult({ success: false, message: 'Please validate the new API key successfully before saving.' });
            return;
        }
        setGlobalApiKeys(localApiKeys);
        setGlobalOpenRouterModel(localOpenRouterModel);
        setGlobalSaveApiKeys(localSaveApiKeys);
        setGlobalProviderId(localProviderId);
        setGlobalMaxToolHops(localMaxToolHops);
        onClose();
    };

    const handleTestBackend = async () => {
        setIsTestingBackend(true);
        try {
            const result = await testBackendConnection();
            setBackendStatus(result);
            // Update dbConfig with actual values from backend
            if (result.database.host) {
                setDbConfig({
                    host: result.database.host,
                    port: result.database.port || '5432',
                    database: result.database.database || 'bugtraceai_web',
                    user: result.database.user || 'bugtraceai',
                });
            }
        } catch {
            setBackendStatus({
                connected: false,
                status: 'unreachable',
                database: { connected: false },
                error: 'Unexpected error',
            });
        } finally {
            setIsTestingBackend(false);
        }
    };

    const handleTestCli = async () => {
        setIsTestingCli(true);
        try {
            const result = await testCliConnection(cliUrl);
            setCliStatus(result);

            // Update CLI context with connection status
            if (result.connected) {
                setCli({
                    connected: true,
                    status: result.status,
                    version: result.version,
                    dockerAvailable: result.dockerAvailable,
                });
            } else {
                setCli({
                    connected: false,
                    status: result.status,
                    version: undefined,
                    dockerAvailable: undefined,
                });
            }
        } catch {
            setCliStatus({
                connected: false,
                status: 'unreachable',
                error: 'Unexpected error',
            });
            setCli({ connected: false, status: 'unreachable', version: undefined, dockerAvailable: undefined });
        } finally {
            setIsTestingCli(false);
        }
    };

    const handleTestAll = async () => {
        await Promise.all([handleTestBackend(), handleTestCli()]);
    };

    const handleClearAll = async () => {
        setIsClearing(true);
        setClearResult(null);
        try {
            // Clear WEB backend data
            const webResponse = await fetch('/api/settings/danger-zone/clear-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation: 'Delete All' }),
            });

            if (!webResponse.ok) {
                const error = await webResponse.json();
                throw new Error(error.error?.message || 'Failed to clear WEB data');
            }

            const webResult = await webResponse.json();

            // Also try to clear CLI scans if connected
            let cliCleared = 0;
            if (cliConnected && cliUrl) {
                try {
                    // List all scans and delete them
                    const listResponse = await fetch(`${cliUrl}/api/scans`);
                    if (listResponse.ok) {
                        const listData = await listResponse.json();
                        for (const scan of listData.scans || []) {
                            try {
                                await fetch(`${cliUrl}/api/scans/${scan.scan_id}`, { method: 'DELETE' });
                                cliCleared++;
                            } catch { /* Ignore individual scan delete errors */ }
                        }
                    }
                } catch { /* CLI cleanup is optional */ }
            }

            setClearResult({
                success: true,
                message: 'All data cleared successfully! Redirecting...',
                deleted: { ...webResult.data?.deleted, cliScans: cliCleared },
            });
            setShowDangerConfirm(false);
            setDangerConfirmation('');
            
            // Redirect to home and reload to clear application state
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } catch (error: any) {
            setClearResult({
                success: false,
                message: error.message || 'Failed to clear data',
            });
        } finally {
            setIsClearing(false);
        }
    };

    const handleTestApi = async () => {
        const keyToTest = localProviderId === 'openrouter'
            ? localApiKeys.openrouter
            : (localApiKeys[localProviderId] || '');

        // Use first model from provider's list (cheapest/most accessible) to validate the key
        // Falls back to selected model for providers with dynamic lists (e.g. OpenRouter)
        const providerConfig = WEB_PROVIDER_CONFIGS[localProviderId];
        const modelToTest = providerConfig?.models[0] || localOpenRouterModel;
        const urlToTest = providerConfig?.baseUrl;

        if (!keyToTest) {
            setTestResult({ success: false, message: 'API Key must be provided.' });
            return;
        }
        setIsKeyValidated(false);
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await testApi(keyToTest, modelToTest, urlToTest);
            setTestResult({ success: result.success, message: result.success ? 'API connection successful!' : `Test failed: ${result.error}` });
            if (result.success) {
                setIsKeyValidated(true);
            }
        } catch (error) {
            console.error('API test failed:', error);
            setTestResult({ success: false, message: 'API test failed due to an unexpected error.' });
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    const currentKey = localProviderId === 'openrouter'
        ? localApiKeys.openrouter
        : (localApiKeys[localProviderId] || '');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} aria-modal="true" role="dialog">
            <div className="card-premium w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 p-4 border-b border-ui-border bg-black/20">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-ui-accent/10 border border-ui-accent/20">
                                <CogIcon className="h-4 w-4 text-ui-accent" />
                            </div>
                            <div className="flex flex-col">
                                <span className="label-mini !text-ui-accent/70">System</span>
                                <h2 className="title-standard">Settings</h2>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-ui-text-muted hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-white/10">
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => setActiveTab('api')}
                            className={`btn-mini ${activeTab === 'api'
                                ? 'btn-mini-primary'
                                : 'btn-mini-secondary'
                                }`}
                        >
                            API Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`btn-mini ${activeTab === 'chat'
                                ? 'btn-mini-primary'
                                : 'btn-mini-secondary'
                                }`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('status')}
                            className={`btn-mini ${activeTab === 'status'
                                ? 'btn-mini-primary'
                                : 'btn-mini-secondary'
                                }`}
                        >
                            System Status
                            {cliConnected && (
                                <span className="ml-2 w-2 h-2 rounded-full bg-success inline-block shadow-glow-success" title="CLI Connected" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('danger')}
                            className={`btn-mini transition-colors ${activeTab === 'danger'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'text-ui-text-dim hover:text-red-400 hover:bg-red-500/10'
                                }`}
                        >
                            Danger Zone
                        </button>
                    </div>
                </header>
                <main className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {activeTab === 'api' && (
                        <>
                            {/* Provider Selector */}
                            <div>
                                <label className="label-mini block mb-1">LLM Provider</label>
                                <select
                                    value={localProviderId}
                                    onChange={(e) => {
                                        const newProvider = e.target.value;
                                        setLocalProviderId(newProvider);
                                        setTestResult(null);
                                        // A provider that already has a saved key was validated when it was
                                        // saved — don't force re-validation just for toggling the dropdown
                                        // (that blocked Save for an already-working key). Only an unkeyed
                                        // provider still needs a test. Mirrors the open-time seeding above.
                                        const existingKey = newProvider === 'openrouter'
                                            ? localApiKeys.openrouter
                                            : (localApiKeys[newProvider] || '');
                                        setIsKeyValidated(!!(existingKey || '').trim());
                                        const cfg = WEB_PROVIDER_CONFIGS[newProvider];
                                        if (cfg?.defaultModel) {
                                            setLocalOpenRouterModel(cfg.defaultModel);
                                        } else {
                                            // For OpenRouter: keep the stored model only if it's in the curated pack.
                                            const stored = globalOpenRouterModel;
                                            setLocalOpenRouterModel(CURATED_MODEL_KEYS.includes(stored) ? stored : DEFAULT_CHAT_MODEL_KEY);
                                        }
                                    }}
                                    className="w-full input-premium p-2"
                                >
                                    {Object.entries(WEB_PROVIDER_CONFIGS).map(([id, cfg]) => (
                                        <option key={id} value={id}>{cfg.name}{cfg.recommended ? ' (Recommended)' : ''}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted mt-1">
                                    {WEB_PROVIDER_CONFIGS[localProviderId]?.description || 'Direct API access.'}
                                </p>
                            </div>

                            {/* OpenRouter-specific settings */}
                            {localProviderId === 'openrouter' && (
                                <>
                                    <div>
                                        <label htmlFor="openrouterApiKey" className="label-mini block mb-1">
                                            OpenRouter API Key
                                        </label>
                                        <div className="relative">
                                            <input
                                                ref={openRouterInputRef}
                                                id="openrouterApiKey"
                                                type="password"
                                                value={localApiKeys.openrouter}
                                                onChange={(e) => {
                                                    setLocalApiKeys({ ...localApiKeys, openrouter: e.target.value });
                                                    setIsKeyValidated(false);
                                                    setTestResult(null);
                                                }}
                                                placeholder="Enter your OpenRouter key (sk-or-v1...)"
                                                className="w-full input-premium px-4 py-2"
                                            />
                                            {isKeyValidated && localApiKeys.openrouter && (
                                                <CheckCircleIcon className="absolute top-1/2 right-3 -translate-y-1/2 h-6 w-6 text-green-400" title="This key has been validated." />
                                            )}
                                        </div>
                                        {localApiKeys.openrouter && localApiKeys.openrouter.length >= 4 && (
                                            <p className="text-xs text-ui-text-dim mt-1 font-mono">Key: ····{localApiKeys.openrouter.slice(-4)}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="model-select" className="label-mini block mb-1">
                                            Select Model
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <select
                                                id="model-select"
                                                value={localOpenRouterModel}
                                                onChange={(e) => setLocalOpenRouterModel(e.target.value)}
                                                className="flex-1 input-premium p-2"
                                                disabled={isFetchingModels}
                                            >
                                                {openRouterModels.map(model => (
                                                    <option key={model} value={model}>{curatedModelName(model)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs text-muted mt-2">
                                            <strong className="text-coral">Curated pack:</strong> a hand-picked set of OpenRouter models. <code>Thinking</code>/<code>High</code> entries enable that model's reasoning for chat. Edit <code>lib/curatedModels.ts</code> to change the list.
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Z.ai-specific settings */}
                            {/* Generic block for any non-OpenRouter provider (Z.ai, Anthropic, …),
                                driven by its preset config — one block, no per-provider duplication. */}
                            {localProviderId !== 'openrouter' && WEB_PROVIDER_CONFIGS[localProviderId] && (() => {
                                const cfg = WEB_PROVIDER_CONFIGS[localProviderId];
                                const key = localApiKeys[localProviderId] || '';
                                return (
                                    <>
                                        <div>
                                            <label htmlFor="customApiKey" className="label-mini block mb-1">
                                                {cfg.keyLabel || `${cfg.name} API Key`}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    id="customApiKey"
                                                    type="password"
                                                    value={key}
                                                    onChange={(e) => {
                                                        setLocalApiKeys({ ...localApiKeys, [localProviderId]: e.target.value });
                                                        setIsKeyValidated(false);
                                                        setTestResult(null);
                                                    }}
                                                    placeholder={cfg.keyPlaceholder || 'Enter API key for this provider'}
                                                    className="w-full input-premium px-4 py-2"
                                                />
                                                {isKeyValidated && key && (
                                                    <CheckCircleIcon className="absolute top-1/2 right-3 -translate-y-1/2 h-6 w-6 text-green-400" title="This key has been validated." />
                                                )}
                                            </div>
                                            {key && key.length >= 4 && (
                                                <p className="text-xs text-ui-text-dim mt-1 font-mono">Key: ····{key.slice(-4)}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label htmlFor="custom-model-select" className="label-mini block mb-1">
                                                Select Model
                                            </label>
                                            <select
                                                id="custom-model-select"
                                                value={localOpenRouterModel}
                                                onChange={(e) => setLocalOpenRouterModel(e.target.value)}
                                                className="w-full input-premium p-2"
                                            >
                                                {cfg.models.map((model) => (
                                                    <option key={model} value={model}>{model}</option>
                                                ))}
                                            </select>
                                            {cfg.recommendation && (
                                                <p className="text-xs text-muted mt-2">
                                                    <strong className="text-coral">Recommendation:</strong> {cfg.recommendation}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Test button + Save checkbox (shared across providers) */}
                            <div>
                                <button
                                    onClick={handleTestApi}
                                    disabled={isTesting || !currentKey}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-coral bg-coral/20 border border-coral/40 rounded-lg hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
                                >
                                    {isTesting ? <Spinner /> : 'Test API Connection'}
                                </button>
                                {testResult && (
                                    <p className={`mt-3 text-sm text-center ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                        {testResult.message}
                                    </p>
                                )}
                            </div>

                            <div className="relative flex items-start">
                                <div className="flex items-center h-5">
                                    <input
                                        id="save-api-keys"
                                        name="save-api-keys"
                                        type="checkbox"
                                        checked={localSaveApiKeys}
                                        onChange={(e) => setLocalSaveApiKeys(e.target.checked)}
                                        className="focus:ring-coral h-4 w-4 text-coral-active border-0 rounded bg-purple-light"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label htmlFor="save-api-keys" className="label-mini !text-ui-text-main">
                                        Save API key in your browser
                                    </label>
                                    <p className="text-[10px] text-ui-text-dim">The key will be stored in localStorage. Use this only on a trusted device.</p>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'chat' && (
                        <div className="space-y-6">
                            {/* Circuit Breaker */}
                            <div>
                                <label htmlFor="max-tool-hops" className="label-mini block mb-1">
                                    Circuit Breaker — Max Tool Hops
                                </label>
                                <input
                                    id="max-tool-hops"
                                    type="number"
                                    min={1}
                                    max={50}
                                    value={localMaxToolHops}
                                    onChange={(e) => {
                                        const n = parseInt(e.target.value, 10);
                                        if (Number.isFinite(n)) setLocalMaxToolHops(Math.min(50, Math.max(1, n)));
                                        else setLocalMaxToolHops(1);
                                    }}
                                    className="w-full input-premium p-2"
                                />
                                <p className="text-xs text-muted mt-2">
                                    Maximum consecutive tool-call rounds (e.g. chained cURL requests) the WebSec Agent
                                    runs before stopping with <em>"Max tool execution depth reached"</em>. Higher = the
                                    agent can chain more probes per turn; lower = tighter loop protection. Default <strong className="text-coral">15</strong>. Range 1–50.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'status' && (
                        <div className="space-y-4">
                            {/* Test All Button */}
                            <button
                                onClick={handleTestAll}
                                disabled={isTestingBackend || isTestingCli}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-coral bg-coral/20 border border-coral/40 rounded-lg hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
                            >
                                {(isTestingBackend || isTestingCli) ? <Spinner /> : 'Test All Connections'}
                            </button>

                            {/* Backend Section */}
                            <div className="p-3 rounded-lg border border-purple-light/50 bg-purple-deep/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-off-white">WEB Backend</p>
                                    <button
                                        onClick={handleTestBackend}
                                        disabled={isTestingBackend}
                                        className="px-3 py-1 text-xs font-medium text-coral bg-coral/20 border border-coral/30 rounded hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
                                    >
                                        {isTestingBackend ? <Spinner /> : 'Test'}
                                    </button>
                                </div>

                                {backendStatus && (
                                    <div className={`p-2 rounded border ${backendStatus.connected
                                        ? 'bg-green-900/20 border-green-500/30'
                                        : 'bg-red-900/20 border-red-500/30'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-medium text-purple-gray">Status</p>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${backendStatus.connected
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {backendStatus.connected ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        {backendStatus.connected ? (
                                            <div className="text-xs text-purple-gray mt-1 flex gap-4">
                                                <span>Env: <span className="text-off-white">{backendStatus.environment}</span></span>
                                                <span>Uptime: <span className="text-off-white">{Math.floor(backendStatus.uptime || 0)}s</span></span>
                                                <span>Latency: <span className="text-off-white">{backendStatus.latencyMs}ms</span></span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-red-300 mt-1">{backendStatus.error}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Database Section */}
                            <div className="p-3 rounded-lg border border-purple-light/50 bg-purple-deep/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-off-white">PostgreSQL Database</p>
                                    {backendStatus?.database && (
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${backendStatus.database.connected
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {backendStatus.database.connected ? 'Connected' : 'Disconnected'}
                                        </span>
                                    )}
                                </div>

                                {/* Database Config Inputs */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Host</label>
                                        <input
                                            type="text"
                                            value={dbConfig.host}
                                            onChange={(e) => setDbConfig(prev => ({ ...prev, host: e.target.value }))}
                                            placeholder="localhost"
                                            className="w-full text-xs input-premium px-2 py-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Port</label>
                                        <input
                                            type="text"
                                            value={dbConfig.port}
                                            onChange={(e) => setDbConfig(prev => ({ ...prev, port: e.target.value }))}
                                            placeholder="5432"
                                            className="w-full text-xs input-premium px-2 py-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">Database</label>
                                        <input
                                            type="text"
                                            value={dbConfig.database}
                                            onChange={(e) => setDbConfig(prev => ({ ...prev, database: e.target.value }))}
                                            placeholder="bugtraceai_web"
                                            className="w-full text-xs input-premium px-2 py-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted mb-1">User</label>
                                        <input
                                            type="text"
                                            value={dbConfig.user}
                                            onChange={(e) => setDbConfig(prev => ({ ...prev, user: e.target.value }))}
                                            placeholder="bugtraceai"
                                            className="w-full text-xs input-premium px-2 py-1"
                                        />
                                    </div>
                                </div>


                                {/* Database Stats */}
                                {backendStatus?.database?.connected && backendStatus.database.stats && (
                                    <div className="p-2 rounded border bg-green-900/20 border-green-500/30">
                                        <p className="text-xs font-medium text-purple-gray mb-1">Statistics</p>
                                        <div className="text-xs text-purple-gray grid grid-cols-2 gap-x-4">
                                            <span>Sessions: <span className="text-off-white">{backendStatus.database.stats.chatSessions}</span></span>
                                            <span>Messages: <span className="text-off-white">{backendStatus.database.stats.chatMessages}</span></span>
                                            <span>Reports: <span className="text-off-white">{backendStatus.database.stats.analysisReports}</span></span>
                                            <span>CLI Reports: <span className="text-off-white">{backendStatus.database.stats.cliReports}</span></span>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-muted">
                                    Database config is set via backend .env file. Changes here are for reference only.
                                </p>
                            </div>

                            {/* CLI Section */}
                            <div className="p-3 rounded-lg border border-purple-light/50 bg-purple-deep/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-off-white">BugTraceAI CLI</p>
                                    <button
                                        onClick={handleTestCli}
                                        disabled={isTestingCli || !cliUrl}
                                        className="px-3 py-1 text-xs font-medium text-coral bg-coral/20 border border-coral/30 rounded hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
                                    >
                                        {isTestingCli ? <Spinner /> : 'Test'}
                                    </button>
                                </div>

                                {/* CLI URL Input */}
                                <div>
                                    <label htmlFor="cliUrl" className="block text-xs text-muted mb-1">
                                        CLI API URL
                                    </label>
                                    <input
                                        id="cliUrl"
                                        type="url"
                                        value={cliUrl}
                                        onChange={(e) => {
                                            setCliUrl(e.target.value);
                                            setCliStatus(null);
                                        }}
                                        placeholder="http://localhost:8000"
                                        className="w-full text-sm input-premium px-3 py-1.5"
                                    />
                                </div>

                                {cliStatus && (
                                    <div className={`p-2 rounded border ${cliStatus.connected
                                        ? 'bg-green-900/20 border-green-500/30'
                                        : 'bg-yellow-900/20 border-yellow-500/30'
                                        }`}>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-medium text-purple-gray">Status</p>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${cliStatus.connected
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {cliStatus.connected ? 'Connected' : 'Not Available'}
                                            </span>
                                        </div>
                                        {cliStatus.connected ? (
                                            <div className="text-xs text-purple-gray mt-1 space-y-1">
                                                <div className="flex gap-4">
                                                    <span>Version: <span className="text-off-white">{cliStatus.version}</span></span>
                                                    <span>Latency: <span className="text-off-white">{cliStatus.latencyMs}ms</span></span>
                                                </div>
                                                <div className="flex gap-4">
                                                    <span>Docker: <span className={cliStatus.dockerAvailable ? 'text-green-400' : 'text-yellow-400'}>
                                                        {cliStatus.dockerAvailable ? 'Available' : 'Not Available'}
                                                    </span></span>
                                                    <span>Active Scans: <span className="text-off-white">{cliStatus.activeScans || 0}</span></span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-yellow-300 mt-1">
                                                {cliStatus.error || 'CLI not running. Vulnerability scanning features disabled.'}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <p className="text-xs text-muted">
                                    The CLI is optional and enables vulnerability scanning. When connected, you'll see a red pulse on the logo.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'danger' && (
                        <div className="space-y-6">
                            {/* Warning Header */}
                            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                                <div className="flex items-start gap-3">
                                    <svg className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                    <div>
                                        <h3 className="text-red-400 font-semibold">Danger Zone</h3>
                                        <p className="text-sm text-red-300/80 mt-1">
                                            Actions in this section are <strong>irreversible</strong>. All your chat history, analysis reports, and CLI scan data will be permanently deleted.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Clear All Data Section */}
                            <div className="p-4 rounded-lg border border-red-500/30 bg-purple-deep/30 space-y-4">
                                <div>
                                    <h4 className="text-off-white font-medium">Clear All Data</h4>
                                    <p className="text-sm text-muted mt-1">
                                        This will delete all chat sessions, messages, analysis reports, and CLI reports from the database.
                                    </p>
                                </div>

                                {/* Confirmation Input */}
                                <div>
                                    <label htmlFor="danger-confirm" className="block text-xs text-muted mb-2">
                                        Type <code className="bg-red-500/20 px-1.5 py-0.5 rounded text-red-400">Delete All</code> to confirm
                                    </label>
                                    <input
                                        id="danger-confirm"
                                        type="text"
                                        value={dangerConfirmation}
                                        onChange={(e) => {
                                            setDangerConfirmation(e.target.value);
                                            setClearResult(null);
                                        }}
                                        placeholder="Type 'Delete All' here"
                                        className="w-full px-3 py-2 bg-[#1A0F2E] border border-red-500/50 rounded-lg text-[#F8F9FA] placeholder-red-300/30 focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none transition-all shadow-inner"
                                    />
                                </div>

                                {/* Delete Button */}
                                <button
                                    onClick={() => setShowDangerConfirm(true)}
                                    disabled={dangerConfirmation !== 'Delete All' || isClearing}
                                    className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all ${dangerConfirmation === 'Delete All' && !isClearing
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-red-900/30 text-red-400/50 cursor-not-allowed'
                                        }`}
                                >
                                    {isClearing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Spinner />
                                            Clearing...
                                        </span>
                                    ) : (
                                        'Delete All Data'
                                    )}
                                </button>

                                {/* Result Message */}
                                {clearResult && (
                                    <div className={`p-3 rounded-lg ${clearResult.success
                                        ? 'bg-green-900/20 border border-green-500/30'
                                        : 'bg-red-900/20 border border-red-500/30'
                                        }`}>
                                        <p className={`text-sm ${clearResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                            {clearResult.message}
                                        </p>
                                        {clearResult.deleted && (
                                            <div className="text-xs text-muted mt-2 grid grid-cols-2 gap-x-4">
                                                <span>Chat Sessions: <span className="text-off-white">{clearResult.deleted.chatSessions || 0}</span></span>
                                                <span>Messages: <span className="text-off-white">{clearResult.deleted.chatMessages || 0}</span></span>
                                                <span>Analysis Reports: <span className="text-off-white">{clearResult.deleted.analysisReports || 0}</span></span>
                                                <span>CLI Reports: <span className="text-off-white">{clearResult.deleted.cliReports || 0}</span></span>
                                                {clearResult.deleted.cliScans > 0 && (
                                                    <span>CLI Scans: <span className="text-off-white">{clearResult.deleted.cliScans}</span></span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Confirmation Dialog */}
                            {showDangerConfirm && (
                                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowDangerConfirm(false)}>
                                    <div className="bg-purple-medium border border-red-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 rounded-full bg-red-500/20">
                                                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-red-400">Are you sure?</h3>
                                                <p className="text-sm text-muted mt-2">
                                                    This action <strong className="text-red-400">cannot be undone</strong>. All your data will be permanently deleted from the database.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-6">
                                            <button
                                                onClick={() => setShowDangerConfirm(false)}
                                                className="flex-1 px-4 py-2 bg-purple-light/50 border border-purple-elevated/50 text-off-white font-medium rounded-lg hover:bg-purple-light/70 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleClearAll}
                                                disabled={isClearing}
                                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {isClearing ? 'Deleting...' : 'Yes, Delete Everything'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                <footer className="flex-shrink-0 p-4 border-t border-ui-border bg-black/40 flex justify-end items-center gap-3">
                    <button
                        onClick={onClose}
                        className="btn-mini btn-mini-secondary !px-8 !py-2.5 !text-xs"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveSettings}
                        className="btn-mini btn-mini-primary !px-8 !py-2.5 !text-xs !rounded-xl shadow-glow-coral"
                    >
                        Save & Close
                    </button>
                </footer>
            </div>
        </div>
    );
};
