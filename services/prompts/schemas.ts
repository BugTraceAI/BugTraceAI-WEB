// services/prompts/schemas.ts
// Shared prompt schemas and helpers to eliminate duplication across prompt files.

/**
 * Extracts the hostname from a URL string.
 * Pure function -- no I/O, no side effects.
 */
export const extractHostname = (url: string): string => new URL(url).hostname;

/**
 * The VulnerabilityReport JSON output schema block, shared by DAST (recon, active, greybox),
 * SAST, JS Recon, and consolidation prompts. Includes the full field descriptions.
 *
 * @param includeInjectionPoint Whether to include the injectionPoint field description.
 *        DAST prompts include it; SAST prompts omit it.
 */
export const vulnReportSchema = (includeInjectionPoint: boolean = true): string => {
    const injectionPointLine = includeInjectionPoint
        ? `\n    - "injectionPoint": (object or null) The injection point details. Mandatory for injection vulnerabilities, otherwise \`null\`.`
        : '';

    return `**Output Format:**
    Your entire response MUST be a single, valid JSON object that conforms to the VulnerabilityReport schema.
    - The root object MUST have 'analyzedTarget' and 'vulnerabilities' keys.
    - 'analyzedTarget' MUST be the root URL being analyzed.
    - 'vulnerabilities' MUST be an array of vulnerability objects. If no vulnerabilities are found, it must be an empty array [].

    For EACH object inside the 'vulnerabilities' array, you MUST include these exact keys:
    - "vulnerability": (string) The specific name of the weakness (e.g., "Error-Based SQL Injection"). This field is mandatory.
    - "severity": (string) The severity, judged by its exploitability and impact.
    - "description": (string) A step-by-step guide on how to reproduce the vulnerability.
    - "impact": (string) A specific, worst-case scenario an attacker could achieve.
    - "vulnerableCode": (string) The final, working Proof-of-Concept payload.
    - "recommendation": (string) A brief, concise mitigation strategy.${injectionPointLine}`;
};

/**
 * The standard JSON-only output reminder appended to the end of prompts.
 * Instructs the model to produce raw JSON without conversational text or markdown.
 */
export const JSON_ONLY_REMINDER = `Do not add any conversational text or markdown. The raw response must be only the JSON object.`;

/**
 * Stricter variant: response must start with '{' and end with '}'.
 * Used by consolidation, jsonFix, xss, payloadForge, and ssti prompts.
 */
export const JSON_ONLY_STRICT = `Do not include any conversational text or markdown formatting. The response must start with '{' and end with '}'.`;

/**
 * The deep analysis instruction block shared by deepAnalysis.ts and sast.ts (deep analysis).
 * Instructs the model to refine an initial finding into a high-quality report.
 */
export const DEEP_ANALYSIS_INSTRUCTIONS = `**Instructions for the new JSON object:**
    1.  **"description"**: Rewrite this into a precise, step-by-step **Proof-of-Concept** guide.
    2.  **"impact"**: Rewrite this to be a specific, high-impact scenario. Don't be generic.
    3.  **"recommendation"**: Provide a concise recommendation with a "before" and "after" code example if possible.`;

/**
 * The standard closing line for deep analysis prompts.
 */
export const DEEP_ANALYSIS_JSON_REMINDER = `Your entire response MUST be only the single, updated JSON object. All string values must be properly escaped.
    Do not add any conversational text or markdown. The raw response must be only the JSON object.`;
