// @author: Albert C | @yz9yt | github.com/yz9yt
// services/analysisService.ts
// Analysis domain functions. Each function orchestrates prompt creation, API call,
// JSON parsing, and report normalization for a specific analysis type.

import type {
    ApiOptions, Vulnerability, VulnerabilityReport,
    HeadersReport, DomXssAnalysisResult, FileUploadAnalysisResult, DastScanType
} from '../types.ts';
import { Severity } from '../types.ts';
import { callApi, extractJson, parseJsonWithCorrection } from './apiClient.ts';
import { processReport } from '../lib/reportProcessing.ts';
import {
    createSastAnalysisPrompt,
    createSastDeepAnalysisPrompt,
    createDastAnalysisPrompt,
    createDeepAnalysisPrompt,
    createHeadersAnalysisPrompt,
    createJsReconPrompt,
    createDomXssPathfinderPrompt,
    createFileUploadAnalysisPrompt,
    createFileUploadAnalysisPromptAttempt2,
    createJwtBlueTeamPrompt,
    createJwtRedTeamPrompt,
    createConsolidationPrompt,
    createPrivescPathfinderPrompt,
    createValidationPrompt,
} from './prompts/index.ts';

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
