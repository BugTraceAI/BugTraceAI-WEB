/**
 * toolsRoutes.ts
 *
 * Routes for agent tools (web fetch, etc.)
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/responses.js';
import { fetchWebPage } from '../services/webFetchService.js';

const router = Router();

/**
 * POST /api/tools/fetch
 * Body: { url: string }
 * Returns: { url, content, chars }
 */
router.post(
  '/fetch',
  asyncHandler(async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      res.status(400).json({ success: false, error: 'url is required' });
      return;
    }

    const content = await fetchWebPage(url.trim());

    sendSuccess(res, {
      url: url.trim(),
      content,
      chars: content.length,
    });
  })
);

export default router;
