// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReportViewer } from '../hooks/useReportViewer';

function Probe({ reportId }: { reportId: string }) {
  const { findings, detections, loading } = useReportViewer(reportId);
  return <div>{JSON.stringify({ types: findings.map(f => f.type), detections: detections.length, loading })}</div>;
}

const jsonResponse = (value: unknown) => ({ ok: true, json: async () => value }) as Response;
const textResponse = (value: string) => ({ ok: true, text: async () => value }) as Response;
const missingResponse = { ok: false, status: 404 } as Response;

describe('open report refresh', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('updates an open partial report when validated XSS arrives and keeps it during a failed refresh', async () => {
    let stage: 'partial' | 'final' | 'unavailable' = 'partial';
    const initial = Array.from({ length: 7 }, (_, i) => ({ type: `finding-${i}`, severity: 'HIGH' }));
    const final = [...initial, ...Array.from({ length: 4 }, (_, i) => ({ type: `new-${i}`, severity: 'HIGH' })), { type: 'XSS', severity: 'HIGH' }];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('validated_findings.json')) return stage === 'unavailable' ? missingResponse : jsonResponse({ findings: stage === 'partial' ? initial : final });
      if (url.includes('raw_findings.json')) return jsonResponse({ findings: [] });
      if (url.includes('final_report.md')) return textResponse('Report');
      if (url.includes('engagement_data.json')) return jsonResponse({ stats: {} });
      return jsonResponse({ findings: Array.from({ length: 14 }, () => ({ type: 'XSS' })) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => { root.render(<Probe reportId="1" />); });
    expect(JSON.parse(container.textContent!).types).toHaveLength(7);
    expect(JSON.parse(container.textContent!).detections).toBe(14);

    stage = 'final';
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(JSON.parse(container.textContent!).types).toContain('XSS');
    expect(JSON.parse(container.textContent!).types).toHaveLength(12);
    expect(JSON.parse(container.textContent!).loading).toBe(false);
    expect(fetchMock.mock.calls.every((call: any[]) => call[1]?.cache === 'no-store')).toBe(true);

    stage = 'unavailable';
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(JSON.parse(container.textContent!).types).toHaveLength(12);
    expect(JSON.parse(container.textContent!).types).toContain('XSS');
    expect(fetchMock.mock.calls.some((call: any[]) => String(call[0]).includes('raw_findings.json'))).toBe(false);
  });

  it('replaces a raw fallback with the validated report when it becomes available', async () => {
    let ready = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('validated_findings.json')) return ready ? jsonResponse({ findings: [{ type: 'XSS', severity: 'HIGH' }] }) : missingResponse;
      if (url.includes('raw_findings.json')) return jsonResponse({ findings: [{ type: 'SQLI', severity: 'HIGH' }] });
      if (url.includes('final_report.md')) return textResponse('Report');
      if (url.includes('engagement_data.json')) return jsonResponse({ stats: {} });
      return jsonResponse({ findings: [] });
    }));

    await act(async () => { root.render(<Probe reportId="1" />); });
    expect(JSON.parse(container.textContent!).types).toEqual(['SQLI']);
    ready = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(JSON.parse(container.textContent!).types).toEqual(['XSS']);
  });

  it('does not apply a late response from a previously viewed scan', async () => {
    let finishOldRequest!: (response: Response) => void;
    const oldRequest = new Promise<Response>(resolve => { finishOldRequest = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('validated_findings.json')) {
        return url.includes('/scans/1/') ? oldRequest : jsonResponse({ findings: [{ type: 'XSS', severity: 'HIGH' }] });
      }
      if (url.includes('final_report.md')) return textResponse('Report');
      if (url.includes('engagement_data.json')) return jsonResponse({ stats: {} });
      return jsonResponse({ findings: [] });
    }));

    await act(async () => { root.render(<Probe reportId="1" />); });
    await act(async () => { root.render(<Probe reportId="2" />); });
    expect(JSON.parse(container.textContent!).types).toEqual(['XSS']);
    await act(async () => { finishOldRequest(jsonResponse({ findings: [{ type: 'SQLI', severity: 'HIGH' }] })); });
    expect(JSON.parse(container.textContent!).types).toEqual(['XSS']);
  });
});
