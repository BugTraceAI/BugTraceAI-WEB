// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WorkbenchPage } from './WorkbenchPage';
import { type WorkbenchState } from './workbenchModel';

const state: WorkbenchState = {
  exchanges: [
    {
      id: 'ex-1',
      request: { method: 'GET', url: 'https://shop.example.test/a', headers: {}, body: '' },
      response: { status: 200, reason: 'OK', headers: {}, body: 'hi', timeMs: 5 },
    },
  ],
  timeline: [{ id: 's-1', title: 'Probe', detail: 'd', status: 'running', role: 'scanner', exchangeId: 'ex-1' }],
  nodes: [{ id: 'n-1', label: 'shop.example.test', kind: 'root_domain', role: 'recon', x: 0.2, y: 0.3 }],
  edges: [],
  selectedExchangeId: null,
  selectedNodeId: null,
};

describe('WorkbenchPage', () => {
  afterEach(() => cleanup());

  it('shows the raw request and response for the first exchange', () => {
    render(<WorkbenchPage initialState={state} />);
    expect(screen.getByText(/GET \/a HTTP\/1.1/)).toBeTruthy();
    expect(screen.getByText(/HTTP\/1.1 200 OK/)).toBeTruthy();
  });

  it('marks a clicked node as pressed', () => {
    render(<WorkbenchPage initialState={state} />);
    const node = screen.getByRole('button', { name: 'shop.example.test' });
    fireEvent.click(node);
    expect(node.getAttribute('aria-pressed')).toBe('true');
  });
});
