/**
 * chatController.ts
 *
 * Thin HTTP adapter. Parses request, calls chatService, formats response.
 * Zero business logic — all Prisma queries and rules live in chatService.
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { formatSession, formatSessionSummary } from '../utils/formatters.js';
import { PAGINATION } from '../config/defaults.js';
import * as chatService from '../services/chatService.js';

/**
 * POST /api/chats
 */
export const createChatSession = asyncHandler(async (req: Request, res: Response) => {
  const { session_type, title, context } = req.body;

  const session = await chatService.createSession({ session_type, title, context });

  sendSuccess(res, formatSession(session), 201);
});

/**
 * GET /api/chats
 */
export const listChatSessions = asyncHandler(async (req: Request, res: Response) => {
  const includeArchived = req.query.include_archived === 'true';
  const limit = Math.min(parseInt((req.query.limit as string) || String(PAGINATION.defaultLimit)), PAGINATION.maxLimit);
  const offset = parseInt((req.query.offset as string) || '0');
  const sessionType = Array.isArray(req.query.session_type)
    ? (req.query.session_type[0] as string)
    : (req.query.session_type as string | undefined);

  const { sessions, total } = await chatService.listSessions({
    includeArchived,
    limit,
    offset,
    sessionType,
  });

  sendPaginated(res, sessions.map(formatSessionSummary), total, limit, offset);
});

/**
 * GET /api/chats/:sessionId
 */
export const getChatSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await chatService.findSession(String(req.params.sessionId));

  if (!session) {
    const { ApiError } = await import('../middleware/errorHandler.js');
    throw new ApiError(404, 'Chat session not found');
  }

  sendSuccess(res, formatSession(session));
});

/**
 * PATCH /api/chats/:sessionId
 */
export const updateChatSession = asyncHandler(async (req: Request, res: Response) => {
  const { title, is_archived, context } = req.body;

  const updated = await chatService.updateSession(String(req.params.sessionId), {
    title,
    is_archived,
    context,
  });

  sendSuccess(res, {
    id: updated.id,
    session_type: updated.sessionType,
    title: updated.title,
    context: updated.context,
    is_archived: updated.isArchived,
    updated_at: updated.updatedAt.toISOString(),
  });
});

/**
 * DELETE /api/chats/:sessionId
 */
export const deleteChatSession = asyncHandler(async (req: Request, res: Response) => {
  const result = await chatService.deleteSession(String(req.params.sessionId));

  sendSuccess(res, {
    success: true,
    deleted_session_id: result.sessionId,
    deleted_messages: result.deletedMessages,
  });
});

/**
 * GET /api/chats/search
 */
export const searchChats = asyncHandler(async (req: Request, res: Response) => {
  const queryParam = req.query.q;
  const query = (Array.isArray(queryParam) ? queryParam[0] : queryParam) as string;
  const limit = Math.min(
    parseInt((req.query.limit as string) || String(PAGINATION.searchDefaultLimit)),
    PAGINATION.searchMaxLimit
  );

  const result = await chatService.searchChats(query, limit);

  sendSuccess(res, result);
});

/**
 * GET /api/chats/stats
 */
export const getChatStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await chatService.getStats();

  sendSuccess(res, stats);
});
