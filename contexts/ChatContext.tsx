// contexts/ChatContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatSession {
  id: string;
  session_type: 'websec' | 'xss' | 'sql';
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  created_at: string;
}

export interface SearchResult {
  session_id: string;
  session_title: string;
  session_type: string;
  match_count: number;
  matches: Array<{
    message_id: string;
    role: string;
    snippet: string;
    created_at: string;
  }>;
}

interface ChatContextType {
  // State
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  loadingSessions: boolean;
  loadingMessages: boolean;
  error: string | null;

  // Actions
  createSession: (type: 'websec' | 'xss' | 'sql', title?: string) => Promise<ChatSession>;
  loadSessions: (includeArchived?: boolean) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string, role: 'user' | 'assistant') => Promise<ChatMessage>;
  archiveSession: (sessionId: string) => Promise<void>;
  unarchiveSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  searchChats: (query: string) => Promise<SearchResult[]>;
  clearError: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================================================
// PROVIDER
// ============================================================================

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // CREATE SESSION
  // --------------------------------------------------------------------------
  const createSession = useCallback(async (
    type: 'websec' | 'xss' | 'sql',
    title?: string
  ): Promise<ChatSession> => {
    try {
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/chats`, {
        session_type: type,
        ...(title && { title }),
      });

      const newSession = response.data.data;

      // Avoid duplicates: only add if session doesn't already exist
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === newSession.id);
        return exists ? prev : [newSession, ...prev];
      });

      setCurrentSession(newSession);
      setMessages([]);

      return newSession;
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to create chat session';
      setError(message);
      throw new Error(message);
    }
  }, []);

  // --------------------------------------------------------------------------
  // LOAD SESSIONS
  // --------------------------------------------------------------------------
  const loadSessions = useCallback(async (includeArchived = false) => {
    try {
      setLoadingSessions(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/chats`, {
        params: { include_archived: includeArchived },
      });

      // Ensure unique sessions by ID
      const results = response.data.data.results;
      const uniqueSessions = Array.from(
        new Map(results.map((s: ChatSession) => [s.id, s])).values()
      );

      setSessions(uniqueSessions as ChatSession[]);
    } catch (err: any) {
      // Skip toast for network errors (backend not reachable yet) — transient on startup
      if (!err.response) return;
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to load chat sessions';
      setError(message);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // LOAD SESSION
  // --------------------------------------------------------------------------
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      setLoadingMessages(true);
      setError(null);
      // Clear messages immediately to prevent old session's messages leaking into new session
      setMessages([]);

      // Load session details
      const sessionResponse = await axios.get(`${API_BASE_URL}/chats/${sessionId}`);
      const sessionData = sessionResponse.data.data;
      setCurrentSession(sessionData);

      // Update sessions list if this session isn't already in it
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === sessionId);
        return exists ? prev : [sessionData, ...prev];
      });

      // Load messages
      const messagesResponse = await axios.get(`${API_BASE_URL}/chats/${sessionId}/messages`);
      setMessages(messagesResponse.data.data.results);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to load chat session';
      setError(message);
      throw err;
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------------------------------
  // Use ref to avoid stale closure on currentSession in async callbacks
  const currentSessionRef = React.useRef(currentSession);
  currentSessionRef.current = currentSession;

  const sendMessage = useCallback(async (
    content: string,
    role: 'user' | 'assistant'
  ): Promise<ChatMessage> => {
    const session = currentSessionRef.current;
    if (!session) {
      const errorMsg = 'No active chat session';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      setError(null);

      const response = await axios.post(
        `${API_BASE_URL}/chats/${session.id}/messages`,
        { role, content }
      );

      const newMessage = response.data.data;
      // Only append if the user hasn't switched sessions during the request
      if (currentSessionRef.current?.id === session.id) {
        setMessages((prev) => [...prev, newMessage]);
      }

      return newMessage;
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to send message';
      setError(message);
      throw new Error(message);
    }
  }, []);

  // --------------------------------------------------------------------------
  // ARCHIVE SESSION
  // --------------------------------------------------------------------------
  const archiveSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      await axios.patch(`${API_BASE_URL}/chats/${sessionId}`, {
        is_archived: true,
      });

      // Remove from sessions list (only showing non-archived by default)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // Clear current session if it was the archived one
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to archive session';
      setError(message);
    }
  }, [currentSession]);

  // --------------------------------------------------------------------------
  // UNARCHIVE SESSION
  // --------------------------------------------------------------------------
  const unarchiveSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const response = await axios.patch(`${API_BASE_URL}/chats/${sessionId}`, {
        is_archived: false,
      });

      const updatedSession = response.data.data;

      // Add back to sessions list
      setSessions((prev) => [updatedSession, ...prev]);

      // Update current session if it's the one being unarchived
      if (currentSession?.id === sessionId) {
        setCurrentSession(updatedSession);
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to unarchive session';
      setError(message);
    }
  }, [currentSession]);

  // --------------------------------------------------------------------------
  // DELETE SESSION
  // --------------------------------------------------------------------------
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      await axios.delete(`${API_BASE_URL}/chats/${sessionId}`);

      // Remove from sessions list
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // Clear current session if it was the deleted one
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to delete session';
      setError(message);
    }
  }, [currentSession]);

  // --------------------------------------------------------------------------
  // RENAME SESSION
  // --------------------------------------------------------------------------
  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      setError(null);
      await axios.patch(`${API_BASE_URL}/chats/${sessionId}`, {
        title: newTitle,
      });

      // Update in sessions list
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      );

      // Update current session if it's the one being renamed
      if (currentSession?.id === sessionId) {
        setCurrentSession((prev) => (prev ? { ...prev, title: newTitle } : null));
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to rename session';
      setError(message);
    }
  }, [currentSession]);

  // --------------------------------------------------------------------------
  // SEARCH CHATS
  // --------------------------------------------------------------------------
  const searchChats = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/chats/search`, {
        params: { q: query },
      });
      return response.data.data?.results || [];
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Search failed';
      setError(message);
      return [];
    }
  }, []);

  // --------------------------------------------------------------------------
  // CLEAR ERROR
  // --------------------------------------------------------------------------
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // --------------------------------------------------------------------------
  // LOAD SESSIONS ON MOUNT
  // --------------------------------------------------------------------------
  useEffect(() => {
    const initSessions = async () => {
      try {
        await loadSessions();
      } catch (error) {
        console.error('Failed to load sessions on mount:', error);
      }
    };
    initSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // CONTEXT VALUE
  // --------------------------------------------------------------------------
  const value: ChatContextType = {
    sessions,
    currentSession,
    messages,
    loadingSessions,
    loadingMessages,
    error,
    createSession,
    loadSessions,
    loadSession,
    sendMessage,
    archiveSession,
    unarchiveSession,
    deleteSession,
    renameSession,
    searchChats,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// ============================================================================
// HOOK
// ============================================================================

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
