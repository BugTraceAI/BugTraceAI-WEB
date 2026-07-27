// hooks/useChatOperations.ts
import { useCallback } from 'react';
import { useChatContext } from '../contexts/ChatContext';

/**
 * Custom hook that provides convenient chat operations
 * Wraps ChatContext methods with additional error handling and convenience
 */
export const useChatOperations = () => {
  const context = useChatContext();

  /**
   * Start a new chat session
   * @param type - Type of chat session (websec, xss, sql)
   * @returns Promise<ChatSession>
   */
  const startNewChat = useCallback(
    async (type: 'websec' | 'xss' | 'sql') => {
      try {
        const session = await context.createSession(type);
        return session;
      } catch (error) {
        console.error('Failed to start new chat:', error);
        throw error;
      }
    },
    [context]
  );

  /**
   * Resume an existing chat session
   * Loads session details and messages
   * @param sessionId - ID of session to resume
   */
  const resumeChat = useCallback(
    async (sessionId: string) => {
      try {
        await context.loadSession(sessionId);
      } catch (error) {
        console.error('Failed to resume chat:', error);
        throw error;
      }
    },
    [context]
  );

  /**
   * Send a chat message in the current session
   * @param content - Message content
   */
  const sendChatMessage = useCallback(
    async (content: string) => {
      try {
        await context.sendMessage(content, 'user');
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    [context]
  );

  // Re-export all context values and methods
  return {
    ...context,
    startNewChat,
    resumeChat,
    sendChatMessage,
  };
};
