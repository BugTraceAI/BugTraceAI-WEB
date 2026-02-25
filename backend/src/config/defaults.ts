/**
 * config/defaults.ts
 *
 * Centralized configuration constants extracted from controllers, middleware,
 * and index.ts. Single source of truth for all hardcoded values.
 */

// ============================================================================
// Default Application Settings
// ============================================================================

export interface DefaultSetting {
  key: string;
  value: Record<string, unknown>;
}

export const DEFAULT_SETTINGS: DefaultSetting[] = [
  { key: 'openrouter_api_key', value: { encrypted_value: '' } },
  { key: 'openrouter_model', value: { value: 'google/gemini-3-flash-preview' } },
  { key: 'theme', value: { value: 'dark' } },
  { key: 'default_analysis_type', value: { value: 'url_analysis' } },
  { key: 'auto_save_chats', value: { value: true } },
  { key: 'show_archived_chats', value: { value: false } },
  { key: 'max_chat_history', value: { value: 100 } },
  { key: 'enable_cli_integration', value: { value: true } },
  { key: 'cli_reports_directory', value: { value: './reports' } },
];

// ============================================================================
// Rate Limit Configuration
// ============================================================================

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const RATE_LIMITS = {
  api: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 500,
    message: 'Too many requests from this IP, please try again later',
  },
  create: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 50,
    message: 'Too many creation requests from this IP, please try again later',
  },
  message: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 120,
    message: 'Too many messages from this IP, please try again later',
  },
  auth: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 5,
    message: 'Too many authentication attempts from this IP, please try again later',
  },
} as const;

// ============================================================================
// CORS Configuration
// ============================================================================

export function getCorsOrigin(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

export const CORS_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] as const;

// ============================================================================
// Danger Zone
// ============================================================================

export const DANGER_ZONE_CONFIRMATION = 'Delete All';

// ============================================================================
// Pagination Defaults
// ============================================================================

export const PAGINATION = {
  defaultLimit: 50,
  maxLimit: 100,
  messageDefaultLimit: 1000,
  messageMaxLimit: 1000,
  searchDefaultLimit: 20,
  searchMaxLimit: 100,
  recentReportsLimit: 10,
} as const;

// ============================================================================
// Valid Enum Values
// ============================================================================

export const VALID_SESSION_TYPES = ['websec', 'xss', 'sql'] as const;

export const VALID_ANALYSIS_TYPES = [
  'url_analysis',
  'code_analysis',
  'jwt_analysis',
  'security_headers',
  'file_upload',
  'privesc',
] as const;

export const VALID_EXPORT_FORMATS = ['json', 'csv', 'pdf'] as const;

export type ExportFormat = (typeof VALID_EXPORT_FORMATS)[number];
