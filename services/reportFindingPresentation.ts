export interface ReportFindingEvidence {
  description?: unknown;
  details?: unknown;
  summary?: unknown;
  http_request?: string;
  http_response?: string;
  response_status?: number;
  response_excerpt?: string;
}

export function getFindingNarrative(finding: ReportFindingEvidence): string {
  const value = finding.description || finding.details || finding.summary;
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function getFindingHttpEvidence(finding: ReportFindingEvidence) {
  const request = finding.http_request || '';
  const response = finding.http_response || finding.response_excerpt || '';
  const status = finding.response_status;
  if (!request && !response && status == null) return null;
  return { request, response, status };
}
