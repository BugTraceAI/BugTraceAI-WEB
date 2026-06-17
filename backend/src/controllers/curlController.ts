/**
 * curlController.ts
 *
 * Executes curl requests via execFile (no shell — prevents injection).
 * Used by the WebSecAgent chat as a tool for PoC verification and endpoint probing.
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_LENGTH = 4_000;
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function truncateOutput(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  const half = Math.floor(maxLen / 2);
  return `${str.slice(0, half)}\n... [TRUNCATED BY BUGTRACEAI] ...\n${str.slice(-half)}`;
}

export const executeCurl = asyncHandler(async (req: Request, res: Response) => {
  const { url, method, headers, data, follow_redirects, insecure } = req.body as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: string;
    follow_redirects?: boolean;
    insecure?: boolean;
  };

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    res.status(400).json({ success: false, error: 'url is required' });
    return;
  }

  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).json({ success: false, error: 'Only http/https URLs are allowed' });
      return;
    }
  } catch {
    res.status(400).json({ success: false, error: 'Invalid URL format' });
    return;
  }

  // Build args array — execFile passes these directly, no shell interpolation
  const args: string[] = [
    '-s',                        // silent (no progress bar)
    '-S',                        // show errors
    '--max-time', '25',          // curl-level timeout
    '--max-filesize', '1048576', // 1MB max download
    '-i',                        // include response headers in output
  ];

  if (method && typeof method === 'string') {
    const m = method.toUpperCase();
    if (ALLOWED_METHODS.includes(m)) {
      args.push('-X', m);
    }
  }

  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof key === 'string' && typeof value === 'string') {
        args.push('-H', `${key}: ${value}`);
      }
    }
  }

  if (data && typeof data === 'string') {
    args.push('-d', data);
  }

  if (follow_redirects !== false) {
    args.push('-L', '--max-redirs', '5');
  }

  if (insecure) {
    args.push('-k');
  }

  // URL must be last
  args.push(url.trim());

  try {
    const { stdout, stderr } = await execFileAsync('curl', args, {
      timeout: TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024, // 2MB buffer
    });

    let result = '';
    if (stdout.trim()) result += truncateOutput(stdout.trim(), MAX_OUTPUT_LENGTH);
    if (stderr.trim()) result += `\n---- [stderr] ----\n${truncateOutput(stderr.trim(), 2000)}`;
    if (!result) result = '(curl completed with no output)';

    sendSuccess(res, { success: true, result });
  } catch (error: any) {
    let errorMsg = error.message || 'curl execution failed';
    if (error.stdout) errorMsg += `\n[stdout]\n${truncateOutput(error.stdout, 3000)}`;
    if (error.stderr) errorMsg += `\n[stderr]\n${truncateOutput(error.stderr, 2000)}`;
    if (error.killed) errorMsg += `\nProcess killed (timeout after ${TIMEOUT_MS / 1000}s)`;

    sendSuccess(res, {
      success: false,
      result: `---- [curl error] ----\n${errorMsg}`,
    });
  }
});
