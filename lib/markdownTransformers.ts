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

/**
 * Recover Markdown documents that an LLM wrapped in a document-level code fence.
 * The final closing fence may precede a short Markdown note, and the document may
 * contain legitimate inner code blocks, so the last standalone fence is removed.
 */
export const normalizeMarkdownDocument = (content: string): string => {
  const lines = content.trim().split(/\r?\n/);
  const firstFence = lines.findIndex(line => /^```(?:markdown|md|plaintext|text)?[ \t]*$/i.test(line));
  if (firstFence < 0) return content;

  // A report may prepend a normal Markdown heading before the model's document-level
  // ```markdown wrapper.  Keep ordinary code samples untouched, but unwrap that
  // explicit Markdown envelope so the report is rendered as headings and lists.
  const isExplicitMarkdownFence = /^```(?:markdown|md|plaintext|text)[ \t]*$/i.test(lines[firstFence] || '');
  if (firstFence > 0 && !isExplicitMarkdownFence) return content;

  const closingCandidates = lines
    .map((line, index) => (/^```[ \t]*$/.test(line) && index > firstFence ? index : -1))
    .filter(index => index >= 0);

  const nextNonEmptyIndex = (from: number): number => {
    for (let index = from + 1; index < lines.length; index += 1) {
      if (lines[index].trim() !== '') return index;
    }
    return -1;
  };

  const isThematicBreak = (line: string): boolean => /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line);
  const isHeading = (line: string): boolean => /^#{1,6}\s+\S/.test(line.trim());

  let closingIndex = -1;
  // An explicit Markdown envelope is often followed by a thematic break and
  // the first finding. Prefer that unmistakable document boundary over a
  // later closing fence belonging to a code sample inside the report.
  for (const candidate of closingCandidates) {
    const next = nextNonEmptyIndex(candidate);
    if (next < 0) continue;
    if (!isThematicBreak(lines[next])) continue;
    const afterBreak = nextNonEmptyIndex(next);
    if (afterBreak >= 0 && isHeading(lines[afterBreak])) {
      closingIndex = candidate;
      break;
    }
  }

  // If the wrapped document ends at EOF, its closing fence is also unambiguous.
  if (closingIndex < 0) {
    closingIndex = closingCandidates.find(candidate => nextNonEmptyIndex(candidate) < 0) ?? -1;
  }

  // Finally support the common `wrapper -> heading` shape. Iterate from the
  // start so an inner code sample cannot make us select a much later fence.
  if (closingIndex < 0) {
    closingIndex = closingCandidates.find(candidate => {
      const next = nextNonEmptyIndex(candidate);
      return next >= 0 && isHeading(lines[next]);
    }) ?? -1;
  }

  if (closingIndex < 0) closingIndex = closingCandidates[0] ?? -1;
  if (closingIndex < 0) return content;

  const wrappedBody = lines.slice(firstFence + 1, closingIndex).join('\n');
  const containsMarkdownStructure =
    /(^|\n)#{1,6}\s+\S/.test(wrappedBody) ||
    /(^|\n)(?:[-*+]|\d+\.)\s+\S/.test(wrappedBody) ||
    /\*\*[^*\n]+\*\*/.test(wrappedBody) ||
    /(^|\n)>\s+\S/.test(wrappedBody) ||
    /(^|\n)\|.+\|\s*$/.test(wrappedBody);
  if (!containsMarkdownStructure) return content;

  return [
    ...lines.slice(0, firstFence),
    ...lines.slice(firstFence + 1, closingIndex),
    ...lines.slice(closingIndex + 1),
  ].join('\n').trim();
};

// The CLI can only identify a technology family in some reports, so its
// Technology Stack table may repeat the unhelpful value "Technology" for
// every row. Keep the persisted report untouched, but make the presentation
// useful by deriving a readable role from the detected component name.
const TECHNOLOGY_PRESENTATION: Record<string, { label: string; role: string }> = {
  caddy: { label: 'Caddy', role: 'Web server / reverse proxy' },
  graphiql: { label: 'GraphiQL', role: 'GraphQL IDE' },
  graphql: { label: 'GraphQL', role: 'API query language' },
  playground: { label: 'Playground', role: 'Interactive API explorer' },
  redoc: { label: 'ReDoc', role: 'API documentation' },
  uvicorn: { label: 'Uvicorn', role: 'ASGI server' },
};

