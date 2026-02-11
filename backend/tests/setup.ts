import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/utils/prisma';

// Setup before all tests
beforeAll(async () => {
  console.log('Setting up test environment...');
  await prisma.$connect();
  console.log('Test database connected');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  await prisma.$disconnect();
  console.log('Test database disconnected');
});

// Clean test data before each test
beforeEach(async () => {
  // Delete test data (marked with TEST prefix or test.example.com)
  await prisma.chatMessage.deleteMany({
    where: {
      session: {
        title: { contains: 'TEST' }
      }
    }
  });
  await prisma.chatSession.deleteMany({
    where: { title: { contains: 'TEST' } }
  });
  await prisma.analysisReport.deleteMany({
    where: { target: { contains: 'test.example.com' } }
  });
  await prisma.cliReport.deleteMany({
    where: { reportPath: { contains: '/test/' } }
  });
  await prisma.appSettings.deleteMany({
    where: { key: { startsWith: 'test_' } }
  });
});
