// lib/scanEventMappers.ts
// Pure event mapping functions extracted from useScanSocket.ts.
// Each mapper transforms raw WebSocket event data into typed results.
// No React state, no side effects — pure data transformations.

import type { LogEntry, Finding, PipelineState, AgentState, MetricsState } from '../hooks/useScanSocket.ts';
import { formatVerboseEvent } from './verboseEventFormatter.ts';

/** Result of mapping a single WebSocket event. */
export interface EventMapResult {
    logEntry: LogEntry | null;
    finding: Finding | null;
    pipeline: PipelineState | null;
    agent: AgentState | null;
    metrics: MetricsState | null;
    progress: number | null;
    scanFinished: boolean;
}

const EMPTY_RESULT: EventMapResult = {
    logEntry: null,
    finding: null,
    pipeline: null,
    agent: null,
    metrics: null,
    progress: null,
    scanFinished: false,
};

export const mapScanCreated = (): EventMapResult => ({ ...EMPTY_RESULT });

export const mapScanStarted = (scanId: string | number, timestamp: string): EventMapResult => ({
    ...EMPTY_RESULT,
    logEntry: {
        level: 'INFO',
        message: `[SCAN STARTED] Scan ${scanId} initialized on target host`,
        timestamp,
    },
});

export const mapAgentActive = (eventData: any, timestamp: string): EventMapResult => {
    const agentName = eventData?.agent || 'Agent';
    const agentTarget = eventData?.url ? ` - ${eventData.url}` : '';
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: 'INFO',
            message: `[AGENT] ${agentName} active${agentTarget}`,
            timestamp,
        },
    };
};

export const mapLogEvent = (eventData: any, rawEvent: string, timestamp: string): EventMapResult => {
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
    if (!msg) return { ...EMPTY_RESULT };
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: eventData?.level || 'INFO',
            message: msg,
            timestamp,
        },
    };
};

export const mapPhaseComplete = (eventData: any, rawEvent: string, timestamp: string): EventMapResult => {
    const phaseName = eventData?.phase || rawEvent?.replace('phase_complete_', '') || 'Phase';
    const phaseLabel = phaseName.charAt(0).toUpperCase() + phaseName.slice(1);
    const phaseStats = eventData?.stats || eventData?.summary || '';
    const phaseSuffix = phaseStats ? `. ${typeof phaseStats === 'string' ? phaseStats : JSON.stringify(phaseStats)}` : '';
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: 'INFO',
            message: `[PHASE] ${phaseLabel} complete${phaseSuffix}`,
            timestamp,
        },
    };
};

export const mapFindingDiscovered = (eventData: any, timestamp: string): EventMapResult => {
    const vulnType = eventData?.type || eventData?.vuln_type || eventData?.vulnerability_type || eventData?.name || '';
    const vulnParam = eventData?.parameter ? ` on '${eventData.parameter}'` : '';
    const vulnUrl = eventData?.url ? ` - ${eventData.url}` : '';
    const vulnDesc = eventData?.description || eventData?.details || '';
    const vulnInfo = vulnDesc || vulnUrl;
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: 'CRITICAL',
            message: vulnType
                ? `[VULN FOUND] ${vulnType}${vulnParam}${vulnInfo ? `. ${vulnInfo}` : ''}`
                : `[FINDING] ${vulnDesc || 'Vulnerability detected'}${vulnUrl}`,
            timestamp,
        },
        finding: {
            type: vulnType || 'Unknown',
            severity: eventData?.severity || 'high',
            parameter: eventData?.parameter || '',
            url: eventData?.url || '',
            details: vulnDesc,
            timestamp,
        },
    };
};

export const mapPipelineProgress = (eventData: any): EventMapResult => {
    const phase = eventData?.phase || '';
    const prog = eventData?.progress ?? 0;
    const statusMsg = eventData?.status_msg || '';
    return {
        ...EMPTY_RESULT,
        pipeline: { currentPhase: phase, progress: prog, statusMsg },
        progress: Math.round(prog * 100),
    };
};

export const mapAgentUpdate = (eventData: any): EventMapResult => ({
    ...EMPTY_RESULT,
    agent: {
        agent: eventData?.agent || '',
        status: eventData?.status || 'idle',
        queue: eventData?.queue ?? 0,
        processed: eventData?.processed ?? 0,
        vulns: eventData?.vulns ?? 0,
    },
});

