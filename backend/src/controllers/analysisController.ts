/**
 * analysisController.ts
 *
 * Thin HTTP adapter. Parses request, calls analysisService, formats response.
 * Zero business logic — all Prisma queries and rules live in analysisService.
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { formatReport, formatReportSummary } from '../utils/formatters.js';
import { PAGINATION } from '../config/defaults.js';
import * as analysisService from '../services/analysisService.js';

/**
 * POST /api/analyses
 */
export const createAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const { analysis_type, target, vulnerabilities, metadata, session_id } = req.body;

  const report = await analysisService.createReport({
    analysis_type,
    target,
    vulnerabilities,
    metadata,
    session_id,
  });

  sendSuccess(res, {
    id: report.id,
    analysis_type: report.analysisType,
    target: report.target,
    vulnerabilities: report.vulnerabilities,
    metadata: report.metadata,
    session_id: report.sessionId,
    created_at: report.createdAt.toISOString(),
  }, 201);
});

/**
 * GET /api/analyses
 */
export const listAnalysisReports = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(
    parseInt((req.query.limit as string) || String(PAGINATION.defaultLimit)),
    PAGINATION.maxLimit
  );
  const offset = parseInt((req.query.offset as string) || '0');
  const analysisTypeParam = req.query.analysis_type;
  const analysisType = (Array.isArray(analysisTypeParam)
    ? analysisTypeParam[0]
    : analysisTypeParam) as string | undefined;
  const targetParam = req.query.target;
  const target = (Array.isArray(targetParam)
    ? targetParam[0]
    : targetParam) as string | undefined;

  const { reports, total } = await analysisService.listReports({
    limit,
    offset,
    analysisType,
    target,
  });

  sendPaginated(res, reports.map(formatReportSummary), total, limit, offset);
});

/**
 * GET /api/analyses/:reportId
 */
export const getAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await analysisService.findReport(String(req.params.reportId));

  if (!report) {
    throw new ApiError(404, 'Analysis report not found');
  }

  sendSuccess(res, formatReport(report));
});

/**
 * DELETE /api/analyses/:reportId
 */
export const deleteAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const deletedId = await analysisService.deleteReport(String(req.params.reportId));

  sendSuccess(res, {
    success: true,
    deleted_report_id: deletedId,
  });
});

/**
 * GET /api/analyses/stats
 */
export const getAnalysisStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await analysisService.getStats();

  sendSuccess(res, stats);
});

/**
 * GET /api/analyses/compare
 */
export const compareAnalyses = asyncHandler(async (req: Request, res: Response) => {
  const reportIdA = req.query.a as string;
  const reportIdB = req.query.b as string;

  const comparison = await analysisService.compareReports(reportIdA, reportIdB);

  sendSuccess(res, comparison);
});

/**
 * GET /api/analyses/:reportId/export
 */
export const exportAnalysisReport = asyncHandler(async (req: Request, res: Response) => {
  const reportId = req.params.reportId;
  const format = (req.query.format as string) || 'json';

  const result = await analysisService.exportReport(String(reportId), format);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.content);
});
