/**
 * toolsRoutes.ts
 *
 * Routes for agent tools (web fetch, etc.)
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/responses.js';
import { fetchWebPage } from '../services/webFetchService.js';
import { executeCurl } from '../controllers/curlController.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

/**
 * POST /api/tools/curl
 * Body: { url: string, method?: string, headers?: object, data?: string, follow_redirects?: boolean, insecure?: boolean }
 * Returns: { success, result }
 */
import { executeLimiter } from '../middleware/rateLimiter.js';

router.post('/curl', executeLimiter, executeCurl);

/**
 * GET /api/tools/health
 * Returns container availability: { kali: bool, recon: bool, bugtrace: bool }
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const containers: [string, string][] = [
      ['kali', 'kali-mcp-server'],
      ['recon', 'reconftw-mcp'],
      ['bugtrace', 'bugtrace-cli-mcp'],
    ];
    const checks: Record<string, boolean> = {};
    await Promise.all(
      containers.map(async ([name, container]) => {
        try {
          const { stdout } = await execFileAsync(
            'docker', ['inspect', '--format={{.State.Running}}', container],
            { timeout: 3000 }
          );
          checks[name] = stdout.trim() === 'true';
        } catch {
          checks[name] = false;
        }
      })
    );
    sendSuccess(res, checks);
  })
);

export default router;
