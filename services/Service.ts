// @author: Albert C | @yz9yt | github.com/yz9yt
// services/Service.ts
// version 0.1 Beta
import {
    ApiOptions, Vulnerability, VulnerabilityReport, XssPayloadResult, ForgedPayloadResult,
    ChatMessage, ExploitContext, HeadersReport, DomXssAnalysisResult,
    FileUploadAnalysisResult, DastScanType, SqlmapCommandResult,
    Severity
} from '../types.ts';
import {
    createSastAnalysisPrompt,
    createSastDeepAnalysisPrompt,
    createDastAnalysisPrompt,
    createDeepAnalysisPrompt,
    createHeadersAnalysisPrompt,
    createJsReconPrompt,
    createDomXssPathfinderPrompt,
    createXssPayloadGenerationPrompt,
    createSqlmapCommandGenerationPrompt,
    createInitialExploitChatPrompt,
    createInitialSqlExploitChatPrompt,
    createPayloadForgePrompt,
    createSstiForgePrompt,
    createFileUploadAnalysisPrompt,
    createFileUploadAnalysisPromptAttempt2,
    createJwtBlueTeamPrompt,
    createJwtRedTeamPrompt,
    createConsolidationPrompt,
    createFixJsonPrompt,
    createPrivescPathfinderPrompt,
    createValidationPrompt
} from './prompts/index.ts';
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
// WEB and CLI are independent products — WEB never reads CLI's provider config.
const WEB_PROVIDER_URLS: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    zai: 'https://api.z.ai/api/paas/v4/chat/completions',
};
const DEFAULT_API_URL = WEB_PROVIDER_URLS.openrouter;

const getProviderApiUrl = async (): Promise<string> => {
    try {
        const providerId = localStorage.getItem('providerId') || 'openrouter';
        return WEB_PROVIDER_URLS[providerId] || DEFAULT_API_URL;
    } catch {
        return DEFAULT_API_URL;
    }
};

// Export for Settings UI — returns WEB's own provider config (not CLI)
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

