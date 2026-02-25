// @author: Albert C | @yz9yt | github.com/yz9yt
// services/apiClient.ts
// Core I/O layer: API calls, JSON extraction/correction, provider resolution, abort management.
// This module contains ALL side-effectful functions (fetch, localStorage, rate limiting).

import type { ApiOptions, ChatMessage } from '../types.ts';
import { createFixJsonPrompt } from './prompts/index.ts';
import {
    enforceRateLimit,
    updateRateLimitTimestamp,
    incrementApiCallCount,
    getNewAbortSignal,
    setRequestStatus,
    clearAbortController,
    incrementContinuousFailureCount,
    resetContinuousFailureCount,
} from '../utils/apiManager.ts';

// ── Provider-aware API URL resolution ──
// Reads WEB's own provider setting from localStorage, maps to static base URLs.
// WEB and CLI are independent products -- WEB never reads CLI's provider config.
const WEB_PROVIDER_URLS: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    zai: 'https://api.z.ai/api/paas/v4/chat/completions',
};
const DEFAULT_API_URL = WEB_PROVIDER_URLS.openrouter;

export const getProviderApiUrl = async (): Promise<string> => {
    try {
        const providerId = localStorage.getItem('providerId') || 'openrouter';
        return WEB_PROVIDER_URLS[providerId] || DEFAULT_API_URL;
    } catch {
        return DEFAULT_API_URL;
    }
};

// Export for Settings UI -- returns WEB's own provider config (not CLI)
export const getProviderInfo = async () => {
    try {
        const providerId = localStorage.getItem('providerId') || 'openrouter';
        return {
            provider: providerId,
            base_url: WEB_PROVIDER_URLS[providerId] || DEFAULT_API_URL,
        };
    } catch { return null; }
};

export const invalidateProviderCache = () => { /* no-op, WEB uses static config */ };

/**
 * Core API call function. Sends a single prompt to the configured LLM provider.
 * I/O function: performs fetch, manages abort signals, rate limiting, failure tracking.
 */
export const callApi = async (prompt: string, options: ApiOptions, isJson: boolean = true): Promise<string> => {
    await enforceRateLimit();
    const { apiKey, model } = options;
    if (!apiKey) {
        throw new Error("API Key is not configured.");
    }
    const signal = getNewAbortSignal();
    const apiUrl = await getProviderApiUrl();

    try {
        setRequestStatus('active');
        updateRateLimitTimestamp();
        incrementApiCallCount();

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept-Language': 'en-US,en'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                ...(isJson && { response_format: { type: "json_object" } }),
            }),
            signal: signal,
        });

        if (!response.ok) {
            let message = `API request failed with status ${response.status}`;
            try { const err = await response.json(); message = err?.error?.message || message; } catch { /* non-JSON error body */ }
            throw new Error(message);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("Received an empty response from the AI. The model may have been filtered or refused the request.");
        }

        resetContinuousFailureCount();
        return content;

    } catch (error: any) {
        incrementContinuousFailureCount();
        if (error.name === 'AbortError') {
            throw new Error("Request cancelled.");
        }
        throw new Error(error.message || "An unknown error occurred while contacting the AI service.");
    } finally {
        setRequestStatus('idle');
        clearAbortController();
    }
};

/**
 * Extracts a JSON object or array from raw text that may contain markdown fences
 * or conversational text around the JSON.
 * Pure function -- no I/O.
 */
export const extractJson = (text: string): string | null => {
    const markdownMatch = text.match(/```(json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```/);
    if (markdownMatch && markdownMatch[2]) {
        return markdownMatch[2];
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    return null;
};

/**
 * Attempts to parse JSON text. On SyntaxError, sends a correction prompt to the LLM
 * and tries to parse the corrected response.
 * I/O function: may call callApi for JSON self-correction.
 */
export const parseJsonWithCorrection = async <T>(jsonText: string, originalPrompt: string, options: ApiOptions): Promise<T> => {
    try {
        return JSON.parse(jsonText) as T;
    } catch (error: any) {
        if (error instanceof SyntaxError) {
            console.warn("Malformed JSON detected. Attempting self-correction.", { originalError: error.message, jsonText });

            const fixPrompt = createFixJsonPrompt(originalPrompt, jsonText, error.message);
            const fixedJsonText = await callApi(fixPrompt, options, true);

            try {
                return JSON.parse(fixedJsonText) as T;
            } catch (secondError: any) {
                 console.error("JSON self-correction failed. The AI's corrected response was still invalid.", { correctedJson: fixedJsonText, error: secondError.message });
                 throw new Error("Failed to parse the API's JSON response, even after a self-correction attempt.");
            }
        }
        throw error; // Re-throw other errors
    }
};

/**
 * Sends a multi-turn chat conversation to the LLM provider.
 * I/O function: performs fetch, manages abort signals, rate limiting, failure tracking.
 */
export const callOpenRouterChat = async (history: ChatMessage[], options: ApiOptions): Promise<string> => {
    await enforceRateLimit();
    const { apiKey, model } = options;
    if (!apiKey) {
        throw new Error("API Key is not configured.");
    }
    const signal = getNewAbortSignal();
    const apiUrl = await getProviderApiUrl();

    try {
        setRequestStatus('active');
        updateRateLimitTimestamp();
        incrementApiCallCount();

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept-Language': 'en-US,en'
            },
            body: JSON.stringify({
                model: model,
                messages: history.map(({ role, content }) => ({
                    role: role === 'model' ? 'assistant' : role,
                    content,
                })),
            }),
            signal: signal,
        });

        if (!response.ok) {
            let message = `API request failed with status ${response.status}`;
            try { const err = await response.json(); message = err?.error?.message || message; } catch { /* non-JSON error body */ }
            throw new Error(message);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("Received an empty response from the AI.");
        }
        resetContinuousFailureCount();
        return content;

    } catch (error: any) {
        incrementContinuousFailureCount();
        if (error.name === 'AbortError') {
            throw new Error("Request cancelled.");
        }
        throw new Error(error.message || "An unknown error occurred while contacting the AI service.");
    } finally {
        setRequestStatus('idle');
        clearAbortController();
    }
};

/**
 * Tests an API key/model combination by sending a trivial prompt.
 * I/O function: performs fetch directly (bypasses rate limiting and abort management).
 */
export const testApi = async (apiKey: string, model: string, explicitUrl?: string): Promise<{ success: boolean; error?: string }> => {
    if (!apiKey || apiKey.length < 10) {
        return { success: false, error: 'API key is too short or empty.' };
    }

    try {
        const apiUrl = explicitUrl || await getProviderApiUrl();
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept-Language': 'en-US,en'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: 'Are you alive? Answer only yes.' }],
                max_tokens: 5,
            }),
        });

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try { const err = await response.json(); errorMessage = err?.error?.message || errorMessage; } catch { /* non-JSON error body */ }
            return { success: false, error: errorMessage };
        }

        return { success: true };

    } catch (error: any) {
        return { success: false, error: error.message || 'A network error occurred.' };
    }
};
