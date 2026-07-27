// @author: Albert C | @yz9yt | github.com/yz9yt
// services/apiClient.ts
// Core I/O layer: API calls, JSON extraction/correction, provider resolution, abort management.
// This module contains ALL side-effectful functions (fetch, localStorage, rate limiting).

import type { ApiOptions, ChatMessage } from '../types.ts';
import { createFixJsonPrompt } from './prompts/index.ts';
import {
    enforceRateLimit,
    incrementApiCallCount,
    beginApiRequest,
    finishApiRequest,
    isTimeoutAbort,
    incrementContinuousFailureCount,
    resetContinuousFailureCount,
} from '../utils/apiManager.ts';
import { DEFAULT_API_URL, getStoredProviderId, resolveProviderUrl, resolveProviderFormat } from '../lib/providers.ts';
import { buildRequest, parseContent, parseMessage, isAnthropicUrl } from '../lib/llmWire.ts';
import { resolveModelRequest } from '../lib/curatedModels.ts';

// Shown when a request is aborted by the hard timeout (hung/unavailable model) — distinct from a
// user-initiated stop, which stays silent. Product copy is English only.
const TIMEOUT_ERROR_MSG = "The AI model did not respond in time. It may be unavailable or overloaded — pick another model in Settings.";

// ── Provider-aware API URL resolution ──
// Reads WEB's own provider setting from localStorage, maps via the canonical provider registry.
// WEB and CLI are independent products -- WEB never reads CLI's provider config.
export const getProviderApiUrl = async (): Promise<string> => {
    try {
        return resolveProviderUrl(getStoredProviderId());
    } catch {
        return DEFAULT_API_URL;
    }
};

// Export for Settings UI -- returns WEB's own provider config (not CLI)
export const getProviderInfo = async () => {
    try {
        const providerId = getStoredProviderId();
        return {
            provider: providerId,
            base_url: resolveProviderUrl(providerId),
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
    const controller = beginApiRequest();
    const apiUrl = await getProviderApiUrl();
    const format = resolveProviderFormat(getStoredProviderId());

    try {
        incrementApiCallCount();

        const resolved = resolveModelRequest(model);
        const { headers, body } = buildRequest(format, {
            model: resolved.model, apiKey,
            messages: [{ role: 'user', content: prompt }],
            jsonMode: isJson,
            reasoning: resolved.reasoning,
        });
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            let message = `API request failed with status ${response.status}`;
            try { const err = await response.json(); message = err?.error?.message || message; } catch { /* non-JSON error body */ }
            throw new Error(message);
        }

        const data = await response.json();
        const content = parseContent(format, data);

        if (!content) {
            throw new Error("Received an empty response from the AI. The model may have been filtered or refused the request.");
        }

        resetContinuousFailureCount();
        return content;

    } catch (error: any) {
        incrementContinuousFailureCount();
        if (error.name === 'AbortError') {
            // A hard-timeout abort is a real failure the user must see; a stop-button cancel stays silent.
            throw isTimeoutAbort(controller) ? new Error(TIMEOUT_ERROR_MSG) : new Error("Request cancelled.");
        }
        throw new Error(error.message || "An unknown error occurred while contacting the AI service.");
    } finally {
        finishApiRequest(controller);
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
    const controller = beginApiRequest();
    const apiUrl = await getProviderApiUrl();
    const format = resolveProviderFormat(getStoredProviderId());

    try {
        incrementApiCallCount();

        const resolved = resolveModelRequest(model);
        const { headers, body } = buildRequest(format, {
            model: resolved.model, apiKey,
            messages: history.map(({ role, content }) => ({
                role: role === 'model' ? 'assistant' : role,
                content,
            })),
            reasoning: resolved.reasoning,
        });
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            let message = `API request failed with status ${response.status}`;
            try { const err = await response.json(); message = err?.error?.message || message; } catch { /* non-JSON error body */ }
            throw new Error(message);
        }

        const data = await response.json();
        const content = parseContent(format, data);
        if (!content) {
            throw new Error("Received an empty response from the AI.");
        }
        resetContinuousFailureCount();
        return content;

    } catch (error: any) {
        incrementContinuousFailureCount();
        if (error.name === 'AbortError') {
            // A hard-timeout abort is a real failure the user must see; a stop-button cancel stays silent.
            throw isTimeoutAbort(controller) ? new Error(TIMEOUT_ERROR_MSG) : new Error("Request cancelled.");
        }
        throw new Error(error.message || "An unknown error occurred while contacting the AI service.");
    } finally {
        finishApiRequest(controller);
    }
};

/**
 * Sends a multi-turn chat conversation to the LLM provider with tool support.
 * Returns the raw message object which might contain tool_calls.
 */
export const callOpenRouterChatWithTools = async (history: any[], tools: any[], options: ApiOptions): Promise<any> => {
    await enforceRateLimit();
    const { apiKey, model } = options;
    if (!apiKey) {
        throw new Error("API Key is not configured.");
    }
    const controller = beginApiRequest();
    const apiUrl = await getProviderApiUrl();
    const format = resolveProviderFormat(getStoredProviderId());

    try {
        incrementApiCallCount();

        const resolved = resolveModelRequest(model);
        const { headers, body } = buildRequest(format, { model: resolved.model, apiKey, messages: history, tools, reasoning: resolved.reasoning });
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            let message = `API request failed with status ${response.status}`;
            try { const err = await response.json(); const errCode = err?.error?.code; if (errCode === 'cyber_policy') { message = 'The selected AI provider blocked this authorized security request under its cyber policy. Choose a provider/model that supports authorized security testing, then resume the Repeater.'; } else { message = err?.error?.message || message; } } catch { /* non-JSON error body */ }
            throw new Error(message);
        }

        const data = await response.json();
        const message = parseMessage(format, data);
        if (!message) {
            throw new Error("Received an empty response from the AI.");
        }
        resetContinuousFailureCount();
        return message;

    } catch (error: any) {
        incrementContinuousFailureCount();
        if (error.name === 'AbortError') {
            // A hard-timeout abort is a real failure the user must see; a stop-button cancel stays silent.
            throw isTimeoutAbort(controller) ? new Error(TIMEOUT_ERROR_MSG) : new Error("Request cancelled.");
        }
        throw new Error(error.message || "An unknown error occurred while contacting the AI service.");
    } finally {
        finishApiRequest(controller);
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
        // testApi is given a raw URL (not a provider id), so infer the wire format from it.
        const format = isAnthropicUrl(apiUrl) ? 'anthropic' : 'openai';
        const { headers, body } = buildRequest(format, {
            model: resolveModelRequest(model).model, apiKey,
            messages: [{ role: 'user', content: 'Are you alive? Answer only yes.' }],
            maxTokens: 5,
        });
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
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
