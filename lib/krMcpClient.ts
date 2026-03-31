// @author: Albert C | @yz9yt | github.com/yz9yt
// lib/krMcpClient.ts
// Minimal MCP-over-SSE client for kiterunner-mcp service

const KR_MCP_BASE = import.meta.env.VITE_KR_MCP_URL || '/kr-mcp';

interface McpResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string };
}

export class KrMcpClient {
  private es: EventSource | null = null;
  private messagesEndpoint: string | null = null;
  private idCounter = 0;
  private pendingRequests = new Map<number, (resp: McpResponse) => void>();
  private initialized = false;
  private onReadyCallback: () => void;
  private onErrorCallback: (err: string) => void;

  constructor(onReady: () => void, onError: (err: string) => void) {
    this.onReadyCallback = onReady;
    this.onErrorCallback = onError;
  }

  connect(): void {
    this.es = new EventSource(`${KR_MCP_BASE}/sse`);

    this.es.addEventListener('endpoint', (ev: MessageEvent) => {
      // The endpoint event data is the messages path, e.g. "/messages?sessionId=xxx"
      // or a full URL "http://host:port/messages?sessionId=xxx"
      let raw: string = (ev.data as string).trim();
      let search = '';
      if (raw.startsWith('http')) {
        try {
          const u = new URL(raw);
          search = u.search;
        } catch {
          search = raw.slice(raw.indexOf('?'));
        }
      } else {
        search = raw.includes('?') ? raw.slice(raw.indexOf('?')) : raw;
      }
      this.messagesEndpoint = `${KR_MCP_BASE}/messages${search}`;
      this._initHandshake();
    });

    this.es.addEventListener('message', (ev: MessageEvent) => {
      let data: McpResponse;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (data.id !== undefined) {
        const resolve = this.pendingRequests.get(data.id);
        if (resolve) {
          this.pendingRequests.delete(data.id);
          resolve(data);
        }
      }
    });

    this.es.onerror = () => {
      if (!this.initialized) {
        this.onErrorCallback('Cannot connect to kiterunner-mcp service');
      }
    };
  }

  private async _initHandshake(): Promise<void> {
    try {
      await this._post('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'BugTraceAI-WEB', version: '1.0.0' },
      });
      // Fire-and-forget notification (no id, no response expected)
      void fetch(this.messagesEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      });
      this.initialized = true;
      this.onReadyCallback();
    } catch (e) {
      this.onErrorCallback(`MCP init failed: ${String(e)}`);
    }
  }

  private _post(method: string, params?: unknown): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.messagesEndpoint) {
        reject(new Error('Not connected'));
        return;
      }
      const id = ++this.idCounter;
      this.pendingRequests.set(id, resolve);
      fetch(this.messagesEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: AbortSignal.timeout(30_000),
      }).catch((err: unknown) => {
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) throw new Error('Client not ready');
    const resp = await this._post('tools/call', { name, arguments: args });
    if (resp.error) throw new Error(resp.error.message);
    const text = resp.result?.content?.[0]?.text;
    if (text === undefined) throw new Error('Empty tool response');
    return JSON.parse(text);
  }

  disconnect(): void {
    this.es?.close();
    this.es = null;
    this.messagesEndpoint = null;
    this.initialized = false;
    this.pendingRequests.clear();
  }
}
