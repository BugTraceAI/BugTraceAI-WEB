// lib/reportProcessing.ts
// Pure functions for report normalization and processing.
// No I/O, no fetch, no state, no side effects.

import { Severity } from '../types.ts';
import type { VulnerabilityReport } from '../types.ts';

/**
 * Normalizes a severity string to a valid Severity enum value.
 * Returns Severity.UNKNOWN if the input does not match any known severity.
 *
 * Pure function.
 *
 * @param severity The raw severity string from the AI response.
 * @returns A valid Severity enum value.
 */
export const normalizeSeverity = (severity: string): Severity =>
    Object.values(Severity).includes(severity as Severity)
        ? (severity as Severity)
        : Severity.UNKNOWN;

/**
 * Normalizes a VulnerabilityReport by ensuring all severity values
 * in each vulnerability match the Severity enum.
 *
 * Pure function -- returns a new object, does not mutate the input.
 *
 * @param report The raw report from the AI response.
 * @returns A new report with all severity values normalized.
 */
export const processReport = (report: VulnerabilityReport): VulnerabilityReport => {
    const vulnerabilities = (report.vulnerabilities || []).map(v => ({
        ...v,
        severity: normalizeSeverity(v.severity),
    }));
    return { ...report, vulnerabilities };
};
