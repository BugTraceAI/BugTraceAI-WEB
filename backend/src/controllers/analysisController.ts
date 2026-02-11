import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { compareAnalyses as compareEngine } from '../utils/comparisonEngine.js';

/**
 * POST /api/analyses
 * Create a new analysis report
 */
export const createAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const { analysis_type, target, vulnerabilities, metadata, session_id } = req.body;

  // Create analysis report
  const report = await prisma.analysisReport.create({
    data: {
      analysisType: analysis_type,
      target,
      vulnerabilities,
      metadata: metadata || null,
      sessionId: session_id || null,
    },
  });

  sendSuccess(
    res,
    {
      id: report.id,
      analysis_type: report.analysisType,
      target: report.target,
      vulnerabilities: report.vulnerabilities,
      metadata: report.metadata,
      session_id: report.sessionId,
      created_at: report.createdAt.toISOString(),
    },
    201
  );
});

/**
 * GET /api/analyses
 * List all analysis reports with pagination
 */
export const listAnalysisReports = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '50'), 100);
  const offset = parseInt((req.query.offset as string) || '0');
  const analysisTypeParam = req.query.analysis_type;
  const analysisType = Array.isArray(analysisTypeParam) ? analysisTypeParam[0] : analysisTypeParam;
  const targetParam = req.query.target;
  const target = Array.isArray(targetParam) ? targetParam[0] : targetParam;

  // Build where clause
  const where: any = {};
  if (analysisType && typeof analysisType === 'string' && ['url_analysis', 'code_analysis', 'jwt_analysis', 'security_headers', 'file_upload', 'privesc'].includes(analysisType)) {
    where.analysisType = analysisType;
  }
  if (target && typeof target === 'string') {
    where.target = {
      contains: target,
      mode: 'insensitive',
    };
  }

  // Fetch reports
  const [reports, total] = await Promise.all([
    prisma.analysisReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.analysisReport.count({ where }),
  ]);

  // Format response
  const formattedReports = reports.map((report) => ({
    id: report.id,
    analysis_type: report.analysisType,
    target: report.target,
    vulnerabilities: report.vulnerabilities,
    metadata: report.metadata,
    created_at: report.createdAt.toISOString(),
  }));

  sendPaginated(res, formattedReports, total, limit, offset);
});

/**
 * GET /api/analyses/:reportId
 * Get a specific analysis report
 */
export const getAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const reportId = req.params.reportId as string;

  const report = await prisma.analysisReport.findUnique({
    where: { id: reportId },
    include: {
      session: {
        select: { id: true, title: true, sessionType: true }
      }
    }
  });

  if (!report) {
    throw new ApiError(404, 'Analysis report not found');
  }

  sendSuccess(res, {
    id: report.id,
    analysis_type: report.analysisType,
    target: report.target,
    vulnerabilities: report.vulnerabilities,
    metadata: report.metadata,
    session_id: report.sessionId,
    session: report.session ? {
      id: report.session.id,
      title: report.session.title,
      session_type: report.session.sessionType,
    } : null,
    created_at: report.createdAt.toISOString(),
  });
});

/**
 * DELETE /api/analyses/:reportId
 * Delete an analysis report
 */
export const deleteAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const reportId = req.params.reportId as string;

  // Check if report exists
  const report = await prisma.analysisReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new ApiError(404, 'Analysis report not found');
  }

  // Delete report
  await prisma.analysisReport.delete({
    where: { id: reportId },
  });

  sendSuccess(res, {
    success: true,
    deleted_report_id: reportId,
  });
});

/**
 * GET /api/analyses/stats
 * Get analysis statistics
 */
export const getAnalysisStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalReports, reportsByType] = await Promise.all([
    prisma.analysisReport.count(),
    prisma.analysisReport.groupBy({
      by: ['analysisType'],
      _count: true,
    }),
  ]);

  const typeBreakdown: Record<string, number> = {};
  reportsByType.forEach((item) => {
    typeBreakdown[item.analysisType] = item._count;
  });

  // Get recent reports
  const recentReports = await prisma.analysisReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      analysisType: true,
      target: true,
      createdAt: true,
    },
  });

  sendSuccess(res, {
    total_reports: totalReports,
    reports_by_type: typeBreakdown,
    recent_reports: recentReports.map((r) => ({
      id: r.id,
      analysis_type: r.analysisType,
      target: r.target,
      created_at: r.createdAt.toISOString(),
    })),
  });
});

/**
 * GET /api/analyses/compare
 * Compare two analysis reports
 */
export const compareAnalyses = asyncHandler(async (req: Request, res: Response) => {
  const reportIdA = req.query.a as string;
  const reportIdB = req.query.b as string;

  if (!reportIdA || !reportIdB) {
    throw new ApiError(400, 'Both report IDs (a and b) are required');
  }

  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportIdA) || !uuidRegex.test(reportIdB)) {
    throw new ApiError(400, 'Invalid report ID format');
  }

  // Fetch both reports
  const [reportA, reportB] = await Promise.all([
    prisma.analysisReport.findUnique({ where: { id: reportIdA } }),
    prisma.analysisReport.findUnique({ where: { id: reportIdB } }),
  ]);

  if (!reportA) throw new ApiError(404, `Report ${reportIdA} not found`);
  if (!reportB) throw new ApiError(404, `Report ${reportIdB} not found`);

  // Run comparison
  const comparison = compareEngine(reportA, reportB);

  sendSuccess(res, comparison);
});

/**
 * GET /api/analyses/:reportId/export
 * Export analysis report in JSON, CSV, or PDF format
 */
export const exportAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const reportId = req.params.reportId as string;
  const format = (req.query.format as string) || 'json';

  if (!['json', 'csv', 'pdf'].includes(format)) {
    throw new ApiError(400, 'Invalid format. Use json, csv, or pdf');
  }

  const report = await prisma.analysisReport.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new ApiError(404, 'Analysis report not found');
  }

  // Sanitize filename
  const sanitizedTarget = report.target
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 50)
    .toLowerCase();
  const date = report.createdAt.toISOString().split('T')[0];
  const filename = `bugtraceai-${sanitizedTarget}-${date}`;

  switch (format) {
    case 'json': {
      const { exportToJson } = await import('../utils/exporters/jsonExporter.js');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(exportToJson(report));
      break;
    }
    case 'csv': {
      const { exportToCsv } = await import('../utils/exporters/csvExporter.js');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(exportToCsv(report));
      break;
    }
    case 'pdf': {
      const { exportToPdf } = await import('../utils/exporters/pdfExporter.js');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(exportToPdf(report));
      break;
    }
  }
});
