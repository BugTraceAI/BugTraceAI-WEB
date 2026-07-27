import { describe, expect, it } from 'vitest';
import { getFindingHttpEvidence, getFindingNarrative } from './reportFindingPresentation.ts';

describe('report finding presentation', () => {
  it('uses Repeater summary when enrichment description is unavailable', () => {
    expect(getFindingNarrative({ summary: 'Confirmed encoded path traversal' }))
      .toBe('Confirmed encoded path traversal');
  });

  it('serializes legacy object narratives safely', () => {
    expect(getFindingNarrative({ description: { reason: 'Confirmed' } }))
      .toContain('"reason": "Confirmed"');
  });

  it('exposes persisted Repeater request and response proof', () => {
    expect(getFindingHttpEvidence({
      http_request: 'GET /etc/passwd HTTP/1.1',
      response_status: 200,
      response_excerpt: 'root:x:0:0:root:/root:/bin/bash',
    })).toEqual({
      request: 'GET /etc/passwd HTTP/1.1',
      status: 200,
      response: 'root:x:0:0:root:/root:/bin/bash',
    });
  });

  it('returns no evidence panel for an empty finding', () => {
    expect(getFindingHttpEvidence({})).toBeNull();
  });
});
