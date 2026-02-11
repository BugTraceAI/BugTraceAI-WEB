import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/chats/:sessionId/messages
 * Get all messages for a chat session
 */
export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const limit = Math.min(parseInt((req.query.limit as string) || '1000'), 1000);
  const offset = parseInt((req.query.offset as string) || '0');

  // Verify session exists
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }

  // Fetch messages
  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.chatMessage.count({ where: { sessionId } }),
  ]);

  // Format response
  const formattedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    created_at: msg.createdAt.toISOString(),
  }));

  sendPaginated(res, formattedMessages, total, limit, offset);
});

/**
 * POST /api/chats/:sessionId/messages
 * Create a new message in a chat session
 */
export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { role, content } = req.body;

  // Verify session exists
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }

  // Create message
  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content: content.trim(),
    },
  });

  // Update session's updatedAt timestamp
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });

  sendSuccess(
    res,
    {
      id: message.id,
      session_id: message.sessionId,
      role: message.role,
      content: message.content,
      created_at: message.createdAt.toISOString(),
    },
    201
  );
});

/**
 * DELETE /api/chats/:sessionId/messages/:messageId
 * Delete a specific message
 */
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const messageId = req.params.messageId as string;

  // Verify message exists and belongs to session
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      sessionId,
    },
  });

  if (!message) {
    throw new ApiError(404, 'Message not found in this session');
  }

  // Delete message
  await prisma.chatMessage.delete({
    where: { id: messageId },
  });

  sendSuccess(res, {
    success: true,
    deleted_message_id: messageId,
  });
});

/**
 * POST /api/chats/:sessionId/messages/bulk
 * Create multiple messages at once (for importing)
 */
export const createBulkMessages = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { messages } = req.body;

  // Verify session exists
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }

  // Create messages
  const createdMessages = await prisma.chatMessage.createMany({
    data: messages.map((msg: any) => ({
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

  sendSuccess(
    res,
    {
      success: true,
      created_count: createdMessages.count,
    },
    201
  );
});
