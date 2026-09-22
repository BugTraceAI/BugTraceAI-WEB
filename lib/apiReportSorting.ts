import type { BtaiApiFinding } from './btaiApi.ts';

export type ApiFindingSortColumn = 'name' | 'severity' | 'status' | 'cvss' | 'url';
export type ApiFindingSortDirection = 'asc' | 'desc';

const API_SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

const compareText = (left: string, right: string): number => left.localeCompare(right, undefined, {
  numeric: true,
  sensitivity: 'base',
});

const findingName = (finding: BtaiApiFinding): string => String(finding.title || finding.category || 'Untitled finding');

const findingUrl = (finding: BtaiApiFinding): string => {
  if (finding.endpoint) return String(finding.endpoint);
  const repro = finding.repro as Record<string, unknown> | undefined;
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  return String(repro?.url ?? evidence?.url ?? '');
};

const findingStatus = (finding: BtaiApiFinding): string => {
  const repro = finding.repro as Record<string, unknown> | undefined;
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const value = repro?.status ?? evidence?.status ?? evidence?.result;
  if (!value) return 'unconfirmed';
  const normalized = String(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('unconfirm') || normalized.includes('not vulnerable') || normalized.includes('pass') || normalized.includes('safe')) return 'unconfirmed';
  if (normalized.includes('confirm') || normalized.includes('valid')) return 'confirmed';
  if (normalized.includes('review') || normalized.includes('fail') || normalized.includes('error')) return 'needs review';
  return normalized;
};

const findingStatusRank = (finding: BtaiApiFinding): number => {
  const status = findingStatus(finding);
  if (status === 'confirmed') return 2;
  if (status === 'needs review') return 1;
  return 0;
};

const findingCvss = (finding: BtaiApiFinding): number => {
  const repro = finding.repro as Record<string, unknown> | undefined;
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const cvss = evidence?.cvss as Record<string, unknown> | undefined;
  const score = repro?.cvss_score ?? cvss?.score;
  const numeric = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(numeric) ? numeric : -1;
};

/**
 * Sort API findings without mutating the response returned by the API.
 * The tie breaker mirrors the CLI report and keeps rows stable and readable.
 */
export const sortApiFindings = (
  findings: BtaiApiFinding[],
  column: ApiFindingSortColumn,
  direction: ApiFindingSortDirection,
): BtaiApiFinding[] => {
  const sorted = findings.map((finding, index) => ({ finding, index })).sort((left, right) => {
    const a = left.finding;
    const b = right.finding;
    let comparison = 0;

    switch (column) {
      case 'name':
        comparison = compareText(findingName(a), findingName(b));
        break;
      case 'severity':
        comparison = (API_SEVERITY_RANK[String(a.severity || 'info').toLowerCase()] ?? 0)
          - (API_SEVERITY_RANK[String(b.severity || 'info').toLowerCase()] ?? 0);
        break;
      case 'status':
        comparison = findingStatusRank(a) - findingStatusRank(b);
        break;
      case 'cvss':
        comparison = findingCvss(a) - findingCvss(b);
        break;
      case 'url':
        comparison = compareText(findingUrl(a), findingUrl(b));
        break;
    }

    if (comparison === 0 && column === 'status') {
      comparison = compareText(findingStatus(a), findingStatus(b));
    }
    if (comparison === 0 && column !== 'name') {
      comparison = compareText(findingName(a), findingName(b));
    }
    if (comparison === 0) comparison = left.index - right.index;
    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted.map(({ finding }) => finding);
};
