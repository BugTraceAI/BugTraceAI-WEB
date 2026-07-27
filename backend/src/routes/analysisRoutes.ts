import { Router } from 'express';
import * as analysisController from '../controllers/analysisController.js';
import { validate, validateUuid } from '../middleware/validator.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { createAnalysisSchema } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/analyses
 * Create a new analysis report
 */
router.post('/', createLimiter, validate(createAnalysisSchema), analysisController.createAnalysisReport);

/**
 * GET /api/analyses
 * List all analysis reports
 * Query params: limit, offset, analysis_type, target
 */
router.get('/', analysisController.listAnalysisReports);

/**
 * GET /api/analyses/stats
 * Get analysis statistics
 * IMPORTANT: Must come before /:reportId route
 */
router.get('/stats', analysisController.getAnalysisStats);

/**
 * GET /api/analyses/compare
 * Compare two analyses
 * Query params: a (reportId), b (reportId)
 * IMPORTANT: Must come before /:reportId route
 */
router.get('/compare', analysisController.compareAnalyses);

/**
 * GET /api/analyses/:reportId
 * Get a specific analysis report
 */
router.get('/:reportId', validateUuid('reportId'), analysisController.getAnalysisReport);

/**
 * GET /api/analyses/:reportId/export
 * Export analysis report
 * Query params: format (json, csv, pdf)
 */
router.get('/:reportId/export', validateUuid('reportId'), analysisController.exportAnalysisReport);

/**
 * DELETE /api/analyses/:reportId
 * Delete an analysis report
 */
router.delete('/:reportId', validateUuid('reportId'), analysisController.deleteAnalysisReport);

export default router;
