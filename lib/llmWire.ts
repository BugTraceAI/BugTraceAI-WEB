// lib/llmWire.ts
// PURE request/response adapters bridging the WEB's OpenAI-shaped call sites to
// each provider's actual wire format. No I/O, no React, no localStorage.
//
// Two formats are supported:
//   - 'openai'    : OpenRouter / Z.ai — /chat/completions, Authorization: Bearer,
//                   choices[0].message.
//   - 'anthropic' : Anthropic Messages API — x-api-key, top-level `system`,
//                   content[] blocks, tools via input_schema / tool_use.
//
// The 'openai' branch is byte-identical to the pre-existing inline code so
// established providers keep exactly their old behaviour.

import type { WireFormat } from './providers.ts';

export type { WireFormat };

const ANTHROPIC_VERSION = '2023-06-01';
// Anthropic REQUIRES max_tokens; the OpenAI path sends none (model default, often large).
// 4096 truncated big analysis/JSON on the Anthropic provider. 8192 is supported across the
// modern Claude models this app targets and roughly doubles the headroom. Callers can still
// pass a larger opts.maxTokens explicitly.
const ANTHROPIC_DEFAULT_MAX_TOKENS = 8192;

/** True when the resolved provider URL targets the Anthropic Messages API. */
export const isAnthropicUrl = (url?: string): boolean =>
    !!url && url.includes('api.anthropic.com');

export interface WireMessage { role: string; content: any; }

export interface BuildOpts {
    model: string;
    apiKey: string;
    messages: WireMessage[];
    tools?: any[];
    /** OpenAI json_object response_format. Ignored by Anthropic (JSON is coaxed via prompt + client extraction). */
    jsonMode?: boolean;
    maxTokens?: number;
    /** OpenRouter reasoning/thinking control, e.g. { effort: 'high' }. Sent on the openai path only. */
    reasoning?: { effort: string };
}

/**
 * Convert an OpenAI-shaped message history into Anthropic's { system, messages } shape.
 *
 * Beyond splitting out the system prompt, this rewrites the two tool-calling roles the
 * OpenAI wire format uses but Anthropic rejects:
 *   - assistant messages carrying `tool_calls[]`  → assistant turn with `tool_use` content blocks
 *   - `role: 'tool'` result messages              → `tool_result` blocks folded into a `user` turn
 * Consecutive tool results (parallel tool calls) are coalesced into ONE user turn, as Anthropic
 * requires every result for a given assistant turn to live in a single following user message.
 * Plain user/assistant/system turns pass through unchanged, so non-tool chat is untouched.
 */
const toAnthropicMessages = (messages: WireMessage[]): { system?: string; messages: any[] } => {
    let system: string | undefined;
    const out: any[] = [];

    // Append a tool_result block, merging into the trailing user turn when it already holds
    // tool_result blocks (keeps parallel tool calls in one user message).
    const pushToolResult = (block: any) => {
        const last = out[out.length - 1];
        const isToolResultTurn = last && last.role === 'user' && Array.isArray(last.content)
            && last.content.length > 0 && last.content[0]?.type === 'tool_result';
        if (isToolResultTurn) last.content.push(block);
        else out.push({ role: 'user', content: [block] });
    };

    for (const m of messages) {
        const role = m.role === 'model' ? 'assistant' : m.role;
        const anyM = m as any;

        if (role === 'system') {
            system = system ? `${system}\n\n${m.content}` : String(m.content);
            continue;
        }

        if (role === 'tool') {
            pushToolResult({
                type: 'tool_result',
                tool_use_id: anyM.tool_call_id,
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
            });
            continue;
        }

        if (role === 'assistant' && Array.isArray(anyM.tool_calls) && anyM.tool_calls.length > 0) {
            const blocks: any[] = [];
            if (m.content) blocks.push({ type: 'text', text: String(m.content) });
            for (const tc of anyM.tool_calls) {
                let input: any = {};
                try { input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; }
                catch { input = {}; }
                blocks.push({ type: 'tool_use', id: tc.id, name: tc.function?.name, input });
            }
            out.push({ role: 'assistant', content: blocks });
            continue;
        }

        // Drop an empty assistant turn (no text, no tool_calls) — a model reply that returned
        // nothing gets stored as an assistant message with empty content, and Anthropic rejects
        // empty text content blocks, so the NEXT request would 400 on resume. (OpenAI tolerates it.)
        if (role === 'assistant' && (m.content == null || (typeof m.content === 'string' && m.content.trim() === ''))) {
            continue;
        }

        out.push({ role, content: m.content });
    }

    return { system, messages: out };
};

