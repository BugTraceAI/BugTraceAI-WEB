import type { RepeaterFindingRequest, RepeaterFindingResponse } from '../lib/cliApi.ts';
import { parseRawRequest, type ParsedResponse } from './finisherSeed.ts';

interface BuildRepeaterFindingInput {
  rawRequest: string;
  currentRequest: string;
  parsed: ParsedResponse | null;
  transportOk: boolean;
  scheme: string;
  type: string;
  severity: string;
  parameter?: string;
  summary: string;
  responseExcerpt?: string;
  sourceFindingId?: number;
}

export function buildRepeaterFindingRequest(input: BuildRepeaterFindingInput): RepeaterFindingRequest {
  if (!input.parsed) throw new Error('no HTTP request has been sent');
  if (!input.rawRequest || input.rawRequest !== input.currentRequest) {
    throw new Error('request was modified since the last send');
  }
  if (!input.transportOk) throw new Error('last request failed at the curl/network layer');
  if (input.parsed.status < 100 || input.parsed.status > 599) {
    throw new Error('last response has no valid HTTP status');
  }

  const sent = parseRawRequest(input.rawRequest, input.scheme);
  if (!sent.url) throw new Error('sent request has no valid URL');

  return {
    type: input.type,
    severity: input.severity,
    url: sent.url,
    parameter: input.parameter,
    summary: input.summary,
    request: input.rawRequest,
    response_status: input.parsed.status,
    request_ok: true,
    response_excerpt: (input.responseExcerpt ?? input.parsed.body).slice(0, 4000),
    source_finding_id: input.sourceFindingId,
  };
}

export function repeaterPersistenceKey(scanId: number, finding: RepeaterFindingRequest): string {
  return `${scanId}:${finding.type}:${finding.url}:${finding.parameter || ''}`;
}

export function requirePersistenceSuccess(response: RepeaterFindingResponse): void {
  if (!response.success) throw new Error(response.message || 'finding persistence failed');
}