export const mapMetricsUpdate = (eventData: any): EventMapResult => ({
    ...EMPTY_RESULT,
    metrics: {
        urlsDiscovered: eventData?.urls_discovered ?? 0,
        urlsAnalyzed: eventData?.urls_analyzed ?? 0,
    },
});

export const mapScanCompleteSummary = (eventData: any, timestamp: string): EventMapResult => {
    const totalFindings = eventData?.total_findings ?? 0;
    const dur = eventData?.duration ?? 0;
    const mins = Math.floor(dur / 60);
    const secs = Math.round(dur % 60);
    const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: 'INFO',
            message: `[SCAN COMPLETE] ${totalFindings} findings in ${durStr}`,
            timestamp,
        },
        pipeline: { currentPhase: 'complete', progress: 1, statusMsg: `${totalFindings} findings` },
        progress: 100,
        scanFinished: true,
    };
};

export const mapScanPaused = (scanId: string | number, timestamp: string): EventMapResult => ({
    ...EMPTY_RESULT,
    logEntry: {
        level: 'WARNING',
        message: `[SCAN PAUSED] Scan ${scanId} paused`,
        timestamp,
    },
});

export const mapScanResumed = (scanId: string | number, timestamp: string): EventMapResult => ({
    ...EMPTY_RESULT,
    logEntry: {
        level: 'INFO',
        message: `[SCAN RESUMED] Scan ${scanId} resumed`,
        timestamp,
    },
});

export const mapScanComplete = (eventData: any, timestamp: string): EventMapResult => {
    const elapsed = eventData?.elapsed_seconds || eventData?.duration || 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const findings = eventData?.findings_count !== undefined ? `, ${eventData.findings_count} findings` : '';
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: 'INFO',
            message: `[SCAN COMPLETE] ${eventData?.status || 'Completed'} in ${duration}${findings}`,
            timestamp,
        },
        progress: 100,
        scanFinished: true,
    };
};

export const mapError = (eventData: any, timestamp: string): EventMapResult => ({
    ...EMPTY_RESULT,
    logEntry: {
        level: 'ERROR',
        message: `[ERROR] ${eventData?.error || eventData?.message || 'Unknown error'}`,
        timestamp,
    },
    scanFinished: eventData?.recoverable === false,
});

export const mapProgress = (eventData: any, timestamp: string): EventMapResult => {
    if (eventData?.progress === undefined) return { ...EMPTY_RESULT };
    return {
        ...EMPTY_RESULT,
        logEntry: {
            level: 'DEBUG',
            message: `[PROGRESS] ${eventData.progress}%`,
            timestamp,
        },
        progress: eventData.progress,
    };
};

export const mapVerboseEvent = (eventType: string, eventData: any, timestamp: string): EventMapResult => {
    const formatted = formatVerboseEvent(eventType, eventData || {});
    return {
        ...EMPTY_RESULT,
        logEntry: formatted
            ? { ...formatted, timestamp }
            : { level: 'INFO', message: eventData?.message || `[${eventType}]`, timestamp },
    };
};

/**
 * Master dispatcher: maps any raw WebSocket event to a typed EventMapResult.
 * Pure function — no side effects.
 */
export const mapScanEvent = (
    eventType: string,
    eventData: any,
    scanId: string | number,
    timestamp: string,
    rawEvent: string,
): EventMapResult => {
    switch (eventType) {
        case 'scan_created':          return mapScanCreated();
        case 'scan_started':          return mapScanStarted(scanId, timestamp);
        case 'agent_active':          return mapAgentActive(eventData, timestamp);
        case 'log':                   return mapLogEvent(eventData, rawEvent, timestamp);
        case 'phase_complete':        return mapPhaseComplete(eventData, rawEvent, timestamp);
        case 'finding_discovered':    return mapFindingDiscovered(eventData, timestamp);
        case 'pipeline_progress':     return mapPipelineProgress(eventData);
        case 'agent_update':          return mapAgentUpdate(eventData);
        case 'metrics_update':        return mapMetricsUpdate(eventData);
        case 'scan_complete_summary': return mapScanCompleteSummary(eventData, timestamp);
        case 'scan_paused':           return mapScanPaused(scanId, timestamp);
        case 'scan_resumed':          return mapScanResumed(scanId, timestamp);
        case 'scan_complete':         return mapScanComplete(eventData, timestamp);
        case 'error':                 return mapError(eventData, timestamp);
        case 'progress':              return mapProgress(eventData, timestamp);
        default:                      return mapVerboseEvent(eventType, eventData, timestamp);
    }
};
