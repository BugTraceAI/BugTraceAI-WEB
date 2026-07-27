import { AnalysisReport } from '@prisma/client';

interface Vulnerability {
  vulnerability: string;
  severity: string;
  description: string;
  impact: string;
  recommendation: string;
}

export function exportToCsv(report: AnalysisReport): string {
  const vulns = report.vulnerabilities as unknown as Vulnerability[];
  const rows = [
    ['Target', 'Date', 'Vulnerability', 'Severity', 'Description', 'Impact', 'Recommendation'].join(','),
  ];

  for (const v of vulns) {
    rows.push(
      [
        escapeCsv(report.target),
        report.createdAt.toISOString(),
        escapeCsv(v.vulnerability),
        v.severity,
        escapeCsv(v.description),
        escapeCsv(v.impact),
        escapeCsv(v.recommendation),
      ].join(',')
    );
  }

  return rows.join('\n');
}

function escapeCsv(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
