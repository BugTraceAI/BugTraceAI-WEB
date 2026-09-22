import type { BtaiApiFinding } from './btaiApi.ts';

/** Keep the visible title focused on the finding; review state is shown separately. */
export const apiFindingTitle = (finding: BtaiApiFinding): string => {
  const title = String(finding.title || 'Untitled finding');
  return title.replace(/^(?:(?:needs validation|needs review|insufficient evidence)\s*:\s*)+/i, '') || 'Untitled finding';
};

/** Review-state categories add no useful detail below the status badge. */
export const apiFindingCategorySubtitle = (category: string): string | null => {
  const value = category.trim();
  return /^(?:needs validation|needs review|insufficient evidence|inconclusive)$/i.test(value)
    ? null
    : value || null;
};

/**
 * Convert the API evidence contract into the compact status shown in reports.
 * A replayed request is not proof of exploitation; classification and
 * validation_status must win whenever they are present.
 */
export const apiFindingStatus = (finding: BtaiApiFinding): string => {
  const repro = finding.repro as Record<string, unknown> | undefined;
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const value = finding.validation_status
    ?? finding.classification
    ?? evidence?.validation_status
    ?? evidence?.classification
    ?? repro?.validation_status
    ?? repro?.status
    ?? evidence?.status
    ?? evidence?.result;
  if (!value) return 'Unconfirmed';
  const normalized = String(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (
    normalized.includes('false positive')
    || normalized.includes('not vulnerable')
    || normalized.includes('resolved')
    || normalized.includes('unconfirm')
    || normalized.includes('safe')
    || normalized === 'pass'
  ) return 'Unconfirmed';
  if (normalized === 'confirmed' || normalized === 'validated confirmed' || normalized === 'validated') return 'Confirmed';
  if (
    normalized.includes('needs validation')
    || normalized.includes('needs review')
    || normalized.includes('pending')
    || normalized.includes('suspicious')
    || normalized.includes('insufficient')
    || normalized.includes('replayed')
    || normalized.includes('fail')
    || normalized.includes('error')
  ) return 'Needs review';
  if (normalized.includes('hardening')) return 'Hardening';
  return normalized.replace(/\b\w/g, letter => letter.toUpperCase());
};
