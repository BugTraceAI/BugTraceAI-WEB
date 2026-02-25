// components/settings/ApiSettingsTab.tsx
// Provider selection, API key management, model selection, test connection
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircleIcon, ArrowPathIcon } from '../Icons.tsx';
import { Spinner } from '../Spinner.tsx';
import { testApi } from '../../services/Service.ts';
import { OPEN_ROUTER_MODELS } from '../../constants.ts';
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

  // State for dynamic OpenRouter models
  const [openRouterModels, setOpenRouterModels] = useState<string[]>(OPEN_ROUTER_MODELS);
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

  const fetchOpenRouterModels = useCallback(async (force = false) => {
    setIsFetchingModels(true);
    setFetchModelsError(null);

    if (!force) {
      const cached = readModelCache();
      if (cached) {
        setOpenRouterModels(cached);
        setIsFetchingModels(false);
        return;
      }
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      if (!response.ok) throw new Error(`OpenRouter API failed with status ${response.status}`);

      const data = await response.json();
      const modelIds = Array.isArray(data?.data)
        ? data.data.map((model: any) => model.id).sort()
        : [];

      if (modelIds.length === 0) {
        throw new Error("API returned no models or an unexpected format.");
      }

      setOpenRouterModels(modelIds);
      const corrected = ensureModelInList(localOpenRouterModel, modelIds, 'google/gemini-3-flash-preview');
      if (corrected !== localOpenRouterModel) {
        setLocalOpenRouterModel(corrected);
      }

      writeModelCache(modelIds);
    } catch (e: any) {
      setFetchModelsError(e.message || "Failed to fetch model list.");
      setOpenRouterModels(OPEN_ROUTER_MODELS); // Fallback to constant
    } finally {
      setIsFetchingModels(false);
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
            setIsKeyValidated(false);
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
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              <button onClick={() => fetchOpenRouterModels(true)} disabled={isFetchingModels} className="flex-shrink-0 p-2 input-premium hover:bg-white/5 transition-colors disabled:opacity-50" title="Refresh model list">
                {isFetchingModels ? <Spinner /> : <ArrowPathIcon className="h-5 w-5" />}
              </button>
            </div>
            {fetchModelsError && <p className="text-red-400 text-xs mt-2">{fetchModelsError}</p>}
            <p className="text-xs text-muted mt-2">
              <strong className="text-coral">Recommendation:</strong> For best results, use <code>google/gemini-3-flash-preview</code>.
            </p>
          </div>
        </>
      )}

      {/* Z.ai-specific settings */}
      {localProviderId === 'zai' && (
        <>
          <div>
            <label htmlFor="zaiApiKey" className="label-mini block mb-1">
              GLM API Key
            </label>
            <div className="relative">
              <input
                id="zaiApiKey"
                type="password"
                value={localApiKeys.zai || ''}
                onChange={(e) => {
                  setLocalApiKeys({ ...localApiKeys, zai: e.target.value });
                  setIsKeyValidated(false);
                  setTestResult(null);
                }}
                placeholder="Enter your Z.ai API key"
                className="w-full input-premium px-4 py-2"
              />
              {isKeyValidated && localApiKeys.zai && (
                <CheckCircleIcon className="absolute top-1/2 right-3 -translate-y-1/2 h-6 w-6 text-green-400" title="This key has been validated." />
              )}
            </div>
            {localApiKeys.zai && localApiKeys.zai.length >= 4 && (
              <p className="text-xs text-ui-text-dim mt-1 font-mono">Key: ····{localApiKeys.zai.slice(-4)}</p>
            )}
          </div>

          <div>
            <label htmlFor="zai-model-select" className="label-mini block mb-1">
              Select Model
            </label>
            <select
              id="zai-model-select"
              value={localOpenRouterModel}
              onChange={(e) => setLocalOpenRouterModel(e.target.value)}
              className="w-full input-premium p-2"
            >
              {WEB_PROVIDER_CONFIGS.zai.models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <p className="text-xs text-muted mt-2">
              <strong className="text-coral">Recommendation:</strong> <code>glm-4.7-flash</code> (free tier). <code>glm-5</code> requires paid subscription.
            </p>
          </div>
        </>
      )}

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
