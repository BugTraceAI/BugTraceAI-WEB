// components/WebSecAgent.tsx
// version 0.3.0 - Added URL-based session routing
/* eslint-disable max-lines -- WebSec agent chat component (263 lines).
 * Interactive security agent with session management and WebSocket streaming.
 * Manages chat history, message streaming, session persistence, and routing.
 * Complex state orchestration for real-time agent interaction - splitting would break chat coherence.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatMessage as LegacyChatMessage } from '../types.ts';
import { useChatOperations } from '../hooks/useChatOperations';
import { PaperAirplaneIcon, MenuIcon, AiBrainIcon } from './Icons.tsx';
import { ChatBubble } from './ChatBubble.tsx';
import { ChatLayout } from './ChatLayout.tsx';
import { ChatSidebar } from './chat/ChatSidebar';
import { abortCurrentRequest } from '../utils/apiManager.ts';
import { useSettings } from '../contexts/SettingsProvider.tsx';

interface WebSecAgentProps {
  messages: LegacyChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export const WebSecAgent: React.FC<WebSecAgentProps> = ({
  messages: legacyMessages,
  onSendMessage,
  isLoading
}) => {
  const [userInput, setUserInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { openRouterModel } = useSettings();

  // Get ChatContext operations for persistence
  const {
    messages: persistedMessages,
    currentSession,
    loadingMessages,
    createSession,
    loadSession,
    sendMessage: persistMessage,
  } = useChatOperations();

  // Load session from URL if sessionId is present
  useEffect(() => {
    const initSession = async () => {
      // Prevent multiple simultaneous initializations for the SAME session
      if (initializingRef.current) return;

      if (sessionId && sessionId !== currentSession?.id) {
        // Load existing session from URL (either initial load or user clicked different session)
        initializingRef.current = true;
        try {
          await loadSession(sessionId);
          initializedRef.current = true;
        } catch (error) {
          console.error('Failed to load session from URL:', error);
          // If session doesn't exist, create a new one
          const newSession = await createSession('websec', 'WebSec Agent Chat');
          navigate(`/chat/${newSession.id}`, { replace: true });
          initializedRef.current = true;
        } finally {
          initializingRef.current = false;
        }
      } else if (!sessionId && !currentSession && !initializedRef.current) {
        // No sessionId in URL and no current session - create new one (only on first mount)
        initializingRef.current = true;
        try {
          const newSession = await createSession('websec', 'WebSec Agent Chat');
          navigate(`/chat/${newSession.id}`, { replace: true });
          initializedRef.current = true;
        } catch (error) {
          console.error('Failed to create session:', error);
        } finally {
          initializingRef.current = false;
        }
      }
    };
    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Sync URL when current session changes (e.g., when user switches sessions in sidebar)
  useEffect(() => {
    if (currentSession && sessionId !== currentSession.id && initializedRef.current && !initializingRef.current) {
      navigate(`/chat/${currentSession.id}`, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id, sessionId]);

  // Persist AI responses when legacyMessages change
  useEffect(() => {
    const persistAiResponse = async () => {
      if (!currentSession || legacyMessages.length === 0) return;

      const lastMessage = legacyMessages[legacyMessages.length - 1];
      // Check if this is a new AI response (role 'model')
      if (lastMessage.role === 'model' && !lastMessage.isLoading) {
        // Check if this message is already persisted
        const alreadyPersisted = persistedMessages.some(
          (pm) => pm.content === lastMessage.content && pm.role === 'assistant'
        );

        if (!alreadyPersisted) {
          try {
            await persistMessage(lastMessage.content, 'assistant');
          } catch (error) {
            console.error('Failed to persist assistant message:', error);
          }
        }
      }
    };

    persistAiResponse();
  }, [legacyMessages, currentSession, persistMessage, persistedMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [userInput]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isLoading || !currentSession) return;

    const messageContent = userInput;
    setUserInput('');

    try {
      // Persist user message to database
      await persistMessage(messageContent, 'user');

      // Send to AI (existing useWebSecAgent functionality)
      onSendMessage(messageContent);
    } catch (error) {
      console.error('Failed to persist user message:', error);
      // Still send to AI even if persistence fails
      onSendMessage(messageContent);
    }
  }, [userInput, isLoading, currentSession, persistMessage, onSendMessage]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.altKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Convert persisted messages to display format, or show welcome if empty
  const displayMessages = persistedMessages.length > 0
    ? persistedMessages
    : currentSession
      ? []
      : [];

  const headerContent = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`flex items-center justify-center w-9 h-9 rounded-xl bg-ui-input-bg border border-ui-border text-ui-text-dim hover:text-ui-text-main hover:border-ui-accent/30 transition-all ${sidebarOpen ? 'md:hidden' : ''}`}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <h1 className="title-standard !text-lg">WebSec Agent</h1>
        <span className="badge-mini badge-mini-accent !text-[9px] !py-0.5 !px-2 tracking-tighter opacity-80 backdrop-blur-sm shadow-[0_0_10px_rgba(255,127,80,0.1)]">
          {openRouterModel.split('/').pop() || openRouterModel}
        </span>
      </div>
    </div>
  );

  const footerContent = (
    <div className="relative w-full max-w-3xl mx-auto">
      <form onSubmit={handleFormSubmit} className="relative flex items-end w-full bg-white/[0.03] backdrop-blur-md rounded-[26px] pl-4 pr-2 py-2 shadow-lg border border-white/[0.05] focus-within:border-coral/30 transition-colors">
        <textarea
          ref={textareaRef}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message WebSec Agent..."
          disabled={isLoading}
          data-testid="chat-input"
          className="w-full bg-transparent border-none text-white placeholder-text-tertiary focus:ring-0 focus:outline-none resize-none overflow-y-hidden py-2"
          rows={1}
          style={{ maxHeight: '200px', minHeight: '44px' }}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={abortCurrentRequest}
            className="flex-shrink-0 w-8 h-8 mb-1 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all border border-red-500/20"
            aria-label="Stop generating"
          >
            <div className="w-2.5 h-2.5 bg-current rounded-sm animate-pulse"></div>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!userInput.trim()}
            data-testid="send-button"
            className="group flex-shrink-0 w-10 h-10 rounded-full bg-ui-accent text-ui-bg flex items-center justify-center hover:bg-ui-accent-hover disabled:bg-white/5 disabled:text-ui-text-dim/30 transition-all shadow-glow-coral disabled:shadow-none"
            aria-label="Send message"
          >
            <svg className="h-4 w-4 transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </button>
        )}
      </form>
      <div className="text-center mt-3">
        <p className="text-[10px] text-muted opacity-60">WebSec Agent can make mistakes. Verify important information.</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full relative overflow-hidden bg-transparent">
      <ChatSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col min-w-0 bg-transparent">
        <ChatLayout header={headerContent} footer={footerContent}>
          {loadingMessages && displayMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-coral/20 border-t-coral animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-coral animate-pulse"></div>
                </div>
              </div>
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-coral/20 to-purple-elevated/20 flex items-center justify-center mb-8 border border-0 shadow-[0_0_30px_-10px_rgba(6,182,212,0.3)]">
                <AiBrainIcon className="h-8 w-8 text-coral" />
              </div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70 mb-8">What can I help with?</h1>
            </div>
          ) : (
            <>
              {displayMessages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {isLoading && legacyMessages.length > 0 && legacyMessages[legacyMessages.length - 1].role === 'user' && (
                <ChatBubble
                  message={{
                    id: 'loading',
                    role: 'assistant',
                    content: '...',
                    created_at: new Date().toISOString(),
                  }}
                  isLoading={true}
                />
              )}
            </>
          )}
        </ChatLayout>
      </div>
    </div>
  );
};