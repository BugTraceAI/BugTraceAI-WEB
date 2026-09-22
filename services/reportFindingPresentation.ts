export interface ReportFindingEvidence {
  description?: unknown;
  details?: unknown;
  summary?: unknown;
  reasoning?: unknown;
  exploitation_details?: unknown;
  validator_notes?: unknown;
  evidence?: unknown;
  type?: unknown;
  parameter?: unknown;
  url?: unknown;
  payload?: unknown;
  severity?: unknown;
  status?: unknown;
  http_request?: string;
  http_response?: string;
  response_status?: number;
  response_excerpt?: string;
}

function asNarrativeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseEvidenceObject(evidence: unknown): Record<string, unknown> | null {
  if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
    return evidence as Record<string, unknown>;
  }
  if (typeof evidence === 'string') {
    const trimmed = evidence.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Build a 127-style markdown narrative from raw specialist evidence when
 * LLM exploitation_details were never written (e.g. scan finished before report).
 */
export function formatEvidenceAsNarrative(
  finding: ReportFindingEvidence,
  evidence: unknown,
): string {
  const type = asNarrativeText(finding.type) || 'Finding';
  const param = asNarrativeText(finding.parameter);
  const url = asNarrativeText(finding.url);
  const payload = asNarrativeText(finding.payload);
  const severity = asNarrativeText(finding.severity);
  const status = asNarrativeText(finding.status);
  const obj = parseEvidenceObject(evidence);

  const lines: string[] = [];
  lines.push('## Summary');

  const where: string[] = [];
  if (url) where.push(`\`${url}\``);
  if (param) where.push(`parameter \`${param}\``);
  const whereText = where.length ? ` on ${where.join(' via ')}` : '';

  if (obj?.method === 'smart_probe' && obj.signature_found) {
    const fileHint = payload || (typeof obj.file_content === 'string' && obj.file_content.includes('root:')
      ? '/etc/passwd'
      : '');
    lines.push(
      `A **${type}** vulnerability was confirmed${whereText}` +
        (fileHint ? ` by retrieving sensitive content (e.g. \`${fileHint}\`).` : '.'),
    );
  } else if (obj?.cracked_secret || obj?.forged_token) {
    const secret = asNarrativeText(obj.cracked_secret) || payload;
    const algo = asNarrativeText(obj.algorithm) || 'HS256';
    lines.push(
      `A **${type}** was confirmed${whereText}: JWT secret cracked` +
        (secret ? ` (\`${secret}\`)` : '') +
        ` with algorithm \`${algo}\`, allowing forged tokens.`,
    );
  } else if (obj?.nuclei_template) {
    lines.push(
      `A **${type}** finding was reported by Nuclei template \`${asNarrativeText(obj.nuclei_template)}\`` +
        (whereText ? whereText : '') +
        '.',
    );
  } else if (payload) {
    lines.push(
      `A **${type}** finding was recorded${whereText} with payload \`${payload}\`.`,
    );
  } else {
    lines.push(`A **${type}** finding was recorded${whereText || ' during the scan'}.`);
  }

  if (severity || status) {
    lines.push('');
    lines.push(
      `**Severity:** ${severity || 'n/a'}` +
        (status ? ` · **Status:** ${status}` : ''),
    );
  }

  lines.push('');
  lines.push('## Attack Scenario');
  if (param && payload) {
    lines.push(
      `An attacker supplies \`${payload}\` in the \`${param}\` parameter` +
        (url ? ` against \`${url}\`` : '') +
        `. The application processes the input without adequate validation, producing the evidence below.`,
    );
  } else if (url) {
    lines.push(
      `The issue was observed when accessing \`${url}\`. Review the evidence and HTTP request (if present) to reproduce.`,
    );
  } else {
    lines.push('Review the technical evidence below to understand the confirmed condition and reproduce the issue.');
  }

  // Structured evidence sections (readable, not a raw JSON dump)
  lines.push('');
  lines.push('## Technical Evidence');

  if (obj) {
    const skip = new Set(['forged_token']); // long tokens — show truncated separately
    const preferOrder = [
      'method',
      'signature_found',
      'cracked_secret',
      'algorithm',
      'nuclei_template',
      'template',
      'matcher_name',
      'file_content',
      'response_excerpt',
      'error',
      'dbms',
      'technique',
    ];
    const keys = [
      ...preferOrder.filter((k) => k in obj),
      ...Object.keys(obj).filter((k) => !preferOrder.includes(k) && !skip.has(k)),
    ];

    for (const key of keys) {
      const val = obj[key];
      if (val == null || val === '') continue;
      if (key === 'file_content' && typeof val === 'string') {
        const preview = val.length > 600 ? `${val.slice(0, 600)}\n…` : val;
        lines.push('');
        lines.push(`**${key}:**`);
        lines.push('```');
        lines.push(preview);
        lines.push('```');
        continue;
      }
      if (typeof val === 'object') {
        lines.push(`- **${key}:** \`${JSON.stringify(val)}\``);
      } else {
        const text = String(val);
        const shown = text.length > 240 ? `${text.slice(0, 240)}…` : text;
        lines.push(`- **${key}:** \`${shown}\``);
      }
    }

    if (obj.forged_token) {
      const tok = String(obj.forged_token);
      lines.push(`- **forged_token (prefix):** \`${tok.slice(0, 48)}…\``);
    }
  } else {
    const raw = asNarrativeText(evidence);
    if (raw) {
      lines.push('```');
      lines.push(raw.length > 800 ? `${raw.slice(0, 800)}\n…` : raw);
      lines.push('```');
    }
  }

  if (payload || param || url) {
    lines.push('');
    lines.push('## Reproduction Seeds');
    if (url) lines.push(`- **URL:** \`${url}\``);
    if (param) lines.push(`- **Parameter:** \`${param}\``);
    if (payload) lines.push(`- **Payload:** \`${payload}\``);
  }

  lines.push('');
  lines.push(
    '_Narrative synthesized from scan evidence (LLM PoC enrichment was not available for this finding)._',
  );

  return lines.join('\n');
}

/** Prefer human narrative fields; fall back to structured evidence for raw scans. */
export function getFindingNarrative(finding: ReportFindingEvidence): string {
  const preferred = [
    finding.exploitation_details,
    finding.description,
    finding.summary,
    finding.reasoning,
    finding.validator_notes,
  ];
  for (const value of preferred) {
    const text = asNarrativeText(value);
    // Prefer real prose / markdown over a bare JSON blob in description/details.
    if (text && !(text.startsWith('{') && text.includes('"'))) return text;
  }

  // `details` often carries the same JSON as evidence on DB-shaped findings —
  // only use it if it looks like prose, otherwise format via evidence path.
  const detailsText = asNarrativeText(finding.details);
  if (detailsText && !(detailsText.startsWith('{') && detailsText.includes('"'))) {
    return detailsText;
  }

  if (finding.evidence != null && finding.evidence !== '') {
    return formatEvidenceAsNarrative(finding, finding.evidence);
  }

  // details may be JSON evidence string without a separate evidence field
  if (detailsText && detailsText.startsWith('{')) {
    try {
      return formatEvidenceAsNarrative(finding, JSON.parse(detailsText));
    } catch {
      return formatEvidenceAsNarrative(finding, detailsText);
    }
  }

  // Last resort so the UI never looks "empty" for a real finding.
  const type = asNarrativeText(finding.type) || 'Finding';
  const param = asNarrativeText(finding.parameter);
  const url = asNarrativeText(finding.url);
  const payload = asNarrativeText(finding.payload);
  return formatEvidenceAsNarrative(
    finding,
    {
      note: 'No structured evidence payload was stored for this finding.',
      type,
      parameter: param || undefined,
      url: url || undefined,
      payload: payload || undefined,
    },
  );
}

export function getFindingHttpEvidence(finding: ReportFindingEvidence) {
  const request = finding.http_request || '';
  const response = finding.http_response || finding.response_excerpt || '';
  const status = finding.response_status;
  if (!request && !response && status == null) return null;
  return { request, response, status };
}
