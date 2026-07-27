/**
 * messageService.ts
 *
 * Business logic for chat messages. All Prisma queries live here.
 * Controllers call these functions and format the results for HTTP responses.
 */

import { prisma } from '../utils/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateMessageInput {
  role: string;
  content: string;
}

// ============================================================================
// Helper: Verify Session Exists
// ============================================================================

async function requireSession(sessionId: string): Promise<void> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List messages for a session with pagination.
 * Throws ApiError(404) if session doesn't exist.
 * Returns [messages, totalCount].
 */
export async function listMessages(
  sessionId: string,
  limit: number,
  offset: number
) {
  await requireSession(sessionId);

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.chatMessage.count({ where: { sessionId } }),
  ]);

  return { messages, total };
}

/**
 * Create a single message in a session.
 * Updates session's updatedAt timestamp.
 * Throws ApiError(404) if session doesn't exist.
 */
export async function createMessage(sessionId: string, input: CreateMessageInput) {
  await requireSession(sessionId);

  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: input.role,
      content: input.content.trim(),
    },
  });

  // Update session timestamp
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  return message;
}

/**
 * Create multiple messages at once (bulk import).
 * Updates session's updatedAt timestamp.
 * Throws ApiError(404) if session doesn't exist.
 * Returns the count of created messages.
 */
export async function createBulkMessages(
  sessionId: string,
  messages: CreateMessageInput[]
): Promise<number> {
  await requireSession(sessionId);

  const result = await prisma.chatMessage.createMany({
    data: messages.map((msg) => ({
      sessionId,
      role: msg.role,
      content: msg.content.trim(),
    })),
  });

  // Update session timestamp
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  return result.count;
}

/**
 * Delete a specific message from a session.
 * Throws ApiError(404) if message not found in the given session.
 */
export async function deleteMessage(
  sessionId: string,
  messageId: string
): Promise<string> {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      sessionId,
    },
  });

  if (!message) {
    throw new ApiError(404, 'Message not found in this session');
  }

  await prisma.chatMessage.delete({
    where: { id: messageId },
  });

  return messageId;
}
