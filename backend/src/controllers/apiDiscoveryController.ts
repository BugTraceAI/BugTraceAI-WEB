/**
 * apiDiscoveryController.ts
 *
 * HTTP adapter for API Discovery scan persistence.
 * Replaces localStorage (bugtraceai.api-discovery.saved-scans.v1) with
 * a real database backend so scans survive browser clears and are shared
 * across devices on the same instance.
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { PAGINATION } from '../config/defaults.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatScan(scan: Record<string, unknown>) {
  return {
    id:            scan.id,
    scanId:        scan.scanId,
    target:        scan.target,
    wordlist:      scan.wordlist,
    status:        scan.status,
    routesFound:   scan.routesFound,
    routes:        scan.routes,
    urlList:       scan.urlList,
    startedAt:     scan.startedAt ? (scan.startedAt as Date).toISOString() : null,
    finishedAt:    scan.finishedAt ? (scan.finishedAt as Date).toISOString() : null,
    warning:       scan.warning ?? null,
    warningDetail: scan.warningDetail ?? null,
    error:         scan.error ?? null,
    createdAt:     (scan.createdAt as Date).toISOString(),
  };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/api-discovery/scans
 * Save a completed scan to the database.
 */
export const createScan = asyncHandler(async (req: Request, res: Response) => {
  const {
    scan_id, target, wordlist, status, routes_found, routes,
    url_list, started_at, finished_at, warning, warning_detail, error,
  } = req.body;

  if (!scan_id || !target || !wordlist || !status) {
    throw new ApiError(400, 'Missing required fields: scan_id, target, wordlist, status');
  }
  if (!Array.isArray(routes)) {
    throw new ApiError(400, 'routes must be an array');
  }

  
  const scan = await prisma.apiDiscoveryScan.create({
    data: {
      scanId:        Number(scan_id),
      target:        String(target),
      wordlist:      String(wordlist),
      status:        String(status),
      routesFound:   Number(routes_found ?? routes.length),
      routes:        routes,
      urlList:       Array.isArray(url_list) ? url_list : [],
      startedAt:     started_at ? new Date(started_at) : null,
      finishedAt:    finished_at ? new Date(finished_at) : null,
      warning:       warning ?? null,
      warningDetail: warning_detail ?? null,
      error:         error ?? null,
    },
  });

  sendSuccess(res, formatScan(scan as unknown as Record<string, unknown>), 201);
});

/**
 * GET /api/api-discovery/scans
 * List saved scans, newest first, paginated.
 */
export const listScans = asyncHandler(async (req: Request, res: Response) => {
  const limit  = Math.min(parseInt((req.query.limit  as string) || String(PAGINATION.defaultLimit)), PAGINATION.maxLimit);
  const offset = parseInt((req.query.offset as string) || '0');
  const targetQ = req.query.target;
  const target  = Array.isArray(targetQ) ? (targetQ[0] as string) : (targetQ as string | undefined);

  const where = target ? { target: { contains: target } } : {};

  const [scans, total] = await Promise.all([
    prisma.apiDiscoveryScan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  offset,
      take:  limit,
    }),
    prisma.apiDiscoveryScan.count({ where }),
  ]);

  sendPaginated(res, scans.map((s: Record<string, unknown>) => formatScan(s)), total, limit, offset);
});

/**
 * GET /api/api-discovery/scans/:id
 * Get a single saved scan by UUID.
 */
export const getScan = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const scan = await prisma.apiDiscoveryScan.findUnique({ where: { id } });
  if (!scan) throw new ApiError(404, 'Scan not found');
  sendSuccess(res, formatScan(scan as unknown as Record<string, unknown>));
});

/**
 * DELETE /api/api-discovery/scans/:id
 * Delete a saved scan.
 */
export const deleteScan = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  try {
    await prisma.apiDiscoveryScan.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  } catch {
    throw new ApiError(404, 'Scan not found');
  }
});

/**
 * DELETE /api/api-discovery/scans
 * Delete ALL saved scans (clear all).
 */
export const clearAllScans = asyncHandler(async (_req: Request, res: Response) => {
  
  const { count } = await prisma.apiDiscoveryScan.deleteMany();
  sendSuccess(res, { deleted: count });
});
