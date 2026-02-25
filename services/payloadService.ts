// @author: Albert C | @yz9yt | github.com/yz9yt
// services/payloadService.ts
// Payload generation functions. Each function orchestrates prompt creation, API call,
// and JSON parsing for a specific payload generation task.

import type {
    ApiOptions, Vulnerability, XssPayloadResult,
    ForgedPayloadResult, SqlmapCommandResult
} from '../types.ts';
import { callApi, parseJsonWithCorrection } from './apiClient.ts';
import {
    createXssPayloadGenerationPrompt,
    createSqlmapCommandGenerationPrompt,
    createPayloadForgePrompt,
    createSstiForgePrompt,
} from './prompts/index.ts';

export const generateXssPayload = async (vulnerability: Vulnerability, options: ApiOptions, samplePayloads?: string[]): Promise<XssPayloadResult> => {
    const prompt = createXssPayloadGenerationPrompt(vulnerability, samplePayloads);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<XssPayloadResult>(resultText, prompt, options);
};

export const generateSqlmapCommand = async (vulnerability: Vulnerability, url: string, options: ApiOptions): Promise<SqlmapCommandResult> => {
    const prompt = createSqlmapCommandGenerationPrompt(vulnerability, url);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<SqlmapCommandResult>(resultText, prompt, options);
};

export const forgePayloads = async (basePayload: string, options: ApiOptions): Promise<ForgedPayloadResult> => {
    const prompt = createPayloadForgePrompt(basePayload);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<ForgedPayloadResult>(resultText, prompt, options);
};

export const generateSstiPayloads = async (engine: string, goal: string, options: ApiOptions): Promise<ForgedPayloadResult> => {
    const prompt = createSstiForgePrompt(engine, goal);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<ForgedPayloadResult>(resultText, prompt, options);
};
