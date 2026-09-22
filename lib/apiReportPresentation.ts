/**
 * Presentation helpers for BugTraceAI-API report payloads.
 *
 * API scans persist a structured `ai_analysis` object. Older responses can
 * contain that object as a JSON string, while the nested PoC text is Markdown.
 * Keeping the decoding here prevents the report UI from falling back to a
 * single JSON line with literal `\\n` sequences.
 */

import { normalizeMarkdownDocument } from './markdownTransformers';

export type ApiAnalysisPoc = {
  finding_id?: string;
  title?: string;
  severity?: string;
  endpoint?: string;
  poc?: string;
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

/** Decode control characters left escaped by older API serializers. */
export const decodeApiReportText = (value: string): string => value
  .replace(/\\r\\n/g, '\n')
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\t/g, '\t');

// JSON.parse already turns document-level escapes into real line breaks. Only
// decode strings that contain no real line break at all; this preserves code
// examples such as `log.join('\\n')` inside an otherwise multiline PoC.
const decodePersistedText = (value: string): string => (
  /[\r\n]/.test(value) ? value : decodeApiReportText(value)
);

const decodeNestedText = (value: unknown): unknown => {
  if (typeof value === 'string') return decodePersistedText(value);
  if (Array.isArray(value)) return value.map(decodeNestedText);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeNestedText(item)]));
  }
  return value;
};

/** Parse an API field that may be an object, a JSON string, or Markdown text. */
export const parseApiReportValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Some persisted records escaped the whole JSON document before storing it.
    const decoded = decodeApiReportText(value);
    if (decoded !== value) {
      try {
        return JSON.parse(decoded) as unknown;
      } catch {
        // It is still useful as readable Markdown/plain text below.
      }
    }
    return decoded;
  }
};

const isReferenceUrl = (value: string): boolean => /developer\.mozilla\.org|cwe\.mitre\.org|owasp\.org|portswigger\.net\/web-security/i.test(value);

/** Keep stale AI report headers aligned with the tested target. */
const normalizeMarkdownEndpoints = (markdown: string, target?: string): string => {
  if (!target) return markdown;
  return markdown.replace(/^(\*\*Endpoint:\*\*)\s*(?:`)?(https?:\/\/[^`\s]+)(?:`)?\s*$/gim, (line, label: string, endpoint: string) => (
    isReferenceUrl(endpoint) ? `${label} ${target}` : line
  ));
};

/** Return the generated Markdown report when the API supplied one. */
export const getApiAnalysisMarkdown = (value: unknown, target?: string): string | null => {
  const parsed = parseApiReportValue(value);
  if (isRecord(parsed) && typeof parsed.report_md === 'string') {
    return normalizeMarkdownEndpoints(normalizeMarkdownDocument(decodePersistedText(parsed.report_md)), target);
  }
  // A few early API builds returned the Markdown directly rather than wrapping
  // it in `{ report_md, pocs }`.
  if (typeof parsed === 'string' && /^\s{0,3}(?:#|##|\*\*|[-*+]\s)/m.test(parsed)) {
    return normalizeMarkdownEndpoints(normalizeMarkdownDocument(decodePersistedText(parsed)), target);
  }
  return null;
};

/** Extract structured PoCs for a readable fallback when report_md is absent. */
export const getApiAnalysisPocs = (value: unknown): ApiAnalysisPoc[] => {
  const parsed = parseApiReportValue(value);
  if (!isRecord(parsed) || !Array.isArray(parsed.pocs)) return [];
  return parsed.pocs
    .filter(isRecord)
    .map(item => decodeNestedText(item) as ApiAnalysisPoc);
};

/** Produce a bounded, human-readable text representation for JSON fallbacks. */
export const formatApiReportValue = (value: unknown): string => {
  const parsed = decodeNestedText(parseApiReportValue(value));
  if (typeof parsed === 'string') return parsed;
  try {
    return JSON.stringify(parsed, null, 2) ?? String(parsed);
  } catch {
    return String(parsed);
  }
};
