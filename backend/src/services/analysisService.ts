/**
 * analysisService.ts
 *
 * Business logic for analysis reports. All Prisma queries live here.
 * Controllers call these functions and format the results for HTTP responses.
 */

import { prisma } from '../utils/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';
import { compareAnalyses as compareEngine } from '../utils/comparisonEngine.js';
import { buildExportFilename, formatRecentReport } from '../utils/formatters.js';
import { VALID_ANALYSIS_TYPES, VALID_EXPORT_FORMATS, PAGINATION } from '../config/defaults.js';
import type { ExportFormat } from '../config/defaults.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateReportInput {
  analysis_type: string;
  target: string;
  vulnerabilities: unknown[];
  metadata?: Record<string, unknown>;
  session_id?: string | null;
}

export interface ReportFilters {
  limit: number;
  offset: number;
  analysisType?: string;
  target?: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface AnalysisStats {
  total_reports: number;
  reports_by_type: Record<string, number>;
  recent_reports: Array<{
    id: string;
    analysis_type: string;
    target: string;
    created_at: string;
  }>;
}

export interface ExportResult {
  content: string | Buffer;
  contentType: string;
  filename: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new analysis report.
 */
export async function createReport(input: CreateReportInput) {
  return prisma.analysisReport.create({
    data: {
      analysisType: input.analysis_type,
      target: input.target,
      vulnerabilities: input.vulnerabilities as any,
      metadata: (input.metadata as any) || null,
      sessionId: input.session_id || null,
    },
  });
}

/**
 * Find a single analysis report by ID with session join.
 * Returns null if not found.
 */
export async function findReport(reportId: string) {
  return prisma.analysisReport.findUnique({
    where: { id: reportId },
    include: {
      session: {
        select: { id: true, title: true, sessionType: true },
      },
    },
  });
}

/**
 * List analysis reports with pagination and filters.
 * Returns [reports, totalCount].
 */
export async function listReports(filters: ReportFilters) {
  const where: Record<string, unknown> = {};

  if (
    filters.analysisType &&
    typeof filters.analysisType === 'string' &&
    (VALID_ANALYSIS_TYPES as readonly string[]).includes(filters.analysisType)
  ) {
    where.analysisType = filters.analysisType;
  }

  if (filters.target && typeof filters.target === 'string') {
    where.target = {
      contains: filters.target,
      mode: 'insensitive',
    };
  }

  const [reports, total] = await Promise.all([
    prisma.analysisReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    }),
    prisma.analysisReport.count({ where }),
  ]);

  return { reports, total };
}

/**
 * Delete an analysis report.
 * Throws ApiError(404) if not found.
 */
export async function deleteReport(reportId: string): Promise<string> {
  const report = await prisma.analysisReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new ApiError(404, 'Analysis report not found');
  }

  await prisma.analysisReport.delete({
    where: { id: reportId },
  });

  return reportId;
}

/**
 * Get analysis statistics including type breakdown and recent reports.
 */
export async function getStats(): Promise<AnalysisStats> {
  const [totalReports, reportsByType] = await Promise.all([
    prisma.analysisReport.count(),
    prisma.analysisReport.groupBy({
      by: ['analysisType'],
      _count: true,
    }),
  ]);

  const typeBreakdown: Record<string, number> = {};
  for (const item of reportsByType) {
    typeBreakdown[item.analysisType] = item._count;
  }

  const recentReports = await prisma.analysisReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: PAGINATION.recentReportsLimit,
    select: {
      id: true,
      analysisType: true,
      target: true,
      createdAt: true,
    },
  });

  return {
    total_reports: totalReports,
    reports_by_type: typeBreakdown,
    recent_reports: recentReports.map(formatRecentReport),
  };
}

/**
 * Compare two analysis reports.
 * Validates UUIDs and fetches both reports.
 * Throws ApiError(400) if IDs missing/invalid, ApiError(404) if report not found.
 */
export async function compareReports(reportIdA: string, reportIdB: string) {
  if (!reportIdA || !reportIdB) {
    throw new ApiError(400, 'Both report IDs (a and b) are required');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportIdA) || !uuidRegex.test(reportIdB)) {
    throw new ApiError(400, 'Invalid report ID format');
  }

  const [reportA, reportB] = await Promise.all([
    prisma.analysisReport.findUnique({ where: { id: reportIdA } }),
    prisma.analysisReport.findUnique({ where: { id: reportIdB } }),
  ]);

  if (!reportA) throw new ApiError(404, `Report ${reportIdA} not found`);
  if (!reportB) throw new ApiError(404, `Report ${reportIdB} not found`);

  return compareEngine(reportA, reportB);
}

/**
 * Export an analysis report in the specified format.
 * Throws ApiError(400) if format invalid, ApiError(404) if report not found.
 */
export async function exportReport(
  reportId: string,
  format: string
): Promise<ExportResult> {
  if (!(VALID_EXPORT_FORMATS as readonly string[]).includes(format)) {
    throw new ApiError(400, 'Invalid format. Use json, csv, or pdf');
  }

  const report = await prisma.analysisReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new ApiError(404, 'Analysis report not found');
  }

  const filename = buildExportFilename(report.target, report.createdAt);

  switch (format as ExportFormat) {
    case 'json': {
      const { exportToJson } = await import('../utils/exporters/jsonExporter.js');
      return {
        content: exportToJson(report),
        contentType: 'application/json',
        filename: `${filename}.json`,
      };
    }
    case 'csv': {
      const { exportToCsv } = await import('../utils/exporters/csvExporter.js');
      return {
        content: exportToCsv(report),
        contentType: 'text/csv',
        filename: `${filename}.csv`,
      };
    }
    case 'pdf': {
      const { exportToPdf } = await import('../utils/exporters/pdfExporter.js');
      return {
        content: exportToPdf(report),
        contentType: 'application/pdf',
        filename: `${filename}.pdf`,
      };
    }
    default:
      throw new ApiError(400, 'Invalid format. Use json, csv, or pdf');
  }
}
