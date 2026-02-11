import { Request, Response } from 'express';
import { prisma, clearAllData } from '../utils/prisma.js';
import { sendSuccess } from '../utils/responses.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/settings
 * Get all application settings
 */
export const getAllSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await prisma.appSettings.findMany({
    orderBy: { key: 'asc' },
  });

  // Convert to key-value object
  const settingsObject: Record<string, any> = {};
  settings.forEach((setting) => {
    settingsObject[setting.key] = setting.value;
  });

  sendSuccess(res, settingsObject);
});

/**
 * GET /api/settings/:key
 * Get a specific setting by key
 */
export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key as string;

  const setting = await prisma.appSettings.findUnique({
    where: { key },
  });

  if (!setting) {
    throw new ApiError(404, `Setting not found: ${key}`);
  }

  sendSuccess(res, {
    key: setting.key,
    value: setting.value,
    updated_at: setting.updatedAt.toISOString(),
  });
});

/**
 * PUT /api/settings/:key
 * Update or create a setting
 */
export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key as string;
  const { value } = req.body;

  if (value === undefined) {
    throw new ApiError(400, 'Value is required in request body');
  }

  // Upsert setting
  const setting = await prisma.appSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  sendSuccess(res, {
    key: setting.key,
    value: setting.value,
    updated_at: setting.updatedAt.toISOString(),
  });
});

/**
 * DELETE /api/settings/:key
 * Delete a setting
 */
export const deleteSetting = asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key as string;

  const setting = await prisma.appSettings.findUnique({
    where: { key },
  });

  if (!setting) {
    throw new ApiError(404, `Setting not found: ${key}`);
  }

  await prisma.appSettings.delete({
    where: { key },
  });

  sendSuccess(res, {
    success: true,
    deleted_key: key,
  });
});

/**
 * POST /api/settings/bulk
 * Update multiple settings at once
 */
export const bulkUpdateSettings = asyncHandler(async (req: Request, res: Response) => {
  const { settings } = req.body;

  // Update each setting
  const updates = Object.entries(settings).map(([key, value]) =>
    prisma.appSettings.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    })
  );

  await Promise.all(updates);

  sendSuccess(res, {
    success: true,
    updated_count: updates.length,
  });
});

/**
 * POST /api/settings/reset
 * Reset all settings to defaults
 */
export const resetSettings = asyncHandler(async (_req: Request, res: Response) => {
  // Delete all settings
  await prisma.appSettings.deleteMany({});

  // Recreate default settings
  const defaultSettings = [
    { key: 'openrouter_api_key', value: { encrypted_value: '' } },
    { key: 'openrouter_model', value: { value: 'google/gemini-3-flash-preview' } },
    { key: 'theme', value: { value: 'dark' } },
    { key: 'default_analysis_type', value: { value: 'url_analysis' } },
    { key: 'auto_save_chats', value: { value: true } },
    { key: 'show_archived_chats', value: { value: false } },
    { key: 'max_chat_history', value: { value: 100 } },
    { key: 'enable_cli_integration', value: { value: true } },
    {
      key: 'cli_reports_directory',
      value: { value: '/home/albert/Tools/BugTraceAI/BugTraceAI-CLI/reports' },
    },
  ];

  await prisma.appSettings.createMany({
    data: defaultSettings,
  });

  sendSuccess(res, {
    success: true,
    message: 'Settings reset to defaults',
    reset_count: defaultSettings.length,
  });
});

/**
 * POST /api/settings/danger-zone/clear-all
 * Clear ALL data from database (Danger Zone operation)
 * Requires confirmation phrase in body
 */
export const clearAll = asyncHandler(async (req: Request, res: Response) => {
  const { confirmation } = req.body;

  // Require exact confirmation phrase
  if (confirmation !== 'Delete All') {
    throw new ApiError(400, 'Confirmation phrase must be exactly "Delete All"');
  }

  // Clear all data
  const deleted = await clearAllData();

  sendSuccess(res, {
    success: true,
    message: 'All data has been permanently deleted',
    deleted,
  });
});
