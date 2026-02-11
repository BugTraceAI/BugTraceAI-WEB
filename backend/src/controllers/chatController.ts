import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { sendSuccess, sendPaginated } from '../utils/responses.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

/**
 * POST /api/chats
 * Create a new chat session
 */
export const createChatSession = asyncHandler(async (req: Request, res: Response) => {
  const { session_type, title, context } = req.body;

  // Generate title if not provided
  const sessionTitle = title || `${session_type.toUpperCase()} Chat - ${new Date().toLocaleDateString()}`;

  // Create session
  const session = await prisma.chatSession.create({
    data: {
      sessionType: session_type,
      title: sessionTitle,
      context: context || null,
    },
  });

  sendSuccess(
    res,
    {
      id: session.id,
      session_type: session.sessionType,
      title: session.title,
      context: session.context,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      is_archived: session.isArchived,
    },
    201
  );
});

/**
 * GET /api/chats
 * List all chat sessions with pagination
 */
export const listChatSessions = asyncHandler(async (req: Request, res: Response) => {
  const includeArchived = req.query.include_archived === 'true';
  const limit = Math.min(parseInt((req.query.limit as string) || '50'), 100);
  const offset = parseInt((req.query.offset as string) || '0');
  const sessionType = Array.isArray(req.query.session_type)
    ? req.query.session_type[0]
    : req.query.session_type;

  // Build where clause
  const where: any = {};
  if (!includeArchived) {
    where.isArchived = false;
  }
  if (sessionType && typeof sessionType === 'string' && ['websec', 'xss', 'sql'].includes(sessionType)) {
    where.sessionType = sessionType;
  }

  // Fetch sessions with message count
  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.chatSession.count({ where }),
  ]);

  // Format response
  const formattedSessions = sessions.map((session) => ({
    id: session.id,
    session_type: session.sessionType,
    title: session.title,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    is_archived: session.isArchived,
    message_count: session._count.messages,
  }));

  sendPaginated(res, formattedSessions, total, limit, offset);
});

/**
 * GET /api/chats/:sessionId
 * Get a specific chat session
 */
export const getChatSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }

  sendSuccess(res, {
    id: session.id,
    session_type: session.sessionType,
    title: session.title,
    context: session.context,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    is_archived: session.isArchived,
    message_count: session._count.messages,
  });
});

/**
 * PATCH /api/chats/:sessionId
 * Update a chat session (title, archive status, context)
 */
export const updateChatSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { title, is_archived, context } = req.body;

  // Check if session exists
  const existingSession = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!existingSession) {
    throw new ApiError(404, 'Chat session not found');
  }

  // Build update data
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (is_archived !== undefined) updateData.isArchived = is_archived;
  if (context !== undefined) updateData.context = context;

  // Update session
  const updatedSession = await prisma.chatSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  sendSuccess(res, {
    id: updatedSession.id,
    session_type: updatedSession.sessionType,
    title: updatedSession.title,
    context: updatedSession.context,
    is_archived: updatedSession.isArchived,
    updated_at: updatedSession.updatedAt.toISOString(),
  });
});

/**
 * DELETE /api/chats/:sessionId
 * Delete a chat session and all its messages
 */
export const deleteChatSession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  // Check if session exists
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  if (!session) {
    throw new ApiError(404, 'Chat session not found');
  }

  const messageCount = session._count.messages;

  // Delete session (messages cascade delete automatically)
  await prisma.chatSession.delete({
    where: { id: sessionId },
  });

  sendSuccess(res, {
    success: true,
    deleted_session_id: sessionId,
    deleted_messages: messageCount,
  });
});

/**
 * GET /api/chats/search
 * Search chat messages by content
 */
export const searchChats = asyncHandler(async (req: Request, res: Response) => {
  const queryParam = req.query.q;
  const query = Array.isArray(queryParam) ? queryParam[0] : queryParam;
  const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new ApiError(400, 'Query parameter "q" is required and cannot be empty');
  }

  // Search messages
  const messages = await prisma.chatMessage.findMany({
    where: {
      content: {
        contains: query.trim(),
        mode: 'insensitive',
      },
      session: {
        isArchived: false,
      },
    },
    include: {
      session: {
        select: {
          id: true,
          title: true,
          sessionType: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Group by session
  const sessionMap = new Map<string, any>();

  messages.forEach((msg) => {
    if (!sessionMap.has(msg.session.id)) {
      sessionMap.set(msg.session.id, {
        session_id: msg.session.id,
        session_title: msg.session.title,
        session_type: msg.session.sessionType,
        matches: [],
        match_count: 0,
      });
    }

    const sessionData = sessionMap.get(msg.session.id);
    sessionData.matches.push({
      message_id: msg.id,
      role: msg.role,
      snippet: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''),
      created_at: msg.createdAt.toISOString(),
    });
    sessionData.match_count++;
  });

  const results = Array.from(sessionMap.values());

  sendSuccess(res, {
    query,
    total_matches: messages.length,
    sessions_matched: results.length,
    results,
  });
});

/**
 * GET /api/chats/stats
 * Get chat statistics
 */
export const getChatStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalSessions, activeSessions, archivedSessions, totalMessages, sessionsByType] =
    await Promise.all([
      prisma.chatSession.count(),
      prisma.chatSession.count({ where: { isArchived: false } }),
      prisma.chatSession.count({ where: { isArchived: true } }),
      prisma.chatMessage.count(),
      prisma.chatSession.groupBy({
        by: ['sessionType'],
        _count: true,
      }),
    ]);

  const typeBreakdown: Record<string, number> = {};
  sessionsByType.forEach((item) => {
    typeBreakdown[item.sessionType] = item._count;
  });

  sendSuccess(res, {
    total_sessions: totalSessions,
    active_sessions: activeSessions,
    archived_sessions: archivedSessions,
    total_messages: totalMessages,
    average_messages_per_session:
      totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
    sessions_by_type: typeBreakdown,
  });
});
