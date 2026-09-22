import { describe, expect, it } from 'vitest';
import { buildRawRequestFromSeed, isRepeaterEligible } from './finisherSeed.ts';

describe('isRepeaterEligible', () => {
  it('accepts API findings that are actionable but still need validation', () => {
    expect(isRepeaterEligible('Needs validation: Missing Authentication Test with Fuzzed Params')).toBe(true);
    expect(isRepeaterEligible('Needs validation: BOLA Test')).toBe(true);
    expect(isRepeaterEligible('Needs validation: BOPLA Test')).toBe(true);
  });

  it('does not route informational or hardening-only findings to AIrepeater', () => {
    expect(isRepeaterEligible('Missing security headers')).toBe(false);
    expect(isRepeaterEligible('Technology fingerprinting')).toBe(false);
  });

  it('requires a usable HTTP request when context is supplied', () => {
    expect(isRepeaterEligible('BOLA Test', { url: 'https://example.test/api/users/1', method: 'GET' })).toBe(true);
    expect(isRepeaterEligible('BOLA Test', { url: '', method: 'GET' })).toBe(false);
    expect(isRepeaterEligible('BOLA Test', { url: 'https://example.test/api/users/1', method: '' })).toBe(false);
  });

  it('builds a single method in the raw request line', () => {
    const raw = buildRawRequestFromSeed({
      vulnType: 'Missing Authentication',
      url: 'https://example.test/api/debug/vulns',
      method: 'GET',
    });
    expect(raw.split('\n', 1)[0]).toBe('GET /api/debug/vulns HTTP/1.1');
    expect(raw).not.toContain('GET GET');
  });
});
