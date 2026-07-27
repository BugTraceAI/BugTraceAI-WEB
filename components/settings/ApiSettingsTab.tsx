// components/settings/ApiSettingsTab.tsx
// Provider selection, API key management, model selection, test connection
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircleIcon, ArrowPathIcon } from '../Icons.tsx';
import { Spinner } from '../Spinner.tsx';
import { testApi } from '../../services/Service.ts';
import { OPEN_ROUTER_MODELS } from '../../constants.ts';
import { CURATED_MODEL_KEYS, DEFAULT_CHAT_MODEL_KEY, curatedModelName } from '../../lib/curatedModels.ts';
import type { ApiKeys } from '../../types.ts';
import {
  WEB_PROVIDER_CONFIGS, getActiveKey, getTestModel, getTestUrl,
  readModelCache, writeModelCache, ensureModelInList, resolveModel,
} from '../../lib/settingsUtils.ts';

interface ApiSettingsTabProps {
  localProviderId: string;
  setLocalProviderId: (id: string) => void;
  localApiKeys: ApiKeys;
  setLocalApiKeys: (keys: ApiKeys) => void;
  localOpenRouterModel: string;
  setLocalOpenRouterModel: (model: string) => void;
  localSaveApiKeys: boolean;
  setLocalSaveApiKeys: (save: boolean) => void;
  globalOpenRouterModel: string;
  isOpen: boolean;
  isKeyValidated: boolean;
  setIsKeyValidated: (v: boolean) => void;
  testResult: { success: boolean; message: string } | null;
  setTestResult: (r: { success: boolean; message: string } | null) => void;
  isTesting: boolean;
  setIsTesting: (v: boolean) => void;
}

export const ApiSettingsTab: React.FC<ApiSettingsTabProps> = ({
  localProviderId, setLocalProviderId,
  localApiKeys, setLocalApiKeys,
  localOpenRouterModel, setLocalOpenRouterModel,
  localSaveApiKeys, setLocalSaveApiKeys,
  globalOpenRouterModel, isOpen,
  isKeyValidated, setIsKeyValidated,
  testResult, setTestResult,
  isTesting, setIsTesting,
}) => {
  const openRouterInputRef = useRef<HTMLInputElement>(null);

  // OpenRouter model picker — loads the curated pack (lib/curatedModels.ts), not the live catalog.
  const [openRouterModels, setOpenRouterModels] = useState<string[]>(CURATED_MODEL_KEYS);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        openRouterInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Loads the curated pack (lib/curatedModels.ts) rather than the ~340-model live catalog.
  const fetchOpenRouterModels = useCallback(async () => {
    setFetchModelsError(null);
    setIsFetchingModels(false);
    setOpenRouterModels(CURATED_MODEL_KEYS);
    const corrected = ensureModelInList(localOpenRouterModel, CURATED_MODEL_KEYS, DEFAULT_CHAT_MODEL_KEY);
    if (corrected !== localOpenRouterModel) {
      setLocalOpenRouterModel(corrected);
    }
  }, [localOpenRouterModel, setLocalOpenRouterModel]);

  useEffect(() => {
    if (isOpen && localProviderId === 'openrouter') {
      fetchOpenRouterModels();
    }
  }, [isOpen, localProviderId, fetchOpenRouterModels]);

  const handleTestApi = async () => {
    const keyToTest = getActiveKey(localProviderId, localApiKeys);
    const modelToTest = getTestModel(localProviderId, localOpenRouterModel);
    const urlToTest = getTestUrl(localProviderId);

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

  const currentKey = getActiveKey(localProviderId, localApiKeys);

  return (
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
            // A provider that already has a saved key was validated when saved — don't force
            // re-validation just for toggling the dropdown (that blocked Save for a working key).
            setIsKeyValidated(!!getActiveKey(newProvider, localApiKeys).trim());
            const resolved = resolveModel(newProvider, globalOpenRouterModel, openRouterModels, OPEN_ROUTER_MODELS);
            setLocalOpenRouterModel(resolved);
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
  );
};