const callApi = async (prompt: string, options: ApiOptions, isJson: boolean = true) => {
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

const extractJson = (text: string): string | null => {
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

const parseJsonWithCorrection = async <T>(jsonText: string, originalPrompt: string, options: ApiOptions): Promise<T> => {
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

const processReport = (report: VulnerabilityReport): VulnerabilityReport => {
  const vulnerabilities = (report.vulnerabilities || []).map(v => ({
    ...v,
    severity: Object.values(Severity).includes(v.severity) ? v.severity : Severity.UNKNOWN,
  }));
  return { ...report, vulnerabilities };
};


export const analyzeCode = async (code: string, options: ApiOptions, iteration: number): Promise<VulnerabilityReport> => {
  const prompt = createSastAnalysisPrompt(code, iteration);
  const resultText = await callApi(prompt, options, true);
  const result = await parseJsonWithCorrection<VulnerabilityReport>(resultText, prompt, options);
  if (!result.analyzedTarget) {
      result.analyzedTarget = 'Code Snippet';
  }
  return processReport(result);
};

export const performSastDeepAnalysis = async (vulnerability: Vulnerability, code: string, options: ApiOptions): Promise<Vulnerability> => {
    const prompt = createSastDeepAnalysisPrompt(vulnerability, code);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<Vulnerability>(resultText, prompt, options);
};

export const analyzeJsCode = async (code: string, options: ApiOptions): Promise<VulnerabilityReport> => {
  const prompt = createJsReconPrompt(code);
  const resultText = await callApi(prompt, options, true);
  const result = await parseJsonWithCorrection<VulnerabilityReport>(resultText, prompt, options);
  return processReport(result);
};

export const analyzeUrl = async (url: string, scanType: DastScanType, options: ApiOptions, iteration: number): Promise<VulnerabilityReport> => {
  const prompt = createDastAnalysisPrompt(url, scanType, iteration);
  const resultText = await callApi(prompt, options, false); // DAST uses search, response is not guaranteed to be perfect JSON
  const jsonText = extractJson(resultText);
  if (!jsonText) {
    console.warn("DAST response did not contain valid JSON, creating a default report. Raw text:", resultText);
    return processReport({
        analyzedTarget: url,
        vulnerabilities: [],
    });
  }
  const result = await parseJsonWithCorrection<VulnerabilityReport>(jsonText, prompt, options);
  if (!result.analyzedTarget) {
      result.analyzedTarget = url;
  }
  return processReport(result);
};

export const validateVulnerability = async (vulnerability: Vulnerability, options: ApiOptions): Promise<{is_valid: boolean; reasoning: string}> => {
    const prompt = createValidationPrompt(vulnerability);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<{is_valid: boolean; reasoning: string}>(resultText, prompt, options);
};

export const consolidateReports = async (reports: VulnerabilityReport[], options: ApiOptions): Promise<VulnerabilityReport> => {
    if (reports.length === 0) throw new Error("Cannot consolidate an empty array of reports.");
    if (reports.length === 1) return reports[0];
    
    const prompt = createConsolidationPrompt(JSON.stringify(reports));
    const resultText = await callApi(prompt, options, true);
    const result = await parseJsonWithCorrection<VulnerabilityReport>(resultText, prompt, options);
    return processReport(result);
};

export const performDeepAnalysis = async (vulnerability: Vulnerability, url: string, options: ApiOptions): Promise<Vulnerability> => {
    const prompt = createDeepAnalysisPrompt(vulnerability, url);
    const resultText = await callApi(prompt, options, true);
    return await parseJsonWithCorrection<Vulnerability>(resultText, prompt, options);
};

export const analyzeFileUpload = async (url: string, options: ApiOptions): Promise<FileUploadAnalysisResult> => {
    // --- Attempt 1: Pentester Persona (uses search) ---
    try {
        const prompt1 = createFileUploadAnalysisPrompt(url);
        const resultText1 = await callApi(prompt1, options, false);
        const jsonText1 = extractJson(resultText1);
        
        if (jsonText1) {
            const result1 = await parseJsonWithCorrection<FileUploadAnalysisResult>(jsonText1, prompt1, options);
            if (result1.found) {
                // Success on the first try, return immediately.
                return result1;
            }
        }
        // If not found or JSON was bad, proceed to the second attempt.
        console.log("File upload not found on first attempt, trying fallback method.");
    } catch (e: any) {
        console.warn("File upload analysis (attempt 1) failed:", e.message, "Proceeding to fallback.");
        // Ignore the error and proceed to the second attempt.
    }

    // --- Attempt 2: Strict HTML Parser Persona (no search) ---
    // This runs if the first attempt failed, returned bad JSON, or found nothing.
    const prompt2 = createFileUploadAnalysisPromptAttempt2(url);
    const resultText2 = await callApi(prompt2, options, false);
    const jsonText2 = extractJson(resultText2);
    
    if (!jsonText2) {
        // If both attempts fail to produce JSON, return a default "not found" response.
        return {
            found: false,
            description: "The AI's response could not be understood after two attempts. It's likely no file upload form was found.",
            manualTestingGuide: "",
        };
    }
    // Return the result of the second attempt, whatever it is.
    return await parseJsonWithCorrection<FileUploadAnalysisResult>(jsonText2, prompt2, options);
};


export const analyzeJwt = async (header: object, payload: object, mode: 'blue_team' | 'red_team', options: ApiOptions): Promise<string> => {
    const prompt = mode === 'blue_team' 
        ? createJwtBlueTeamPrompt(JSON.stringify(header, null, 2), JSON.stringify(payload, null, 2))
        : createJwtRedTeamPrompt(JSON.stringify(header, null, 2), JSON.stringify(payload, null, 2));
    return callApi(prompt, options, false);
};

export const analyzeHeaders = async (url: string, options: ApiOptions): Promise<HeadersReport> => {
    const prompt = createHeadersAnalysisPrompt(url);
    const resultText = await callApi(prompt, options, false); // Uses search
    const jsonText = extractJson(resultText);
    if (!jsonText) {
        return {
            analyzedUrl: url,
            overallScore: 'F',
            summary: "Could not analyze headers due to an issue with the AI's response format.",
            findings: []
        };
    }
    const result = await parseJsonWithCorrection<HeadersReport>(jsonText, prompt, options);
    if (!result.analyzedUrl) {
        result.analyzedUrl = url;
    }
    return result;
};

export const findPrivescExploits = async (technology: string, version: string, options: ApiOptions): Promise<VulnerabilityReport> => {
    const prompt = createPrivescPathfinderPrompt(technology, version);
    const resultText = await callApi(prompt, options, false); // Uses search
    const jsonText = extractJson(resultText);
    if (!jsonText) {
        return processReport({
            analyzedTarget: `${technology} ${version}`,
            vulnerabilities: [],
        });
    }
    const result = await parseJsonWithCorrection<any>(jsonText, prompt, options);

    const report: VulnerabilityReport = {
        analyzedTarget: `${technology} ${version}`,
        vulnerabilities: (result.exploits || []).map((exploit: any) => {
            let severity = Severity.UNKNOWN;
            const score = parseFloat(exploit.cvss_score);
            if (score >= 9.0) severity = Severity.CRITICAL;
            else if (score >= 7.0) severity = Severity.HIGH;
            else if (score >= 4.0) severity = Severity.MEDIUM;
            else if (score > 0) severity = Severity.LOW;

            return {
                vulnerability: exploit.cve_id || "Unknown CVE",
                severity: severity,
                description: exploit.summary || "No summary provided.",
                impact: "Potential for Privilege Escalation or Remote Code Execution.",
                recommendation: `Review the following public exploits:\n${(exploit.exploit_urls || []).join('\n') || "No exploit URLs found."}`,
                vulnerableCode: `${technology} ${version}`
            };
        })
    };
    return processReport(report);
};

export const analyzeDomXss = async (code: string, options: ApiOptions): Promise<DomXssAnalysisResult> => {
  const prompt = createDomXssPathfinderPrompt(code);
  const resultText = await callApi(prompt, options, true);
  return await parseJsonWithCorrection<DomXssAnalysisResult>(resultText, prompt, options);
};

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

// --- Chat Functions ---
const callOpenRouterChat = async (history: ChatMessage[], options: ApiOptions) => {
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

export const startExploitChat = async (context: ExploitContext, options: ApiOptions): Promise<string> => {
    const prompt = createInitialExploitChatPrompt(context);
    const initialHistory: ChatMessage[] = [{ role: 'user', content: prompt }];
    return callOpenRouterChat(initialHistory, options);
};

export const startSqlExploitChat = async (context: ExploitContext, options: ApiOptions): Promise<string> => {
    const prompt = createInitialSqlExploitChatPrompt(context);
    const initialHistory: ChatMessage[] = [{ role: 'user', content: prompt }];
    return callOpenRouterChat(initialHistory, options);
};

export const continueExploitChat = async (history: ChatMessage[], newUserMessage: string, options: ApiOptions): Promise<string> => {
    const updatedHistory: ChatMessage[] = [...history, { role: 'user', content: newUserMessage }];
    return callOpenRouterChat(updatedHistory, options);
};

export const startGeneralChat = async (systemPrompt: string, userMessage: string, options: ApiOptions): Promise<string> => {
    const initialHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
    ];
    return callOpenRouterChat(initialHistory, options);
};

export const continueGeneralChat = async (systemPrompt: string, history: ChatMessage[], newUserMessage: string, options: ApiOptions): Promise<string> => {
    const fullHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: newUserMessage }
    ];
    return callOpenRouterChat(fullHistory, options);
};

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
