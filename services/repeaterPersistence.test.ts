import { describe, expect, it } from 'vitest';
import {
  buildRepeaterFindingRequest,
  repeaterPersistenceKey,
  requirePersistenceSuccess,
} from './repeaterPersistence.ts';

const raw = 'POST /api/graphql HTTP/1.1\nHost: bugstore.bugtraceai.com\nContent-Type: application/json\n\n{"query":"{ users { id email } }"}';
const parsed = { statusLine: 'HTTP/1.1 200 OK', status: 200, headers: '', body: '{"data":{}}' };

function build(overrides: Record<string, unknown> = {}) {
  return buildRepeaterFindingRequest({
    rawRequest: raw,
    currentRequest: raw,
    parsed,
    transportOk: true,
    scheme: 'https',
    type: 'GraphQL Information Disclosure',
    severity: 'MEDIUM',
    parameter: 'query',
    summary: 'Unauthenticated user data returned',
    ...overrides,
  });
}

describe('Repeater persistence exchange', () => {
  it('uses the URL from the sent request and includes strict evidence', () => {
    const finding = build();
    expect(finding.url).toBe('https://bugstore.bugtraceai.com/api/graphql');
    expect(finding.request).toBe(raw);
    expect(finding.response_status).toBe(200);
    expect(finding.request_ok).toBe(true);
  });

  it('rejects a curl/network failure', () => {
    expect(() => build({ transportOk: false })).toThrow(/curl\/network/);
  });

  it('rejects a request edited after the response', () => {
    expect(() => build({ currentRequest: `${raw} ` })).toThrow(/modified/);
  });

  it('rejects status zero', () => {
    expect(() => build({ parsed: { ...parsed, status: 0 } })).toThrow(/HTTP status/);
  });

  it('deduplicates independently per URL', () => {
    const graphql = build();
    const profile = buildRepeaterFindingRequest({
      rawRequest: 'GET /profile HTTP/1.1\nHost: bugstore.bugtraceai.com\n\n',
      currentRequest: 'GET /profile HTTP/1.1\nHost: bugstore.bugtraceai.com\n\n',
      parsed,
      transportOk: true,
      scheme: 'https',
      type: graphql.type,
      severity: graphql.severity,
      parameter: graphql.parameter,
      summary: graphql.summary,
    });
    expect(repeaterPersistenceKey(86, graphql)).not.toBe(repeaterPersistenceKey(86, profile));
  });

  it('rejects a CLI success=false response', () => {
    expect(() => requirePersistenceSuccess({ finding_id: 0, created: false, success: false, message: 'rolled back' }))
      .toThrow(/rolled back/);
  });
});
