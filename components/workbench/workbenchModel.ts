// Pure model for the AIrepeater / Swarm workbench prototype. No React imports,
// so it can be unit-tested without a DOM.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type StepStatus = 'done' | 'running' | 'pending' | 'flagged';
export type NodeKind = 'root_domain' | 'subdomain' | 'service' | 'endpoint' | 'finding';
export type AgentRole = 'recon' | 'scanner' | 'validator' | 'reporter';

export interface HttpMessage {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface HttpResponse {
  status: number;
  reason: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
}

export interface Exchange {
  id: string;
  request: HttpMessage;
  response: HttpResponse;
}

export interface TimelineStep {
  id: string;
  title: string;
  detail: string;
  status: StepStatus;
  role: AgentRole;
  exchangeId?: string;
}

export interface SwarmNode {
  id: string;
  label: string;
  kind: NodeKind;
  role: AgentRole;
  severity?: Severity;
  x: number; // 0..1 canvas coordinates
  y: number;
}

export interface SwarmEdge {
  from: string;
  to: string;
}

export interface WorkbenchState {
  exchanges: Exchange[];
  timeline: TimelineStep[];
  nodes: SwarmNode[];
  edges: SwarmEdge[];
  selectedExchangeId: string | null;
  selectedNodeId: string | null;
}

export function selectExchange(state: WorkbenchState, id: string): WorkbenchState {
  if (!state.exchanges.some((e) => e.id === id)) {
    throw new Error(`unknown exchange: ${id}`);
  }
  return { ...state, selectedExchangeId: id };
}

export function selectNode(state: WorkbenchState, id: string): WorkbenchState {
  if (!state.nodes.some((n) => n.id === id)) {
    throw new Error(`unknown node: ${id}`);
  }
  return { ...state, selectedNodeId: id };
}

export function exchangeForStep(state: WorkbenchState, stepId: string): Exchange | undefined {
  const step = state.timeline.find((s) => s.id === stepId);
  if (!step || !step.exchangeId) return undefined;
  return state.exchanges.find((e) => e.id === step.exchangeId);
}

export function severityRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s];
}

export function highestSeverity(nodes: SwarmNode[]): Severity | null {
  const sev = nodes.filter((n) => n.severity).map((n) => n.severity as Severity);
  if (sev.length === 0) return null;
  return sev.sort((a, b) => severityRank(a) - severityRank(b))[0];
}

// Serialises an HTTP message in raw form, as shown in the request pane.
export function formatRawRequest(msg: HttpMessage): string {
  const path = new URL(msg.url).pathname + new URL(msg.url).search;
  const host = new URL(msg.url).host;
  const headerLines = Object.entries({ Host: host, ...msg.headers }).map(([k, v]) => `${k}: ${v}`);
  return [`${msg.method} ${path} HTTP/1.1`, ...headerLines, '', msg.body].join('\n');
}

export function formatRawResponse(res: HttpResponse): string {
  const headerLines = Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`);
  return [`HTTP/1.1 ${res.status} ${res.reason}`, ...headerLines, '', res.body].join('\n');
}
