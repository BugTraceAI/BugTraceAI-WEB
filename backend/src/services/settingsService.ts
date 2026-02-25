/**
 * settingsService.ts
 *
 * Business logic for application settings. All Prisma queries live here.
 * Controllers call these functions and format the results for HTTP responses.
 */

import { prisma, clearAllData as clearDatabase } from '../utils/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';
import { DEFAULT_SETTINGS, DANGER_ZONE_CONFIRMATION } from '../config/defaults.js';

// ============================================================================
// Output Types
// ============================================================================

export interface SettingDetail {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface BulkUpdateResult {
  success: true;
  updated_count: number;
}

export interface ResetResult {
  success: true;
  message: string;
  reset_count: number;
}

export interface DeleteSettingResult {
  success: true;
  deleted_key: string;
}

export interface ClearAllResult {
  success: true;
  message: string;
  deleted: {
    chatMessages: number;
    chatSessions: number;
    analysisReports: number;
    cliReports: number;
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all settings as a key-value object.
 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const settings = await prisma.appSettings.findMany({
    orderBy: { key: 'asc' },
  });

  const settingsObject: Record<string, unknown> = {};
  for (const setting of settings) {
    settingsObject[setting.key] = setting.value;
  }

  return settingsObject;
}

/**
 * Get a specific setting by key.
 * Throws ApiError(404) if not found.
 */
export async function getSetting(key: string): Promise<SettingDetail> {
  const setting = await prisma.appSettings.findUnique({
    where: { key },
  });

  if (!setting) {
    throw new ApiError(404, `Setting not found: ${key}`);
  }

  return {
    key: setting.key,
    value: setting.value,
    updated_at: setting.updatedAt.toISOString(),
  };
}

/**
 * Update or create a setting (upsert).
 * Throws ApiError(400) if value is undefined.
 */
export async function updateSetting(key: string, value: unknown): Promise<SettingDetail> {
  if (value === undefined) {
    throw new ApiError(400, 'Value is required in request body');
  }

  const setting = await prisma.appSettings.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });

  return {
    key: setting.key,
    value: setting.value,
    updated_at: setting.updatedAt.toISOString(),
  };
}

/**
 * Delete a setting by key.
 * Throws ApiError(404) if not found.
 */
export async function deleteSetting(key: string): Promise<DeleteSettingResult> {
  const setting = await prisma.appSettings.findUnique({
    where: { key },
  });

  if (!setting) {
    throw new ApiError(404, `Setting not found: ${key}`);
  }

  await prisma.appSettings.delete({
    where: { key },
  });

  return {
    success: true,
    deleted_key: key,
  };
}

/**
 * Update multiple settings at once.
 */
export async function bulkUpdate(settings: Record<string, unknown>): Promise<BulkUpdateResult> {
  const updates = Object.entries(settings).map(([key, value]) =>
    prisma.appSettings.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    })
  );

  await Promise.all(updates);

  return {
    success: true,
    updated_count: updates.length,
  };
}

/**
 * Reset all settings to defaults.
 * Deletes all existing settings and recreates from DEFAULT_SETTINGS.
 */
export async function resetToDefaults(): Promise<ResetResult> {
  await prisma.appSettings.deleteMany({});

  await prisma.appSettings.createMany({
    data: DEFAULT_SETTINGS as any,
  });

  return {
    success: true,
    message: 'Settings reset to defaults',
    reset_count: DEFAULT_SETTINGS.length,
  };
}

/**
 * Clear ALL data from database (Danger Zone operation).
 * Requires exact confirmation phrase.
 * Throws ApiError(400) if confirmation is wrong.
 */
export async function clearAllData(confirmation: string): Promise<ClearAllResult> {
  if (confirmation !== DANGER_ZONE_CONFIRMATION) {
    throw new ApiError(400, `Confirmation phrase must be exactly "${DANGER_ZONE_CONFIRMATION}"`);
  }

  const deleted = await clearDatabase();

  return {
    success: true,
    message: 'All data has been permanently deleted',
    deleted,
  };
}
