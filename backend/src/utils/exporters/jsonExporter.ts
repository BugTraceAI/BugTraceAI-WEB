import { AnalysisReport } from '@prisma/client';

export function exportToJson(report: AnalysisReport): string {
  return JSON.stringify(
    {
      id: report.id,
      analysis_type: report.analysisType,
      target: report.target,
      created_at: report.createdAt.toISOString(),
      vulnerability_count: (report.vulnerabilities as any[]).length,
      vulnerabilities: report.vulnerabilities,
      metadata: report.metadata,
    },
    null,
    2
  );
}
