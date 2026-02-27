import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

// Load environment variables
dotenv.config();

// Import utilities
import {
  disconnectPrisma,
  testConnection,
  getDatabaseStats,
} from './utils/prisma.js';
import { sendSuccess } from './utils/responses.js';
import { initializeWebSocket } from './websocket/index.js';

// Import middleware
import { errorHandler, notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import {
  developmentLogger,
  productionLogger,
} from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Import routes
import chatRoutes from './routes/chatRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import kaliRoutes from './routes/kaliRoutes.js';
import reconRoutes from './routes/reconRoutes.js';
import bugtraceRoutes from './routes/bugtraceRoutes.js';

// Create Express application
const app: Express = express();
const port = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================================================
// Security Middleware
// ============================================================================

// Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ============================================================================
// General Middleware
// ============================================================================

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (morgan already tracks response time)
if (isDevelopment) {
  app.use(developmentLogger);
} else {
  app.use(productionLogger);
}

// Rate limiting (production only)
if (!isDevelopment) {
  app.use('/api', apiLimiter);
}

// ============================================================================
// Health Check Endpoints
// ============================================================================

// Basic health check
app.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// Parse DATABASE_URL to extract connection info (without password)
function getDatabaseConnectionInfo(): { host: string; port: string; database: string; user: string } | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  try {
    // postgresql://user:password@host:port/database?schema=public
    const match = dbUrl.match(/postgresql:\/\/([^:]+):[^@]+@([^:]+):(\d+)\/([^?]+)/);
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

// Detailed health check with database status
app.get(
  '/health/detailed',
  asyncHandler(async (_req: Request, res: Response) => {
    // Test database connection
    const dbConnected = await testConnection();
    const connectionInfo = getDatabaseConnectionInfo();

    let databaseInfo: any = {
      connected: dbConnected,
      host: connectionInfo?.host || 'unknown',
      port: connectionInfo?.port || 'unknown',
      database: connectionInfo?.database || 'unknown',
      user: connectionInfo?.user || 'unknown',
    };

    // Get database stats if connected
    if (dbConnected) {
      try {
        const stats = await getDatabaseStats();
        databaseInfo.stats = stats;
      } catch (error) {
        databaseInfo.statsError = 'Failed to fetch database statistics';
      }
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();

    sendSuccess(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      database: databaseInfo,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
    });
  })
);

// API version endpoint (with update check)
import { checkForUpdate } from './utils/versionCheck.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

app.get('/api/version', asyncHandler(async (_req: Request, res: Response) => {
  const update = await checkForUpdate(pkg.version);
  sendSuccess(res, {
    version: pkg.version,
    apiVersion: 'v1',
    name: 'BugTraceAI-WEB API',
    updateAvailable: update?.updateAvailable ?? false,
    latestVersion: update?.latestVersion ?? null,
    releaseUrl: update?.releaseUrl ?? null,
  });
}));

// ============================================================================
// API Routes
// ============================================================================

app.use('/api/chats', chatRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/kali', kaliRoutes);
app.use('/api/recon', reconRoutes);
app.use('/api/bugtrace', bugtraceRoutes);

// ============================================================================
// Error Handling (must be last)
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================================================
// Database Initialization
// ============================================================================

async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');

    // Test connection
    const connected = await testConnection();

    if (connected) {
      console.log('✅ Database connection successful');

      // Get and log database stats
      try {
        const stats = await getDatabaseStats();
        console.log('📊 Database statistics:', stats);
      } catch (error) {
        console.warn('⚠️  Could not fetch database statistics:', error);
      }
    } else {
      console.error('❌ Database connection failed');
      console.warn('⚠️  Server will start but database operations will fail');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    console.warn('⚠️  Server will start but database operations will fail');
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Close HTTP server
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
  }

  // Disconnect Prisma
  try {
    await disconnectPrisma();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting database:', error);
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ============================================================================
// Uncaught Error Handling
// ============================================================================

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any) => {
  console.error('❌ Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ============================================================================
// Server Startup
// ============================================================================

let server: any;

async function startServer(): Promise<void> {
  try {
    // Initialize database first
    await initializeDatabase();

    // Create HTTP server wrapping Express app
    const httpServer = createServer(app);

    // Initialize WebSocket server
    initializeWebSocket(httpServer);

    // Start HTTP server
    server = httpServer.listen(port, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 BugTraceAI-WEB Backend Server');
      console.log('='.repeat(60));
      console.log(`📍 Server URL: http://localhost:${port}`);
      console.log(`📊 Health Check: http://localhost:${port}/health`);
      console.log(`📊 Detailed Health: http://localhost:${port}/health/detailed`);
      console.log(`📦 API Version: http://localhost:${port}/api/version`);
      console.log(`🔌 WebSocket: ws://localhost:${port}/socket.io/`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 CORS Origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Export app for testing
export { app };
