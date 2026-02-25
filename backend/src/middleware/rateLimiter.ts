import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter (500 requests per 15 minutes)
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for resource creation (50 requests per 15 minutes)
 */
export const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: {
    success: false,
    error: {
      message: 'Too many creation requests from this IP, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Chat message rate limiter (120 requests per 15 minutes)
 * More generous than createLimiter since each chat exchange needs 2+ POSTs (user + assistant msg)
 */
export const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120,
  message: {
    success: false,
    error: {
      message: 'Too many messages from this IP, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strictest rate limiter for authentication/sensitive endpoints (5 requests per 15 minutes)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts from this IP, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
