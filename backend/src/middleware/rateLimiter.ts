import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '../config/defaults.js';

/**
 * Build a rate limiter from a RATE_LIMITS config entry.
 * Wraps the message string into the standard error envelope.
 */
function buildLimiter(config: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      success: false,
      error: {
        message: config.message,
        statusCode: 429,
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * General API rate limiter
 */
export const apiLimiter = buildLimiter(RATE_LIMITS.api);

/**
 * Stricter rate limiter for resource creation
 */
export const createLimiter = buildLimiter(RATE_LIMITS.create);

/**
 * Chat message rate limiter — more generous since each chat exchange needs 2+ POSTs
 */
export const messageLimiter = buildLimiter(RATE_LIMITS.message);

/**
 * Strictest rate limiter for authentication/sensitive endpoints
 */
export const authLimiter = buildLimiter(RATE_LIMITS.auth);
