import { z } from 'zod';

// Session type validation
export const sessionTypeSchema = z.enum(['websec', 'xss', 'sql']);

// Message role validation
export const messageRoleSchema = z.enum(['user', 'assistant', 'error']);

// Analysis type validation
export const analysisTypeSchema = z.enum([
  'url_analysis',
  'code_analysis',
  'jwt_analysis',
  'security_headers',
  'file_upload',
  'privesc',
]);

// UUID validation
export const uuidSchema = z.string().uuid();

// Create chat session validation
export const createChatSessionSchema = z.object({
  session_type: sessionTypeSchema,
  title: z.string().min(1).max(255).optional(),
});

// Create message validation
export const createMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().min(1),
});

// Pagination validation
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(50),
  offset: z.number().int().min(0).default(0),
});

// Update chat session validation (additional fields)
export const updateChatSessionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  is_archived: z.boolean().optional(),
  context: z.any().optional(),
});

// Bulk messages validation
export const createBulkMessagesSchema = z.object({
  messages: z.array(
    z.object({
      role: messageRoleSchema,
      content: z.string().min(1),
    })
  ).min(1).max(100),
});

// Analysis report validation
export const createAnalysisSchema = z.object({
  analysis_type: analysisTypeSchema,
  target: z.string().min(1),
  vulnerabilities: z.array(z.any()),
  metadata: z.record(z.string(), z.any()).optional(),
  session_id: z.string().uuid().nullable().optional(),
});

// Settings validation
export const updateSettingSchema = z.object({
  value: z.any(),
});

export const bulkUpdateSettingsSchema = z.object({
  settings: z.record(z.string(), z.any()),
});
