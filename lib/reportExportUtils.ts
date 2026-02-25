// lib/reportExportUtils.ts
// PURE functions for report export/chat data preparation.
// No React, no hooks, no state, no DOM, no fetch.

import type { Finding, ScanStats } from '../hooks/useReportViewer';

// --- Severity color constants ---

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string; bar: string; fill: string }> = {
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-500', bar: 'bg-red-500', fill: '#ef4444' },
  high: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-500', bar: 'bg-orange-500', fill: '#f97316' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-500', bar: 'bg-yellow-500', fill: '#eab308' },
  low: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-500', bar: 'bg-blue-500', fill: '#3b82f6' },
  info: { bg: 'bg-slate-500/15', text: 'text-slate-400', dot: 'bg-slate-500', bar: 'bg-slate-500', fill: '#64748b' },
};

// --- Download file list ---

export const downloadFiles = [
  { filename: 'final_report.md', label: 'Report', icon: 'MD' },
  { filename: 'validated_findings.json', label: 'Validated', icon: 'JSON' },
  { filename: 'raw_findings.json', label: 'Raw', icon: 'JSON' },
  { filename: 'engagement_data.json', label: 'Engagement', icon: 'JSON' },
] as const;

// --- Attack chain interface ---

export interface AttackChain {
  name: string;
  vulnerabilities: string;
  impact: string;
}

// --- CLIReport interface ---

export interface CLIReport {
  id: string;
  target_url: string;
  scan_date: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info?: number;
  } | null;
  report_path: string;
}

// --- Report summary builder (pure) ---

/** Build a structured markdown summary for sending to chat */
export const buildReportSummary = (
  report: CLIReport,
  findings: Finding[],
  scanStats: ScanStats | null,
  markdown: string,
  attackChains: AttackChain[],
): string => {
  const s = report.severity_summary;
  const counts = s || {
    critical: findings.filter(f => (f.severity || 'info').toLowerCase() === 'critical').length,
    high: findings.filter(f => (f.severity || 'info').toLowerCase() === 'high').length,
    medium: findings.filter(f => (f.severity || 'info').toLowerCase() === 'medium').length,
    low: findings.filter(f => (f.severity || 'info').toLowerCase() === 'low').length,
  };
  const total = counts.critical + counts.high + counts.medium + counts.low;

  let summary = `This is a cybersecurity scan report for **${report.target_url}**. I'd like your help understanding the findings, their severity, and what actions should be taken.\n\n`;
  summary += `## Scan Summary\n`;
  summary += `- **Date:** ${report.scan_date || 'Unknown'}\n`;
  if (scanStats?.duration) summary += `- **Duration:** ${scanStats.duration}\n`;
  if (scanStats?.urls_scanned != null) summary += `- **URLs Scanned:** ${scanStats.urls_scanned}\n`;
  summary += `- **Total Findings:** ${total} (Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low})\n\n`;

  if (findings.length > 0) {
    summary += `## Findings\n\n`;
    summary += `| # | Type | Severity | Parameter | CVSS | Status |\n`;
    summary += `|---|------|----------|-----------|------|--------|\n`;
    for (const [i, f] of findings.entries()) {
      const status = f.status === 'VALIDATED_CONFIRMED' ? 'Confirmed' : f.validated ? 'Validated' : 'Pending';
      const cvss = f.cvss_score != null ? String(f.cvss_score) : '-';
      summary += `| ${i + 1} | ${f.type || f.title} | ${f.severity} | ${f.parameter || '-'} | ${cvss} | ${status} |\n`;
    }
    summary += `\n`;
  }

  if (attackChains.length > 0) {
    summary += `## Attack Chains\n\n`;
    for (const [i, chain] of attackChains.entries()) {
      summary += `### ${i + 1}. ${chain.name}\n`;
      summary += `- **Vulnerabilities:** ${chain.vulnerabilities}\n`;
      summary += `- **Impact:** ${chain.impact}\n\n`;
    }
  }

  if (markdown) {
    const MAX_REPORT_LEN = 6000;
    const truncated = markdown.length > MAX_REPORT_LEN
      ? markdown.substring(0, MAX_REPORT_LEN) + '\n\n... (report truncated for chat context)'
      : markdown;
    summary += `## Full Report\n\n${truncated}\n`;
  }

  return summary;
};

// --- Finding message builder (pure) ---

/** Build a markdown message for a single finding to send to chat */
export const buildFindingMessage = (finding: Finding, targetUrl: string): string => {
  const displayName = finding.title || finding.type || 'Unknown';
  let msg = `I found a **${finding.severity}** vulnerability on **${targetUrl}** and need your analysis.\n\n`;
  msg += `## ${displayName}\n\n`;
  if (finding.type && finding.type !== displayName) msg += `- **Type:** ${finding.type}\n`;
  msg += `- **Severity:** ${finding.severity}\n`;
  if (finding.cvss_score != null) msg += `- **CVSS:** ${finding.cvss_score}${finding.cvss_vector ? ` (${finding.cvss_vector})` : ''}\n`;
  if (finding.url) msg += `- **URL:** ${finding.url}\n`;
  if (finding.parameter) msg += `- **Parameter:** ${finding.parameter}\n`;
  if (finding.payload) msg += `- **Payload:** \`${finding.payload}\`\n`;
  const desc = finding.description || finding.details || '';
  if (desc) msg += `\n${desc}\n`;
  if (finding.impact) msg += `\n### Impact\n${finding.impact}\n`;
  if (finding.exploitation_details) msg += `\n### Exploitation Details\n${finding.exploitation_details}\n`;
  if (finding.remediation) msg += `\n### Suggested Remediation\n${finding.remediation}\n`;
  if (finding.evidence) msg += `\n### Evidence\n${finding.evidence}\n`;
  if (finding.llm_reproduction_steps?.length) {
    msg += `\n### Reproduction Steps\n`;
    finding.llm_reproduction_steps.forEach((s, i) => { msg += `${i + 1}. ${s}\n`; });
  }
  return msg;
};

/** Build a markdown message for a single detection to send to chat */
export const buildDetectionMessage = (detection: { type: string; severity: string; validated: boolean; confidence?: number | null; url?: string; parameter?: string; payload?: string; details?: string }, targetUrl: string): string => {
  let msg = `I have a **${detection.severity}** detection on **${targetUrl}** that needs analysis.\n\n`;
  msg += `## ${detection.type}\n\n`;
  msg += `- **Severity:** ${detection.severity}\n`;
  msg += `- **Status:** ${detection.validated ? 'Confirmed' : 'Unconfirmed'}\n`;
  if (detection.confidence != null && detection.confidence > 0) msg += `- **Confidence:** ${Math.round(detection.confidence * 100)}%\n`;
  if (detection.url) msg += `- **URL:** ${detection.url}\n`;
  if (detection.parameter) msg += `- **Parameter:** ${detection.parameter}\n`;
  if (detection.payload) msg += `- **Payload:** \`${detection.payload}\`\n`;
  if (detection.details) msg += `\n### Details\n${detection.details}\n`;
  msg += `\nPlease analyze this detection: is it likely a true positive? What additional testing would confirm it? What's the potential impact and remediation?`;
  return msg;
};
