import { useEffect, useState, useCallback, useRef } from 'react';
import { CLI_WS_URL } from '../lib/cliApi';
import { formatVerboseEvent } from '../lib/verboseEventFormatter';

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: string;
}

// Structured dashboard state from CLI events
export interface PipelineState {
  currentPhase: string;
  progress: number; // 0-1
  statusMsg: string;
}

export interface AgentState {
  agent: string;
  status: string; // idle, active, complete, error
  queue: number;
  processed: number;
  vulns: number;
}

export interface MetricsState {
  urlsDiscovered: number;
  urlsAnalyzed: number;
}

export interface Finding {
  type: string;
  severity: string;
  parameter: string;
  url: string;
  details: string;
  timestamp: string;
}

interface UseScanSocketReturn {
  logs: LogEntry[];
  isConnected: boolean;
  isScanning: boolean;
  progress: number;
  pipeline: PipelineState;
  agents: AgentState[];
  metrics: MetricsState;
  findings: Finding[];
  subscribe: (scanId: number) => void;
  unsubscribe: () => void;
  clearLogs: () => void;
}

const MAX_LOGS = 10000;

/**
 * Native WebSocket hook for real-time scan event streaming.
 *
 * Connects to CLI FastAPI WebSocket endpoint /ws/scans/{scan_id}.
 * Maps CLI event types to LogEntry format for ScanConsole compatibility.
 *
 * Supports reconnection via last_seq parameter to receive missed events.
 */
const INITIAL_PIPELINE: PipelineState = { currentPhase: '', progress: 0, statusMsg: '' };
const INITIAL_METRICS: MetricsState = { urlsDiscovered: 0, urlsAnalyzed: 0 };