const splitMarkdownTableRow = (line: string): string[] | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map(cell => cell.trim());
};

const formatMarkdownTableRow = (cells: string[]): string => `| ${cells.join(' | ')} |`;

/**
 * Make the CLI report's Technology Stack section readable when the generator
 * only supplied the generic `Technology` category. This is deliberately
 * narrow: it changes only the four-column Component/Version/Category/Notes
 * table immediately below the Technology Stack heading.
 */
export const sanitizeTechnologyStackTable = (content: string): string => {
  if (!content) return content;
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => /^#{1,6}\s+Technology Stack\s*$/i.test(line.trim()));
  if (headingIndex < 0) return content;

  let headerIndex = -1;
  for (let index = headingIndex + 1; index < Math.min(lines.length, headingIndex + 12); index += 1) {
    const cells = splitMarkdownTableRow(lines[index]);
    if (cells && cells.length === 4 && cells[0].toLowerCase() === 'component' && cells[2].toLowerCase() === 'category') {
      headerIndex = index;
      break;
    }
  }
  if (headerIndex < 0 || headerIndex + 1 >= lines.length) return content;

  const separator = splitMarkdownTableRow(lines[headerIndex + 1]);
  if (!separator || separator.length !== 4 || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) return content;

  const rows: Array<{ index: number; cells: string[] }> = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = splitMarkdownTableRow(lines[index]);
    if (!cells || cells.length !== 4) break;
    rows.push({ index, cells });
  }
  if (rows.length === 0) return content;

  const changedRows = rows.map(({ cells }) => {
    const component = cells[0].replace(/^\*+|\*+$/g, '').trim();
    const normalized = TECHNOLOGY_PRESENTATION[component.toLowerCase()];
    if (!normalized) return cells;
    return [normalized.label, cells[1], normalized.role, cells[3]];
  });
  const hasChange = changedRows.some((cells, rowIndex) => cells.some((cell, cellIndex) => cell !== rows[rowIndex].cells[cellIndex]));
  if (!hasChange) return content;

  const output = [...lines];
  output[headerIndex] = formatMarkdownTableRow(['Component', 'Version', 'Role', 'Notes']);
  changedRows.forEach((cells, rowIndex) => {
    output[rows[rowIndex].index] = formatMarkdownTableRow(cells);
  });
  return output.join('\n');
};

// CommonMark 0.31 §6 lists every construct a literal string can accidentally OPEN inside
// prose. A string containing none of them renders as its own bytes; one containing any of
// them may not, so it goes in a fenced block instead. Mirrors poc_format.markdown_inert
// in the CLI so both ends agree on what is safe to leave inline.
const MD_INLINE_STARTERS = /[`*_[\]<>&\\~!|]/;

const markdownInert = (value: string): boolean => {
  if (!value || value !== value.trim()) return false;
  if (/[\n\r\t]/.test(value)) return false;
  if (value.includes('  ')) return false;
  return !MD_INLINE_STARTERS.test(value);
};

// Fence one backtick longer than the longest run inside the value, so a payload that
// itself contains fences still round-trips byte-exact.
const fencedBlock = (text: string): string => {
  const runs: string[] = text.match(/`+/g) ?? [];
  const longest = runs.reduce((n, run) => Math.max(n, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
};

/**
 * Return whether a character position is inside a Markdown fenced code block.
 *
 * Reports produced by the CLI already fence some evidence values.  Protecting
 * the same value a second time creates nested fences and makes marked render
 * the literal `````text```` line as part of the code block (the broken layout
 * visible in the report viewer).  This deliberately works on source lines,
 * rather than trying to parse Markdown after the fact, so it also handles
 * fenced blocks with a language tag and tilde fences.
 */
const isInsideFencedBlock = (content: string, position: number): boolean => {
  const lines = content.split(/\r?\n/);
  let offset = 0;
  let fenceChar = '';
  let fenceLength = 0;

  for (const line of lines) {
    const lineEnd = offset + line.length;
    // A value on a fence line itself is not evidence content.  Treat it as
    // outside so a malformed report cannot make us skip unrelated text.
    if (position >= offset && position < lineEnd) return Boolean(fenceChar);

    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      const markerText = marker[1];
      const markerChar = markerText[0];
      if (!fenceChar) {
        fenceChar = markerChar;
        fenceLength = markerText.length;
      } else if (markerChar === fenceChar && markerText.length >= fenceLength) {
        fenceChar = '';
        fenceLength = 0;
      }
    }

    offset = lineEnd + 1;
  }

  return Boolean(fenceChar);
};

