/**
 * chatService.ts
 *
 * Business logic for chat sessions. All Prisma queries live here.
 * Controllers call these functions and format the results for HTTP responses.
 */

import { prisma } from '../utils/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';
import { generateSessionTitle, truncateSnippet } from '../utils/formatters.js';
import { PAGINATION, VALID_SESSION_TYPES } from '../config/defaults.js';

// ============================================================================
// Input Types
// ============================================================================

export interface CreateSessionInput {
  session_type: string;
  title?: string;
  context?: unknown;
}

export interface UpdateSessionInput {
  title?: string;
  is_archived?: boolean;
  context?: unknown;
}

export interface SessionFilters {
  includeArchived: boolean;
  limit: number;
  offset: number;
  sessionType?: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface DeleteSessionResult {
  sessionId: string;
  deletedMessages: number;
}

export interface SearchMatch {
  message_id: string;
  role: string;
  snippet: string;
  created_at: string;
}

export interface SearchSessionResult {
  session_id: string;
  session_title: string;
  session_type: string;
  matches: SearchMatch[];
  match_count: number;
}

export interface SearchResult {
  query: string;
  total_matches: number;
  sessions_matched: number;
  results: SearchSessionResult[];
}

export interface ChatStats {
  total_sessions: number;
  active_sessions: number;
  archived_sessions: number;
  total_messages: number;
  average_messages_per_session: number;
  sessions_by_type: Record<string, number>;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new chat session.
 */
export async function createSession(input: CreateSessionInput) {
  const sessionTitle = input.title || generateSessionTitle(input.session_type);

  return prisma.chatSession.create({
    data: {
      sessionType: input.session_type,
      title: sessionTitle,
      context: (input.context as any) || null,
    },
  });
}

/**
 * Find a single chat session by ID. Returns null if not found.
 */
export async function findSession(sessionId: string) {
  return prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });
}

/**
 * List chat sessions with pagination and filters.
 * Returns [sessions, totalCount].
 */
export async function listSessions(filters: SessionFilters) {
  const where: Record<string, unknown> = {};

  if (!filters.includeArchived) {
    where.isArchived = false;
  }

  if (
    filters.sessionType &&
    typeof filters.sessionType === 'string' &&
    (VALID_SESSION_TYPES as readonly string[]).includes(filters.sessionType)
  ) {
    where.sessionType = filters.sessionType;
  }

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.chatSession.count({ where }),
  ]);

  return { sessions, total };
}

/**
 * Update a chat session. Throws ApiError(404) if not found.
 */
export async function updateSession(sessionId: string, input: UpdateSessionInput) {
  const existing = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!existing) {
    throw new ApiError(404, 'Chat session not found');
  }

  const updateData: Record<string, unknown> = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.is_archived !== undefined) updateData.isArchived = input.is_archived;
  if (input.context !== undefined) updateData.context = input.context;

  return prisma.chatSession.update({
    where: { id: sessionId },
    data: updateData,
  });
}

/**
 * Delete a chat session and return deletion info.
 * Throws ApiError(404) if not found.
 */
export async function deleteSession(sessionId: string): Promise<DeleteSessionResult> {
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

  await prisma.chatSession.delete({
    where: { id: sessionId },
  });

  return { sessionId, deletedMessages: messageCount };
}

/**
 * Search chat messages by content, grouped by session.
 * Throws ApiError(400) if query is empty.
 */
export async function searchChats(query: string, limit: number): Promise<SearchResult> {
  if (!query || query.trim().length === 0) {
    throw new ApiError(400, 'Query parameter "q" is required and cannot be empty');
  }

  const trimmedQuery = query.trim();

  const messages = await prisma.chatMessage.findMany({
    where: {
      content: {
        contains: trimmedQuery,
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
  const sessionMap = new Map<string, SearchSessionResult>();

  for (const msg of messages) {
    if (!sessionMap.has(msg.session.id)) {
      sessionMap.set(msg.session.id, {
        session_id: msg.session.id,
        session_title: msg.session.title,
        session_type: msg.session.sessionType,
        matches: [],
        match_count: 0,
      });
    }

    const sessionData = sessionMap.get(msg.session.id)!;
    sessionData.matches.push({
      message_id: msg.id,
      role: msg.role,
      snippet: truncateSnippet(msg.content),
      created_at: msg.createdAt.toISOString(),
    });
    sessionData.match_count++;
  }

  const results = Array.from(sessionMap.values());

  return {
    query: trimmedQuery,
    total_matches: messages.length,
    sessions_matched: results.length,
    results,
  };
}

/**
 * Get chat statistics.
 */
export async function getStats(): Promise<ChatStats> {
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
  for (const item of sessionsByType) {
    typeBreakdown[item.sessionType] = item._count;
  }

  return {
    total_sessions: totalSessions,
    active_sessions: activeSessions,
    archived_sessions: archivedSessions,
    total_messages: totalMessages,
    average_messages_per_session:
      totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
    sessions_by_type: typeBreakdown,
  };
}
