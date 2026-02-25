// lib/markdownTransformers.ts
// PURE functions for report data transformations: sorting, filtering, grouping.
// No React, no hooks, no state, no DOM, no fetch.

import type { Finding } from '../hooks/useReportViewer';
import type { FindingItem } from './cliApi';

// --- Severity rank map ---

export const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

// --- Sort column types ---

export type SortCol = 'name' | 'severity' | 'status' | 'cvss' | 'url';
export type DetSortCol = 'type' | 'severity' | 'status' | 'confidence' | 'parameter';
export type SortDir = 'asc' | 'desc';

// --- Sorting ---

export const sortFindings = (list: Finding[], col: SortCol, dir: SortDir): Finding[] => {
  const sorted = [...list].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case 'name':
        cmp = (a.title || a.type || '').localeCompare(b.title || b.type || '');
        break;
      case 'severity':
        cmp = (SEV_RANK[(a.severity || 'info').toLowerCase()] ?? 0) - (SEV_RANK[(b.severity || 'info').toLowerCase()] ?? 0);
        break;
      case 'status': {
        const rank = (f: Finding) => f.status === 'VALIDATED_CONFIRMED' ? 2 : f.validated ? 1 : 0;
        cmp = rank(a) - rank(b);
        break;
      }
      case 'cvss':
        cmp = (a.cvss_score ?? -1) - (b.cvss_score ?? -1);
        break;
      case 'url':
        cmp = (a.url || '').localeCompare(b.url || '');
        break;
    }
    // Tiebreaker: sort by name when primary values are equal
    if (cmp === 0 && col !== 'name') {
      cmp = (a.title || a.type || '').localeCompare(b.title || b.type || '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
};

export const sortDetections = (list: FindingItem[], col: DetSortCol, dir: SortDir): FindingItem[] => {
  const sorted = [...list].sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case 'type':
        cmp = (a.type || '').localeCompare(b.type || '');
        break;
      case 'severity':
        cmp = (SEV_RANK[(a.severity || 'info').toLowerCase()] ?? 0) - (SEV_RANK[(b.severity || 'info').toLowerCase()] ?? 0);
        break;
      case 'status': {
        const rank = (f: FindingItem) => f.validated ? 1 : 0;
        cmp = rank(a) - rank(b);
        break;
      }
      case 'confidence':
        cmp = (a.confidence ?? -1) - (b.confidence ?? -1);
        break;
      case 'parameter':
        cmp = (a.parameter || '').localeCompare(b.parameter || '');
        break;
    }
    // Tiebreaker: sort by type when primary values are equal
    if (cmp === 0 && col !== 'type') {
      cmp = (a.type || '').localeCompare(b.type || '');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
};

// --- Grouping ---

/** Group findings by type for the donut chart legend */
export const groupByType = (findings: Finding[]): { name: string; value: number; severity: string }[] => {
  const map = new Map<string, { count: number; severity: string }>();
  for (const f of findings) {
    const key = f.type || f.title;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { count: 1, severity: (f.severity || 'info').toLowerCase() });
    }
  }
  return Array.from(map.entries())
    .map(([name, { count, severity }]) => ({ name, value: count, severity }))
    .sort((a, b) => b.value - a.value);
};

// --- Date formatting ---

export const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();
};

// --- Markdown enrichment ---

/** Append a detections table to the base markdown */
export const buildFullMarkdown = (markdown: string, detections: FindingItem[]): string => {
  if (!markdown || detections.length === 0) return markdown;
  const rows = detections.map(d => {
    const conf = d.confidence != null && d.confidence > 0 ? `${Math.round(d.confidence * 100)}%` : '-';
    const status = d.validated ? 'Confirmed' : 'Unconfirmed';
    return `| ${d.type} | ${d.severity} | ${status} | ${conf} | ${d.parameter || '-'} | ${d.url || '-'} |`;
  });
  const table = [
    '',
    '---',
    '',
    '## All Detections',
    '',
    `> ${detections.length} vulnerabilities detected during the discovery phase. Only confirmed (validated) findings appear in the report above.`,
    '',
    '| Type | Severity | Status | Confidence | Parameter | URL |',
    '|------|----------|--------|------------|-----------|-----|',
    ...rows,
    '',
  ].join('\n');
  return markdown + table;
};

// --- Severity counts ---

export interface SeveritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info?: number;
}

export const computeSeverityCounts = (
  reportSummary: SeveritySummary | null,
  findings: Finding[],
): SeveritySummary & { info: number } => {
  if (reportSummary) {
    return { ...reportSummary, info: reportSummary.info || 0 };
  }
  return {
    critical: findings.filter(f => (f.severity || '').toLowerCase() === 'critical').length,
    high: findings.filter(f => (f.severity || '').toLowerCase() === 'high').length,
    medium: findings.filter(f => (f.severity || '').toLowerCase() === 'medium').length,
    low: findings.filter(f => (f.severity || '').toLowerCase() === 'low').length,
    info: findings.filter(f => {
      const sev = (f.severity || '').toLowerCase();
      return sev === 'info' || sev === '';
    }).length,
  };
};

export const computeTotalFindings = (counts: SeveritySummary & { info: number }): number =>
  counts.critical + counts.high + counts.medium + counts.low + counts.info;

// --- Pagination helpers ---

export const paginate = <T>(items: T[], page: number, perPage: number): T[] =>
  items.slice((page - 1) * perPage, page * perPage);

export const totalPages = (itemCount: number, perPage: number): number =>
  Math.max(1, Math.ceil(itemCount / perPage));
