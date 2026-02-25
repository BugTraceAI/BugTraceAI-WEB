// lib/settingsUtils.ts
// PURE functions for settings validation, transformation, and provider config.
// No React, no hooks, no state, no DOM, no fetch.

// --- Provider configuration ---

export interface ProviderConfig {
  name: string;
  recommended?: boolean;
  models: string[];
  defaultModel: string;
  description: string;
  baseUrl: string;
}

export const WEB_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openrouter: {
    name: 'OpenRouter',
    recommended: true,
    models: [],
    defaultModel: '',
    description: 'Recommended — access 200+ models from multiple providers. Best model for each task.',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  },
  zai: {
    name: 'Z.ai (Experimental)',
    models: [
      'glm-4.7-flash',      // 1 credit
      'glm-4.5-flash',      // 2 credits
      'glm-4.6',            // 3 credits
      'glm-4.7-flashx',     // 3 credits
      'glm-5',              // 3 credits
      'glm-4.7',            // 5 credits
      'glm-4.5-air',        // 5 credits
      'glm-4.5-airx',       // 5 credits
      'glm-4.5',            // 10 credits
    ],
    defaultModel: 'glm-4.7-flash',
    description: 'Z.ai direct API. Single-provider option using GLM model family.',
    baseUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
  },
};

// --- Provider key helpers ---

/** Get the active API key for the given provider from the keys map */
export const getActiveKey = (providerId: string, apiKeys: Record<string, string>): string =>
  providerId === 'openrouter' ? apiKeys.openrouter : (apiKeys[providerId] || '');

/** Get the cheapest/first model for testing, falling back to the selected model */
export const getTestModel = (providerId: string, selectedModel: string): string => {
  const config = WEB_PROVIDER_CONFIGS[providerId];
  return config?.models[0] || selectedModel;
};

/** Get the base URL for a provider */
export const getTestUrl = (providerId: string): string | undefined =>
  WEB_PROVIDER_CONFIGS[providerId]?.baseUrl;

// --- Model cache helpers ---

const MODEL_CACHE_KEY = 'openRouterModelsCache';
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface ModelCache {
  models: string[];
  timestamp: number;
}

/** Read cached models from localStorage (returns null if expired or missing) */
export const readModelCache = (): string[] | null => {
  try {
    const cachedData = localStorage.getItem(MODEL_CACHE_KEY);
    if (!cachedData) return null;
    const { models, timestamp }: ModelCache = JSON.parse(cachedData);
    const isCacheValid = (Date.now() - timestamp) < MODEL_CACHE_TTL;
    if (isCacheValid && models && models.length > 0) return models;
  } catch { /* ignore parse errors */ }
  return null;
};

/** Write models to localStorage cache */
export const writeModelCache = (models: string[]): void => {
  try {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify({ models, timestamp: Date.now() }));
  } catch { /* ignore write errors */ }
};

// --- Validation helpers ---

/** Check if a provider model selection is valid, return corrected model if not */
export const resolveModel = (
  providerId: string,
  currentModel: string,
  availableModels: string[],
  fallbackModels: string[],
): string => {
  if (providerId !== 'openrouter') {
    const config = WEB_PROVIDER_CONFIGS[providerId];
    return config?.defaultModel || currentModel;
  }
  // For OpenRouter: use stored model only if it's a valid OpenRouter model (has provider/ prefix)
  const isValidForProvider = currentModel && currentModel.includes('/');
  return isValidForProvider ? currentModel : (availableModels[0] || fallbackModels[0] || currentModel);
};

/** Check if selected model is still in the available list, return a corrected default if not */
export const ensureModelInList = (
  currentModel: string,
  availableModels: string[],
  defaultModel: string,
): string => {
  if (availableModels.includes(currentModel)) return currentModel;
  return availableModels.includes(defaultModel) ? defaultModel : (availableModels[0] || currentModel);
};

// --- Health check result formatting ---

export interface HealthSummary {
  label: string;
  status: 'online' | 'offline' | 'degraded';
  details?: string;
}

export const formatBackendHealth = (connected: boolean, error?: string): HealthSummary => ({
  label: 'WEB Backend',
  status: connected ? 'online' : 'offline',
  details: connected ? undefined : (error || 'Unreachable'),
});

export const formatCliHealth = (connected: boolean, error?: string): HealthSummary => ({
  label: 'BugTraceAI CLI',
  status: connected ? 'online' : 'offline',
  details: connected ? undefined : (error || 'Not available'),
});
