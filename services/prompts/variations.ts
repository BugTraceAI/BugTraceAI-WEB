// services/prompts/variations.ts
// Centralized variation/persona system for multi-iteration prompts.
// Pure module -- no I/O, no side effects.

/**
 * DAST Recon scan variations. Each string describes a different reconnaissance focus area.
 * The `{hostname}` placeholder is replaced at prompt-build time.
 */
export const DAST_RECON_VARIATIONS: string[] = [
    "focus on public exploits and technology fingerprinting to find known vulnerabilities.",
    "prioritize identifying the exact versions of all software (CMS, frameworks, libraries) and searching CVE databases exhaustively.",
    "search for publicly exposed administrative panels, forgotten subdomains, and development endpoints.",
    "investigate the target for past data breaches or security incidents that might hint at recurring weaknesses.",
    "use advanced search operators to find sensitive files indexed by search engines, like `site:{hostname} filetype:log` or `inurl:config`.",
];

/**
 * DAST Active scan variations. Each string describes a different offensive testing strategy.
 * Also used by the grey-box scan prompt.
 */
export const DAST_ACTIVE_VARIATIONS: string[] = [
    "perform a simulated ACTIVE scan of all inputs, focusing on high-impact, exploitable vulnerabilities like SQLi and RCE.",
    "relentlessly probe every parameter for injection vulnerabilities. Your primary goal is to prove SQLi with a UNION SELECT, or find a vector for Command Injection or SSTI.",
    "focus on finding information disclosure and misconfigurations. Look for exposed directories, verbose error messages, sensitive data in responses, and insecure API endpoints.",
    "analyze the application's business logic. How could features be abused? Look for IDORs, broken access control, parameter tampering, and race conditions.",
    "assume the application has a weak WAF. Craft clever payloads to find reflected, stored, and DOM-based XSS. Pay special attention to unusual contexts and encoding bypasses.",
];

/**
 * SAST analysis personas. Each string describes a different code-review perspective.
 */
export const SAST_PERSONAS: string[] = [
    "expert security researcher specializing in white-box code analysis with a bug bounty hunter's mindset",
    "meticulous code auditor with a focus on subtle logic flaws and insecure data handling patterns",
    "penetration tester attempting to find high-impact, chainable vulnerabilities that could lead to a system compromise",
    "automated SAST tool developer, creating a prompt that finds OWASP Top 10 vulnerabilities with high precision",
    "developer performing a peer review, looking for common mistakes, insecure library usage, and 'low-hanging fruit' vulnerabilities",
];

/**
 * Selects a variation/persona from an array based on iteration number.
 * Uses modulo to cycle through the list deterministically.
 *
 * Pure function -- no I/O, no side effects.
 *
 * @param variations The array of variation strings.
 * @param iteration The current recursive iteration (0-based).
 * @returns The selected variation string.
 */
export const selectVariation = (variations: string[], iteration: number): string =>
    variations[iteration % variations.length];
