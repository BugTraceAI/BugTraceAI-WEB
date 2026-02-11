import { prisma } from '../../src/utils/prisma';

export async function createTestSession(overrides?: any) {
  return prisma.chatSession.create({
    data: {
      sessionType: 'websec',
      title: 'TEST Session',
      ...overrides
    }
  });
}

export async function createTestMessage(sessionId: string, overrides?: any) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'user',
      content: 'TEST message',
      ...overrides
    }
  });
}

export async function createTestAnalysis(overrides?: any) {
  return prisma.analysisReport.create({
    data: {
      analysisType: 'url_analysis',
      target: 'https://test.example.com',
      vulnerabilities: { total: 0, items: [] },
      ...overrides
    }
  });
}

export async function createTestSetting(key: string, value: any) {
  return prisma.appSettings.create({
    data: { key, value }
  });
}
