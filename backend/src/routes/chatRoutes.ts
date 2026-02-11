import { Router } from 'express';
import * as chatController from '../controllers/chatController.js';
import * as messageController from '../controllers/messageController.js';
import { validate, validateUuid } from '../middleware/validator.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import {
  createChatSessionSchema,
  updateChatSessionSchema,
  createMessageSchema,
  createBulkMessagesSchema,
} from '../utils/validation.js';

const router = Router();

// ============================================================================
// CHAT SESSION ROUTES
// ============================================================================

/**
 * POST /api/chats
 * Create a new chat session
 */
router.post('/', createLimiter, validate(createChatSessionSchema), chatController.createChatSession);

/**
 * GET /api/chats
 * List all chat sessions
 * Query params: include_archived, limit, offset, session_type
 */
router.get('/', chatController.listChatSessions);

/**
 * GET /api/chats/search
 * Search chat messages by content
 * Query params: q (required), limit
 * IMPORTANT: Must come before /:sessionId route
 */
router.get('/search', chatController.searchChats);

/**
 * GET /api/chats/stats
 * Get chat statistics
 * IMPORTANT: Must come before /:sessionId route
 */
router.get('/stats', chatController.getChatStats);

/**
 * GET /api/chats/:sessionId
 * Get a specific chat session
 */
router.get('/:sessionId', validateUuid('sessionId'), chatController.getChatSession);

/**
 * PATCH /api/chats/:sessionId
 * Update a chat session
 */
router.patch(
  '/:sessionId',
  validateUuid('sessionId'),
  validate(updateChatSessionSchema),
  chatController.updateChatSession
);

/**
 * DELETE /api/chats/:sessionId
 * Delete a chat session
 */
router.delete('/:sessionId', validateUuid('sessionId'), chatController.deleteChatSession);

// ============================================================================
// MESSAGE ROUTES
// ============================================================================

/**
 * GET /api/chats/:sessionId/messages
 * Get all messages for a chat session
 * Query params: limit, offset
 */
router.get('/:sessionId/messages', validateUuid('sessionId'), messageController.listMessages);

/**
 * POST /api/chats/:sessionId/messages
 * Create a new message in a chat session
 */
router.post(
  '/:sessionId/messages',
  validateUuid('sessionId'),
  createLimiter,
  validate(createMessageSchema),
  messageController.createMessage
);

/**
 * POST /api/chats/:sessionId/messages/bulk
 * Create multiple messages at once
 * IMPORTANT: Must come before /:messageId route
 */
router.post(
  '/:sessionId/messages/bulk',
  validateUuid('sessionId'),
  createLimiter,
  validate(createBulkMessagesSchema),
  messageController.createBulkMessages
);

/**
 * DELETE /api/chats/:sessionId/messages/:messageId
 * Delete a specific message
 */
router.delete(
  '/:sessionId/messages/:messageId',
  validateUuid('sessionId'),
  validateUuid('messageId'),
  messageController.deleteMessage
);

export default router;
