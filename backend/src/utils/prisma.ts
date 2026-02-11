import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma Client instance
 * Prevents multiple instances in development with hot-reloading
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1;`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  const [
    chatSessionCount,
    chatMessageCount,
    analysisReportCount,
    cliReportCount,
    settingsCount,
  ] = await Promise.all([
    prisma.chatSession.count(),
    prisma.chatMessage.count(),
    prisma.analysisReport.count(),
    prisma.cliReport.count(),
    prisma.appSettings.count(),
  ]);

  return {
    chatSessions: chatSessionCount,
    chatMessages: chatMessageCount,
    analysisReports: analysisReportCount,
    cliReports: cliReportCount,
    settings: settingsCount,
  };
}

/**
 * Clear all data from the database (Danger Zone)
 * Deletes all records from all tables except AppSettings
 */
export async function clearAllData() {
  // Delete in order to respect foreign key constraints
  // Messages depend on Sessions, so delete messages first
  const deletedMessages = await prisma.chatMessage.deleteMany({});
  const deletedSessions = await prisma.chatSession.deleteMany({});
  const deletedAnalyses = await prisma.analysisReport.deleteMany({});
  const deletedCliReports = await prisma.cliReport.deleteMany({});

  return {
    chatMessages: deletedMessages.count,
    chatSessions: deletedSessions.count,
    analysisReports: deletedAnalyses.count,
    cliReports: deletedCliReports.count,
  };
}
