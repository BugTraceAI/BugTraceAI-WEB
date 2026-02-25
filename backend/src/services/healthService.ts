/**
 * healthService.ts
 *
 * Business logic for health check endpoints.
 * Pure functions + async database checks extracted from index.ts.
 */

import { testConnection, getDatabaseStats } from '../utils/prisma.js';

// ============================================================================
// Types
// ============================================================================

export interface DatabaseConnectionInfo {
  host: string;
  port: string;
  database: string;
  user: string;
}

export interface BasicHealthResult {
  status: string;
  timestamp: string;
  environment: string;
  uptime: number;
}

export interface DetailedHealthResult {
  status: string;
  timestamp: string;
  environment: string;
  uptime: number;
  database: {
    connected: boolean;
    host: string;
    port: string;
    database: string;
    user: string;
    stats?: Awaited<ReturnType<typeof getDatabaseStats>>;
    statsError?: string;
  };
  memory: {
    heapUsed: string;
    heapTotal: string;
  };
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Parse a PostgreSQL DATABASE_URL into connection info (without password).
 * Returns null if the URL is missing or can't be parsed.
 *
 * PURE — no I/O, no side effects.
 */
export function parseDatabaseUrl(url: string): DatabaseConnectionInfo | null {
  try {
    // postgresql://user:password@host:port/database?schema=public
    const match = url.match(/postgresql:\/\/([^:]+):[^@]+@([^:]+):(\d+)\/([^?]+)/);
    if (match) {
      return {
        user: match[1],
        host: match[2],
        port: match[3],
        database: match[4],
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

// ============================================================================
// Async Service Functions
// ============================================================================

/**
 * Basic health check — lightweight, no DB call.
 */
export function getBasicHealth(): BasicHealthResult {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  };
}

/**
 * Detailed health check — includes DB connectivity, stats, and memory.
 */
export async function getDetailedHealth(): Promise<DetailedHealthResult> {
  const dbConnected = await testConnection();
  const connectionInfo = parseDatabaseUrl(process.env.DATABASE_URL || '');

  const databaseInfo: DetailedHealthResult['database'] = {
    connected: dbConnected,
    host: connectionInfo?.host || 'unknown',
    port: connectionInfo?.port || 'unknown',
    database: connectionInfo?.database || 'unknown',
    user: connectionInfo?.user || 'unknown',
  };

  if (dbConnected) {
    try {
      databaseInfo.stats = await getDatabaseStats();
    } catch {
      databaseInfo.statsError = 'Failed to fetch database statistics';
    }
  }

  const memoryUsage = process.memoryUsage();

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    database: databaseInfo,
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    },
  };
}