/** True when at least one occurrence of value is already fenced by the source. */
const hasFencedOccurrence = (content: string, value: string): boolean => {
  let from = 0;
  while (from <= content.length - value.length) {
    const index = content.indexOf(value, from);
    if (index < 0) return false;
    if (isInsideFencedBlock(content, index)) return true;
    from = index + Math.max(1, value.length);
  }
  return false;
};

/**
 * Lift finding data that the enrichment model quoted inline out of the prose and into
 * fenced blocks, BEFORE marked sees it.
 *
 * The model writes the payload straight into its sentence. marked then reads the
 * payload's own backticks as code-span delimiters and deletes them, so
 * `d.setAttribute(\`style\`,…)` reaches the reader as `d.setAttribute( style ,…)` — a
 * payload nobody can copy — while the identical bytes sit correct in raw_findings.json
 * and in final_report.md. Nothing is lost on disk: the loss is entirely at render time,
 * and it lands on the one field the report exists to deliver.
 *
 * The CLI now fences these at generation time too, but that only helps NEW reports; this
 * repairs every report already on disk. Values are matched longest-first so a short one
 * cannot split a longer one containing it. A backtick still left in the prose is the
 * model's own: an ODD count means an unpaired delimiter that swallows the rest of the
 * paragraph, so those are escaped; an even count is left alone as probably-deliberate
 * inline code.
 */
export const protectQuotedValues = (
  content: string,
  values: Array<string | null | undefined>,
): string => {
  if (!content) return content;

  let text = content;
  const blocks: Array<[string, string]> = [];
  const seen = new Set<string>();

  const candidates = values
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const value of candidates) {
    // The CLI's report generator may already have emitted this value in a
    // fenced evidence block.  Leave that block untouched: wrapping it again
    // would produce nested fences and split the surrounding paragraph.
    if (
      seen.has(value) ||
      markdownInert(value) ||
      !text.includes(value) ||
      hasFencedOccurrence(text, value)
    ) continue;
    seen.add(value);
    // NUL cannot occur in report prose or in a payload field, so the placeholder can
    // never collide with the text it is protecting.
    const token = `\u0000${blocks.length}\u0000`;
    text = text.replace(value, token);
    blocks.push([token, value]);
  }

  if ((text.match(/`/g) || []).length % 2) text = text.replace(/`/g, '\\`');

  for (const [token, value] of blocks) {
    // Function form: a literal replacement would let `$&`/`$1` inside a payload be
    // interpreted as a capture-group reference and silently corrupt the bytes.
    text = text.replace(token, () => `\n\n${fencedBlock(value)}\n\n`);
  }

  return text.trim();
};

const isPrevalidatedDetection = (detection: FindingItem): boolean => {
  const status = detection.status?.toUpperCase();
  if (status) return status === 'VALIDATED_CONFIRMED' || status === 'VALIDATED';
  return Boolean(detection.validated);
};

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
        const rank = (f: FindingItem) => isPrevalidatedDetection(f) ? 1 : 0;
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
  if (!markdown) return markdown;
  const normalizedMarkdown = sanitizeTechnologyStackTable(normalizeMarkdownDocument(markdown));
  if (detections.length === 0) return normalizedMarkdown;
  const rows = detections.map(d => {
    const conf = d.confidence != null && d.confidence > 0 ? `${Math.round(d.confidence * 100)}%` : '-';
    const status = isPrevalidatedDetection(d) ? 'Prevalidated' : 'Unconfirmed';
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
  return normalizedMarkdown + table;
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
