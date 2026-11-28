import { describe, it, expect } from 'vitest';
import {
  selectExchange,
  selectNode,
  exchangeForStep,
  highestSeverity,
  formatRawRequest,
  formatRawResponse,
  type WorkbenchState,
} from './workbenchModel';

const fixture = (): WorkbenchState => ({
  exchanges: [
    {
      id: 'ex-1',
      request: {
        method: 'POST',
        url: 'https://shop.example.test/api/login?next=/cart',
        headers: { 'Content-Type': 'application/json' },
        body: '{"user":"a\'"}',
      },
      response: { status: 500, reason: 'Internal Server Error', headers: {}, body: 'SQL error', timeMs: 212 },
    },
  ],
  timeline: [
    { id: 's-1', title: 'Map login form', detail: '', status: 'done', role: 'recon' },
    { id: 's-2', title: 'Test quote injection', detail: '', status: 'flagged', role: 'scanner', exchangeId: 'ex-1' },
  ],
  nodes: [
    { id: 'n-1', label: 'shop.example.test', kind: 'root_domain', role: 'recon', x: 0.2, y: 0.3 },
    { id: 'n-2', label: 'SQLi on /api/login', kind: 'finding', role: 'validator', severity: 'high', x: 0.7, y: 0.5 },
    { id: 'n-3', label: 'Info banner', kind: 'service', role: 'reporter', severity: 'info', x: 0.5, y: 0.8 },
  ],
  edges: [{ from: 'n-1', to: 'n-2' }],
  selectedExchangeId: null,
  selectedNodeId: null,
});

describe('selection', () => {
  it('selects a known exchange without mutating the input', () => {
    const s = fixture();
    const next = selectExchange(s, 'ex-1');
    expect(next.selectedExchangeId).toBe('ex-1');
    expect(s.selectedExchangeId).toBeNull();
  });

  it('rejects an unknown exchange id', () => {
    expect(() => selectExchange(fixture(), 'missing')).toThrow('unknown exchange: missing');
  });

  it('selects a known node and rejects an unknown one', () => {
    expect(selectNode(fixture(), 'n-2').selectedNodeId).toBe('n-2');
    expect(() => selectNode(fixture(), 'nope')).toThrow('unknown node: nope');
  });
});

describe('exchangeForStep', () => {
  it('returns the linked exchange for a step that has one', () => {
    expect(exchangeForStep(fixture(), 's-2')?.id).toBe('ex-1');
  });

  it('returns undefined for a step with no exchange', () => {
    expect(exchangeForStep(fixture(), 's-1')).toBeUndefined();
  });
});

describe('highestSeverity', () => {
  it('returns the most severe node severity', () => {
    expect(highestSeverity(fixture().nodes)).toBe('high');
  });

  it('returns null when no node has a severity', () => {
    expect(highestSeverity([{ id: 'a', label: 'a', kind: 'endpoint', role: 'recon', x: 0, y: 0 }])).toBeNull();
  });
});

describe('raw HTTP formatting', () => {
  it('renders the request line, Host header and body', () => {
    const raw = formatRawRequest(fixture().exchanges[0].request);
    expect(raw.split('\n')[0]).toBe('POST /api/login?next=/cart HTTP/1.1');
    expect(raw).toContain('Host: shop.example.test');
    expect(raw.endsWith('{"user":"a\'"}')).toBe(true);
  });

  it('renders the status line for a response', () => {
    const raw = formatRawResponse(fixture().exchanges[0].response);
    expect(raw.split('\n')[0]).toBe('HTTP/1.1 500 Internal Server Error');
  });
});
