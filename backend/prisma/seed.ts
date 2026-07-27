import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed application settings
  const settings = [
    {
      key: 'openrouter_api_key',
      value: { encrypted_value: '' },
    },
    {
      key: 'openrouter_model',
      value: { value: 'google/gemini-3-flash-preview' },
    },
    {
      key: 'theme',
      value: { value: 'dark' },
    },
    {
      key: 'default_analysis_type',
      value: { value: 'url_analysis' },
    },
    {
      key: 'auto_save_chats',
      value: { value: true },
    },
    {
      key: 'show_archived_chats',
      value: { value: false },
    },
    {
      key: 'max_chat_history',
      value: { value: 100 },
    },
    {
      key: 'enable_cli_integration',
      value: { value: true },
    },
    {
      key: 'cli_reports_directory',
      value: { value: './reports' },
    },
  ];

  for (const setting of settings) {
    await prisma.appSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
    console.log(`  ✅ Seeded setting: ${setting.key}`);
  }

  // Create sample chat session for testing
  const sampleSession = await prisma.chatSession.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      sessionType: 'websec',
      title: 'Welcome to BugTraceAI-WEB',
      context: {
        model: 'google/gemini-3-flash-preview',
        createdBy: 'seed_script',
      },
      messages: {
        create: [
          {
            role: 'assistant',
            content:
              'Welcome to BugTraceAI-WEB! This is a sample chat session created during database setup. You can safely delete this session or use it for testing.',
          },
        ],
      },
    },
    include: {
      messages: true,
    },
  });

  console.log(`  ✅ Created sample chat session: ${sampleSession.title}`);

  // Create sample analysis report for testing
  const sampleAnalysis = await prisma.analysisReport.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      analysisType: 'url_analysis',
      target: 'https://example.com',
      vulnerabilities: {
        total: 0,
        items: [],
        summary: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      metadata: {
        scanDuration: 1234,
        timestamp: new Date().toISOString(),
        note: 'Sample analysis report created during database setup',
      },
    },
  });

  console.log(`  ✅ Created sample analysis report: ${sampleAnalysis.target}`);

  console.log('\n🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
