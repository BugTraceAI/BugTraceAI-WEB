// services/prompts/dast.ts
import type { DastScanType } from '../../types';
import { extractHostname, vulnReportSchema, JSON_ONLY_REMINDER } from './schemas.ts';
import { DAST_RECON_VARIATIONS, DAST_ACTIVE_VARIATIONS, selectVariation } from './variations.ts';

/**
 * Creates the prompt for DAST (Recon Scan). Focuses on public information.
 * @param url The URL to analyze.
 * @param iteration The current recursive iteration, used to select a prompt variation.
 * @returns The complete prompt string.
 */
const createReconDastAnalysisPrompt = (url: string, iteration: number): string => {
    const hostname = extractHostname(url);
    const focus = selectVariation(DAST_RECON_VARIATIONS, iteration).replace('{hostname}', hostname);

    return `
    Act as an expert bug bounty hunter performing reconnaissance on ${url}.
    Your primary goal is to ${focus}

    **Methodology:**
    1.  **Public Exploit Search (Top Priority):** Based on your goal, search for known vulnerabilities and public exploits for the domain \`${hostname}\` and any discovered technologies.
    2.  **Technology Fingerprinting:** Identify the tech stack (e.g., WordPress, PHP, specific jQuery versions) and search for known vulnerabilities for those specific versions.

    ${vulnReportSchema(true)}

    ${JSON_ONLY_REMINDER}
`;
};

/**
 * Creates the prompt for DAST (Active Scan - Simulated). Focuses on deep structural analysis.
 * @param url The URL to analyze.
 * @param iteration The current recursive iteration, used to select a prompt variation.
 * @returns The complete prompt string.
 */
const createActiveDastAnalysisPrompt = (url: string, iteration: number): string => {
    const hostname = extractHostname(url);
    const focus = selectVariation(DAST_ACTIVE_VARIATIONS, iteration).replace('{hostname}', hostname);

    return `
    Act as a top-tier bug bounty hunter. Your task is to ${focus}

    **Methodology:**
    1.  **Spider & Enumerate:** Find ALL pages, endpoints, parameters, and headers on \`site:${hostname}\`.
    2.  **Exploitation-Focused Hypothesis:** Based on your assigned focus, hypothesize and attempt to prove vulnerabilities.
    3.  **Proof-of-Concept Generation:** For every vulnerability you claim to have found, you MUST provide a clear, working proof-of-concept payload in the "vulnerableCode" field. For SQLi, this must be a working UNION SELECT payload if possible.

    ${vulnReportSchema(true)}

    ${JSON_ONLY_REMINDER}
`;
};

/**
 * Creates the prompt for DAST (Grey Box Scan). Combines active scan with client-side code analysis.
 * @param url The URL to analyze.
 * @param iteration The current recursive iteration, used to select a prompt variation.
 * @returns The complete prompt string.
 */
const createGreyBoxDastAnalysisPrompt = (url: string, iteration: number): string => {
    const hostname = extractHostname(url);
    const focus = selectVariation(DAST_ACTIVE_VARIATIONS, iteration).replace('{hostname}', hostname);

    return `
    Act as an expert grey box penetration tester with a red team mindset. Your task is to find exploitable vulnerabilities in ${url} by correlating dynamic behavior with client-side code weaknesses.
    Your specific focus for this run is to ${focus}.

    **Methodology:**

    **Phase 1: Dynamic Analysis (DAST)**
    1.  **Spider & Enumerate:** Find all endpoints and input vectors on \`${hostname}\`.
    2.  **Hypothesize & Prove Exploits:** Based on your focus, find reflection points for XSS, identify potential SQLi parameters, or analyze business logic.

    **Phase 2: Client-Side Code Analysis (SAST)**
    3.  **Fetch & Analyze JavaScript:** Fetch all linked JavaScript files from \`${url}\`. Statically analyze this code for DOM XSS sources/sinks, hardcoded secrets, and API endpoints.

    **Phase 3: Correlate & Report**
    4.  **Chain & Correlate:** This is the most critical step. Connect your findings. For example, if DAST shows a reflection and SAST shows it flows into \`.innerHTML\`, you have a high-confidence finding.
    5.  **Generate Report:** Provide your final report as a single, strict JSON object.
        - In the "description" for a correlated finding, you MUST explain how the dynamic and static evidence combine to prove the exploit. This field must serve as a reproduction guide.

    ${vulnReportSchema(true)}

    ${JSON_ONLY_REMINDER}
`;
};


/**
 * Factory function to create the appropriate DAST analysis prompt based on scan type.
 * @param url The URL to analyze.
 * @param scanType The type of scan to perform.
 * @param iteration The current recursive iteration, used to select a prompt variation.
 * @returns The complete prompt string.
 */
export const createDastAnalysisPrompt = (url: string, scanType: DastScanType, iteration: number): string => {
    switch (scanType) {
        case 'recon':
            return createReconDastAnalysisPrompt(url, iteration);
        case 'active':
            return createActiveDastAnalysisPrompt(url, iteration);
        case 'greybox':
            return createGreyBoxDastAnalysisPrompt(url, iteration);
        default:
            return createActiveDastAnalysisPrompt(url, iteration); // Default to active for safety
    }
};