/** Convert OpenAI function tools → Anthropic tools ({ name, description, input_schema }). */
const toAnthropicTools = (tools?: any[]): any[] | undefined =>
    tools?.map((t) => {
        const fn = t.function || t;
        return {
            name: fn.name,
            description: fn.description,
            input_schema: fn.parameters || { type: 'object', properties: {} },
        };
    });

/**
 * Build the { headers, body } for a single LLM request in the given wire format.
 * The 'openai' output matches the WEB's original inline request shape exactly.
 */
export const buildRequest = (format: WireFormat, opts: BuildOpts): { headers: Record<string, string>; body: any } => {
    if (format === 'anthropic') {
        const { system, messages } = toAnthropicMessages(opts.messages);
        const headers: Record<string, string> = {
            'x-api-key': opts.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
            // Required to allow browser-origin calls with an API key.
            'anthropic-dangerous-direct-browser-access': 'true',
        };
        const body: any = {
            model: opts.model.replace(/^anthropic\//, ''),
            max_tokens: opts.maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
            messages,
        };
        if (system) body.system = system;
        // Anthropic has no `response_format: json_object`. When the caller asked for JSON,
        // enforce it via a system directive (the openai path uses response_format instead).
        // Client-side extractJson still runs as a safety net, but this materially reduces
        // prose-wrapped / fenced replies that would fail parsing on the Anthropic provider.
        if (opts.jsonMode) {
            const jsonDirective = 'Respond with ONLY a single valid JSON value — no prose, no explanations, no markdown code fences.';
            body.system = body.system ? `${body.system}\n\n${jsonDirective}` : jsonDirective;
        }
        const at = toAnthropicTools(opts.tools);
        if (at && at.length) body.tools = at;
        return { headers, body };
    }

    // openai (OpenRouter / Z.ai) — unchanged shape
    const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en',
    };
    const body: any = { model: opts.model, messages: opts.messages };
    if (opts.jsonMode) body.response_format = { type: 'json_object' };
    if (opts.tools) body.tools = opts.tools;
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    // OpenRouter reasoning control (thinking). Only sent when a reasoning-variant model is chosen.
    if (opts.reasoning) body.reasoning = opts.reasoning;
    return { headers, body };
};

/** Extract the plain-text assistant content from a response, in either format. */
export const parseContent = (format: WireFormat, data: any): string | null => {
    if (format === 'anthropic') {
        const blocks = data?.content;
        if (!Array.isArray(blocks)) return null;
        const text = blocks
            .filter((b: any) => b?.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
        return text || null;
    }
    return data?.choices?.[0]?.message?.content ?? null;
};

/**
 * Normalize a tool-calling response into an OpenAI-shaped message
 * { role, content, tool_calls? } so call sites (e.g. the Repeater) stay
 * format-agnostic. Anthropic tool_use blocks map to function tool_calls.
 */
export const parseMessage = (format: WireFormat, data: any): any => {
    if (format === 'anthropic') {
        const blocks = Array.isArray(data?.content) ? data.content : [];
        const text = blocks
            .filter((b: any) => b?.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
        const toolUses = blocks.filter((b: any) => b?.type === 'tool_use');
        const message: any = { role: 'assistant', content: text || null };
        if (toolUses.length) {
            message.tool_calls = toolUses.map((b: any) => ({
                id: b.id,
                type: 'function',
                function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
            }));
        }
        return message;
    }
    return data?.choices?.[0]?.message ?? null;
};
