import { Response } from 'express';

/**
 * Send successful response with data
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send paginated response
 */
export function sendPaginated<T>(
  res: Response,
  results: T[],
  total: number,
  limit: number,
  offset: number,
  statusCode: number = 200
): Response {
  const hasMore = offset + results.length < total;

  return res.status(statusCode).json({
    success: true,
    data: {
      results,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