export function useScanSocket(): UseScanSocketReturn {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_PIPELINE);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [metrics, setMetrics] = useState<MetricsState>(INITIAL_METRICS);
  const [findings, setFindings] = useState<Finding[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const currentScanIdRef = useRef<number | null>(null);
  const lastSeqRef = useRef<number>(0);
  const scanFinishedRef = useRef<boolean>(false);

  const subscribe = useCallback((scanId: number) => {
    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    currentScanIdRef.current = scanId;
    scanFinishedRef.current = false;
    // Reset dashboard state for new scan
    setPipeline(INITIAL_PIPELINE);
    setAgents([]);
    setMetrics(INITIAL_METRICS);
    setFindings([]);

    // Build WebSocket URL with reconnection support
    const wsUrl = lastSeqRef.current > 0
      ? `${CLI_WS_URL}/ws/scans/${scanId}?last_seq=${lastSeqRef.current}`
      : `${CLI_WS_URL}/ws/scans/${scanId}`;

    console.log('[WebSocket] Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected to scan', scanId);
        setIsConnected(true);
        setIsScanning(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { event_type, seq, timestamp, data: eventData } = data;
          const scan_id = eventData?.scan_id ?? data.scan_id;

          // Update last sequence number
          if (seq) {
            lastSeqRef.current = Math.max(lastSeqRef.current, seq);
          }

          // Map CLI event types to LogEntry format
          const logTimestamp = timestamp || new Date().toISOString();
          let logEntry: LogEntry | null = null;

          switch (event_type) {
            case 'scan_created':
              // Scan created in DB - skip log, scan_started follows immediately
              break;

            case 'scan_started': {
              const target = eventData?.target || eventData?.target_url || '';
              logEntry = {
                level: 'INFO',
                message: `[SCAN STARTED] Scan ${scan_id} initialized on target host`,
                timestamp: logTimestamp,
              };
              break;
            }

            case 'agent_active': {
              const agentName = eventData?.agent || 'Agent';
              const agentTarget = eventData?.url ? ` - ${eventData.url}` : '';
              logEntry = {
                level: 'INFO',
                message: `[AGENT] ${agentName} active${agentTarget}`,
                timestamp: logTimestamp,
              };
              break;
            }

            case 'log': {
              // Bridge events (pipeline_started, url_analyzed, etc.) + direct log events
              const rawEvent = data.event || '';
              let msg = eventData?.message || '';
              if (!msg) {
                if (eventData?.phase) {
                  const phaseDesc = eventData.description ? ` - ${eventData.description}` : '';
                  msg = `[PIPELINE] Phase: ${eventData.phase}${phaseDesc}`;
                } else if (eventData?.url) {
                  msg = `[URL] Analyzed: ${eventData.url}`;
                } else {
                  msg = rawEvent;
                }
              }
              if (msg) {
                logEntry = {
                  level: eventData?.level || 'INFO',
                  message: msg,
                  timestamp: logTimestamp,
                };
              }
              break;
            }

            case 'phase_complete': {
              // Core bus: event name is "phase_complete_reconnaissance" etc.
              const phaseName = eventData?.phase || data.event?.replace('phase_complete_', '') || 'Phase';
              const phaseLabel = phaseName.charAt(0).toUpperCase() + phaseName.slice(1);
              const phaseStats = eventData?.stats || eventData?.summary || '';
              const phaseSuffix = phaseStats ? `. ${typeof phaseStats === 'string' ? phaseStats : JSON.stringify(phaseStats)}` : '';
              logEntry = {
                level: 'INFO',
                message: `[PHASE] ${phaseLabel} complete${phaseSuffix}`,
                timestamp: logTimestamp,
              };
              break;
            }

            case 'finding_discovered': {
              const vulnType = eventData?.type || eventData?.vuln_type || eventData?.vulnerability_type || eventData?.name || '';
              const vulnParam = eventData?.parameter ? ` on '${eventData.parameter}'` : '';
              const vulnUrl = eventData?.url ? ` - ${eventData.url}` : '';
              const vulnDesc = eventData?.description || eventData?.details || '';
              const vulnInfo = vulnDesc || vulnUrl;
              logEntry = {
                level: 'CRITICAL',
                message: vulnType
                  ? `[VULN FOUND] ${vulnType}${vulnParam}${vulnInfo ? `. ${vulnInfo}` : ''}`
                  : `[FINDING] ${vulnDesc || 'Vulnerability detected'}${vulnUrl}`,
                timestamp: logTimestamp,
              };
              // Also add to structured findings
              setFindings(prev => [...prev, {
                type: vulnType || 'Unknown',
                severity: eventData?.severity || 'high',
                parameter: eventData?.parameter || '',
                url: eventData?.url || '',
                details: vulnDesc,
                timestamp: logTimestamp,
              }]);
              break;
            }

            // === Dashboard events (structured state for widgets) ===

            case 'pipeline_progress': {
              const phase = eventData?.phase || '';
              const prog = eventData?.progress ?? 0;
              const statusMsg = eventData?.status_msg || '';
              setPipeline({ currentPhase: phase, progress: prog, statusMsg });
              // Also update global progress %
              setProgress(Math.round(prog * 100));
              break;
            }

            case 'agent_update': {
              const agentName = eventData?.agent || '';
              const agentStatus = eventData?.status || 'idle';
              const agentQueue = eventData?.queue ?? 0;
              const agentProcessed = eventData?.processed ?? 0;
              const agentVulns = eventData?.vulns ?? 0;
              setAgents(prev => {
                const existing = prev.findIndex(a => a.agent === agentName);
                const updated: AgentState = {
                  agent: agentName,
                  status: agentStatus,
                  queue: agentQueue,
                  processed: agentProcessed,
                  vulns: agentVulns,
                };
                if (existing >= 0) {
                  const next = [...prev];
                  next[existing] = updated;
                  return next;
                }
                return [...prev, updated];
              });
              break;
            }

            case 'metrics_update': {
              setMetrics({
                urlsDiscovered: eventData?.urls_discovered ?? 0,
                urlsAnalyzed: eventData?.urls_analyzed ?? 0,
              });
              break;
            }

            case 'scan_complete_summary': {
              // Structured scan completion with totals
              const totalFindings = eventData?.total_findings ?? 0;
              const dur = eventData?.duration ?? 0;
              const mins = Math.floor(dur / 60);
              const secs = Math.round(dur % 60);
              const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
              logEntry = {
                level: 'INFO',
                message: `[SCAN COMPLETE] ${totalFindings} findings in ${durStr}`,
                timestamp: logTimestamp,
              };
              setPipeline({ currentPhase: 'complete', progress: 1, statusMsg: `${totalFindings} findings` });
              scanFinishedRef.current = true;
              setIsScanning(false);
              setProgress(100);
              break;
            }

            case 'scan_paused':
              logEntry = {
                level: 'WARNING',
                message: `[SCAN PAUSED] Scan ${scan_id} paused`,
                timestamp: logTimestamp,
              };
              break;

            case 'scan_resumed':
              logEntry = {
                level: 'INFO',
                message: `[SCAN RESUMED] Scan ${scan_id} resumed`,
                timestamp: logTimestamp,
              };
              break;

            case 'scan_complete': {
              const elapsed = eventData?.elapsed_seconds || eventData?.duration || 0;
              const mins = Math.floor(elapsed / 60);
              const secs = elapsed % 60;
              const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
              const findings = eventData?.findings_count !== undefined ? `, ${eventData.findings_count} findings` : '';
              logEntry = {
                level: 'INFO',
                message: `[SCAN COMPLETE] ${eventData?.status || 'Completed'} in ${duration}${findings}`,
                timestamp: logTimestamp,
              };
              scanFinishedRef.current = true;
              setIsScanning(false);
              setProgress(100);
              break;
            }

            case 'error':
              logEntry = {
                level: 'ERROR',
                message: `[ERROR] ${eventData?.error || eventData?.message || 'Unknown error'}`,
                timestamp: logTimestamp,
              };
              // If error is not recoverable, stop scanning state
              if (eventData?.recoverable === false) {
                scanFinishedRef.current = true;
                setIsScanning(false);
              }
              break;

            case 'progress':
              // Update progress state
              if (eventData?.progress !== undefined) {
                setProgress(eventData.progress);
                // Optionally add debug log
                logEntry = {
                  level: 'DEBUG',
                  message: `[PROGRESS] ${eventData.progress}%`,
                  timestamp: logTimestamp,
                };
              }
              break;

            default: {
              // Verbose events (dotted names) → rich formatted messages
              const formatted = formatVerboseEvent(event_type, eventData || {});
              if (formatted) {
                logEntry = { ...formatted, timestamp: logTimestamp };
              } else {
                logEntry = {
                  level: 'INFO',
                  message: eventData?.message || `[${event_type}]`,
                  timestamp: logTimestamp,
                };
              }
              break;
            }
          }

          // Add log entry if created
          if (logEntry) {
            setLogs(prev => {
              const updated = [...prev, logEntry];
              // Keep only last MAX_LOGS entries
              return updated.slice(-MAX_LOGS);
            });
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed', event.code, event.reason);
        setIsConnected(false);
        // Only clear isScanning if we received a terminal event (scan_complete/error)
        // or user manually unsubscribed. Transient disconnects (1005, 1006) should NOT
        // reset scanning state — the scan is still running on the backend.
        // Code 1000 = server closed after scan_complete (scanFinishedRef already set).
      };


      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setIsConnected(false);
    }
  }, []);

  const unsubscribe = useCallback(() => {
    if (wsRef.current) {
      console.log('[WebSocket] Unsubscribing from scan', currentScanIdRef.current);
      wsRef.current.close();
      wsRef.current = null;
      currentScanIdRef.current = null;
      setIsScanning(false);
      // Reset sequence counter on manual unsubscribe
      lastSeqRef.current = 0;
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    logs,
    isConnected,
    isScanning,
    progress,
    pipeline,
    agents,
    metrics,
    findings,
    subscribe,
    unsubscribe,
    clearLogs,
  };
}
