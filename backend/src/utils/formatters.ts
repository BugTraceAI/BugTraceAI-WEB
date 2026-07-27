/**
 * formatters.ts
 *
 * Pure response formatting functions. No I/O, no side effects.
 * Transforms Prisma model objects into API response shapes.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/** Prisma ChatSession shape (with optional _count) */
interface ChatSessionRow {
  id: string;
  sessionType: string;
  title: string;
  context: unknown;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  _count?: { messages: number };
}

/** Prisma ChatMessage shape */
interface ChatMessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}

/** Prisma AnalysisReport shape (with optional session join) */
interface AnalysisReportRow {
  id: string;
  analysisType: string;
  target: string;
  vulnerabilities: unknown;
  metadata: unknown;
  sessionId: string | null;
  createdAt: Date;
  session?: {
    id: string;
    title: string;
    sessionType: string;
  } | null;
}

// ============================================================================
// Formatted Output Types
// ============================================================================

export interface FormattedSession {
  id: string;
  session_type: string;
  title: string;
  context: unknown;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  message_count?: number;
}

export interface FormattedSessionSummary {
  id: string;
  session_type: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  message_count: number;
}

export interface FormattedMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface FormattedMessageWithSession {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface FormattedReport {
  id: string;
  analysis_type: string;
  target: string;
  vulnerabilities: unknown;
  metadata: unknown;
  session_id: string | null;
  session: {
    id: string;
    title: string;
    session_type: string;
  } | null;
  created_at: string;
}

export interface FormattedReportSummary {
  id: string;
  analysis_type: string;
  target: string;
  vulnerabilities: unknown;
  metadata: unknown;
  created_at: string;
}

export interface FormattedRecentReport {
  id: string;
  analysis_type: string;
  target: string;
  created_at: string;
}

// ============================================================================
// Session Formatters
// ============================================================================

/**
 * Format a full chat session (for single-item responses).
 * Includes context field.
 */
export function formatSession(session: ChatSessionRow): FormattedSession {
  return {
    id: session.id,
    session_type: session.sessionType,
    title: session.title,
    context: session.context,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    is_archived: session.isArchived,
    ...(session._count !== undefined && { message_count: session._count.messages }),
  };
}

/**
 * Format a chat session for list responses.
 * Excludes context, always includes message_count.
 */
export function formatSessionSummary(
  session: ChatSessionRow & { _count: { messages: number } }
): FormattedSessionSummary {
  return {
    id: session.id,
    session_type: session.sessionType,
    title: session.title,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
    is_archived: session.isArchived,
    message_count: session._count.messages,
  };
}

// ============================================================================
// Message Formatters
// ============================================================================

/**
 * Format a chat message for list responses.
 */
export function formatMessage(msg: ChatMessageRow): FormattedMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    created_at: msg.createdAt.toISOString(),
  };
}

/**
 * Format a chat message including session_id (for create responses).
 */
export function formatMessageWithSession(msg: ChatMessageRow): FormattedMessageWithSession {
  return {
    id: msg.id,
    session_id: msg.sessionId,
    role: msg.role,
    content: msg.content,
    created_at: msg.createdAt.toISOString(),
  };
}

// ============================================================================
// Report Formatters
// ============================================================================

/**
 * Format a full analysis report (for single-item responses with session join).
 */
export function formatReport(report: AnalysisReportRow): FormattedReport {
  return {
    id: report.id,
    analysis_type: report.analysisType,
    target: report.target,
    vulnerabilities: report.vulnerabilities,
    metadata: report.metadata,
    session_id: report.sessionId,
    session: report.session
      ? {
          id: report.session.id,
          title: report.session.title,
          session_type: report.session.sessionType,
        }
      : null,
    created_at: report.createdAt.toISOString(),
  };
}

/**
 * Format a report for list responses (no session join).
 */
export function formatReportSummary(report: AnalysisReportRow): FormattedReportSummary {
  return {
    id: report.id,
    analysis_type: report.analysisType,
    target: report.target,
    vulnerabilities: report.vulnerabilities,
    metadata: report.metadata,
    created_at: report.createdAt.toISOString(),
  };
}

/**
 * Format a report for recent-reports lists (minimal fields).
 */
export function formatRecentReport(report: {
  id: string;
  analysisType: string;
  target: string;
  createdAt: Date;
}): FormattedRecentReport {
  return {
    id: report.id,
    analysis_type: report.analysisType,
    target: report.target,
    created_at: report.createdAt.toISOString(),
  };
}

// ============================================================================
// Utility Pure Functions
// ============================================================================

/**
 * Sanitize a string for use as a filename.
 * Replaces non-alphanumeric characters with underscores, truncates, lowercases.
 */
export function sanitizeFilename(name: string, maxLength: number = 50): string {
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, maxLength)
    .toLowerCase();
}

/**
 * Generate a default session title from session type.
 */
export function generateSessionTitle(sessionType: string): string {
  return `${sessionType.toUpperCase()} Chat - ${new Date().toLocaleDateString()}`;
}

/**
 * Build an export filename from report data.
 */
export function buildExportFilename(target: string, createdAt: Date): string {
  const sanitizedTarget = sanitizeFilename(target);
  const date = createdAt.toISOString().split('T')[0];
  return `bugtraceai-${sanitizedTarget}-${date}`;
}

/**
 * Truncate content and add ellipsis for search snippets.
 */
export function truncateSnippet(content: string, maxLength: number = 200): string {
  return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
}
