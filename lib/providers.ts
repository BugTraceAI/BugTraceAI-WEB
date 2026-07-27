// lib/providers.ts
// Single source of truth for WEB provider configuration.
// Pure data — no I/O, no localStorage, no React.

// Wire format for a provider's HTTP API. "openai" = OpenAI-compatible
// /chat/completions (OpenRouter, Z.ai). "anthropic" = Anthropic Messages API
// (x-api-key, top-level system, content[] blocks).
export type WireFormat = 'openai' | 'anthropic';

export interface ProviderConfig {
    name: string;
    recommended?: boolean;
    models: string[];
    defaultModel: string;
    description: string;
    baseUrl: string;
    /** HTTP wire format. Defaults to 'openai' when omitted. */
    apiFormat?: WireFormat;
    /** Label shown above the API-key input (custom-provider block). */
    keyLabel?: string;
    /** Placeholder for the API-key input. */
    keyPlaceholder?: string;
    /** Short recommendation/help line under the model selector. */
    recommendation?: string;
}

export const WEB_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    openrouter: {
        name: 'OpenRouter',
        recommended: true,
        models: [],
        defaultModel: '',
        description: 'Recommended — access 200+ models from multiple providers. Best model for each task.',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiFormat: 'openai',
    },
    anthropic: {
        name: 'Anthropic',
        models: [
            'claude-haiku-4-5-20251001',
            'claude-sonnet-4-6',
        ],
        defaultModel: 'claude-haiku-4-5-20251001',
        description: 'Anthropic direct API (Claude Messages API). Single-provider option using an Anthropic API key.',
        baseUrl: 'https://api.anthropic.com/v1/messages',
        apiFormat: 'anthropic',
        keyLabel: 'Anthropic API Key',
        keyPlaceholder: 'Enter your Anthropic key (sk-ant-...)',
        recommendation: 'claude-haiku-4-5 is fast and economical. claude-sonnet-4-6 gives higher-quality analysis.',
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
        apiFormat: 'openai',
        keyLabel: 'GLM API Key',
        keyPlaceholder: 'Enter your Z.ai API key',
        recommendation: 'glm-4.7-flash (free tier). glm-5 requires a paid subscription.',
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

/** Resolve the HTTP wire format for a given provider ID (defaults to 'openai'). */
export const resolveProviderFormat = (providerId: string): WireFormat =>
    WEB_PROVIDER_CONFIGS[providerId]?.apiFormat || 'openai';
