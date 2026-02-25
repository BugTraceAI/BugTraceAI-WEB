/**
 * settingsController.ts
 *
 * Thin HTTP adapter. Parses request, calls settingsService, formats response.
 * Zero business logic — all Prisma queries and rules live in settingsService.
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as settingsService from '../services/settingsService.js';

/**
 * GET /api/settings
 */
export const getAllSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getAllSettings();

  sendSuccess(res, settings);
});

/**
 * GET /api/settings/:key
 */
export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.getSetting(String(req.params.key));

  sendSuccess(res, result);
});

/**
 * PUT /api/settings/:key
 */
export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.updateSetting(String(req.params.key), req.body.value);

  sendSuccess(res, result);
});

/**
 * DELETE /api/settings/:key
 */
export const deleteSetting = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.deleteSetting(String(req.params.key));

  sendSuccess(res, result);
});

/**
 * POST /api/settings/bulk
 */
export const bulkUpdateSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.bulkUpdate(req.body.settings);

  sendSuccess(res, result);
});

/**
 * POST /api/settings/reset
 */
export const resetSettings = asyncHandler(async (_req: Request, res: Response) => {
  const result = await settingsService.resetToDefaults();

  sendSuccess(res, result);
});

/**
 * POST /api/settings/danger-zone/clear-all
 */
export const clearAll = asyncHandler(async (req: Request, res: Response) => {
  const result = await settingsService.clearAllData(req.body.confirmation);

  sendSuccess(res, result);
});
