import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { validate } from '../middleware/validator.js';
import { updateSettingSchema, bulkUpdateSettingsSchema } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/settings
 * Get all settings as key-value object
 */
router.get('/', settingsController.getAllSettings);

/**
 * GET /api/settings/:key
 * Get a specific setting by key
 */
router.get('/:key', settingsController.getSetting);

/**
 * PUT /api/settings/:key
 * Update or create a setting
 */
router.put('/:key', validate(updateSettingSchema), settingsController.updateSetting);

/**
 * DELETE /api/settings/:key
 * Delete a setting
 */
router.delete('/:key', settingsController.deleteSetting);

/**
 * POST /api/settings/bulk
 * Update multiple settings at once
 * IMPORTANT: Must come before /:key route
 */
router.post('/bulk', validate(bulkUpdateSettingsSchema), settingsController.bulkUpdateSettings);

/**
 * POST /api/settings/reset
 * Reset all settings to defaults
 * IMPORTANT: Must come before /:key route
 */
router.post('/reset', settingsController.resetSettings);

/**
 * POST /api/settings/danger-zone/clear-all
 * Clear ALL data from the database (Danger Zone)
 * Requires body: { confirmation: "Delete All" }
 */
router.post('/danger-zone/clear-all', settingsController.clearAll);

export default router;
