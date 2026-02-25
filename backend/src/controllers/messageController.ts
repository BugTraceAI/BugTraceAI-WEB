/**
 * messageController.ts
 *
 * Thin HTTP adapter. Parses request, calls messageService, formats response.
 * Zero business logic — all Prisma queries and rules live in messageService.
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatMessage, formatMessageWithSession } from '../utils/formatters.js';
import { PAGINATION } from '../config/defaults.js';
import * as messageService from '../services/messageService.js';

/**
 * GET /api/chats/:sessionId/messages
 */
export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const limit = Math.min(
    parseInt((req.query.limit as string) || String(PAGINATION.messageDefaultLimit)),
    PAGINATION.messageMaxLimit
  );
  const offset = parseInt((req.query.offset as string) || '0');

  const { messages, total } = await messageService.listMessages(String(sessionId), limit, offset);

  sendPaginated(res, messages.map(formatMessage), total, limit, offset);
});

/**
 * POST /api/chats/:sessionId/messages
 */
export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const { role, content } = req.body;

  const message = await messageService.createMessage(String(req.params.sessionId), { role, content });

  sendSuccess(res, formatMessageWithSession(message), 201);
});

/**
 * DELETE /api/chats/:sessionId/messages/:messageId
 */
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const deletedId = await messageService.deleteMessage(String(req.params.sessionId), String(req.params.messageId));

  sendSuccess(res, {
    success: true,
    deleted_message_id: deletedId,
  });
});

/**
 * POST /api/chats/:sessionId/messages/bulk
 */
export const createBulkMessages = asyncHandler(async (req: Request, res: Response) => {
  const { messages } = req.body;

  const count = await messageService.createBulkMessages(String(req.params.sessionId), messages);

  sendSuccess(res, {
    success: true,
    created_count: count,
  }, 201);
});
