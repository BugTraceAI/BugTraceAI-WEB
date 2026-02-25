// lib/providers.ts
// Single source of truth for WEB provider configuration.
// Pure data — no I/O, no localStorage, no React.

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

export const WEB_PROVIDER_URLS: Record<string, string> = Object.fromEntries(
    Object.entries(WEB_PROVIDER_CONFIGS).map(([id, cfg]) => [id, cfg.baseUrl])
);

export const DEFAULT_PROVIDER_ID = 'openrouter';
export const DEFAULT_API_URL = WEB_PROVIDER_URLS[DEFAULT_PROVIDER_ID];

/** Get provider ID from localStorage (pure fallback to default). */
export const getStoredProviderId = (): string => {
    try {
        return localStorage.getItem('providerId') || DEFAULT_PROVIDER_ID;
    } catch {
        return DEFAULT_PROVIDER_ID;
    }
};

/** Resolve API URL for a given provider ID. */
export const resolveProviderUrl = (providerId: string): string =>
    WEB_PROVIDER_URLS[providerId] || DEFAULT_API_URL;
