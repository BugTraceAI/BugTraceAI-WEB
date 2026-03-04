// components/WebSecAgent.tsx
// version 0.4.0 - Fixed session isolation & duplicate messages
/* eslint-disable max-lines -- WebSec agent chat component.
 * Interactive security agent with session management and WebSocket streaming.
 * Manages chat history, message streaming, session persistence, and routing.
 * Complex state orchestration for real-time agent interaction - splitting would break chat coherence.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatMessage as LegacyChatMessage, AgentType } from '../types.ts';
import { useChatOperations } from '../hooks/useChatOperations';
import { MenuIcon, AiBrainIcon, TerminalIcon, ScanIcon, BugTraceAILogo } from './Icons.tsx';
import { ChatBubble } from './ChatBubble.tsx';
import { ChatLayout } from './ChatLayout.tsx';
import { ChatSidebar } from './chat/ChatSidebar';
import { abortCurrentRequest } from '../utils/apiManager.ts';
import { useSettings } from '../contexts/SettingsProvider.tsx';

interface WebSecAgentProps {
  messages: LegacyChatMessage[];
  onSendMessage: (message: string) => void;
  onResetMessages: () => void;
  isLoading: boolean;
  activeAgent: AgentType;
  setActiveAgent: (agent: AgentType) => void;
  onSyncHistory: (dbMessages: Array<{ role: string; content: string }>) => void;
}

export const WebSecAgent: React.FC<WebSecAgentProps> = ({
  messages: legacyMessages,
  onSendMessage,
  onResetMessages,
  isLoading,
  activeAgent,
  setActiveAgent,
  onSyncHistory,
}) => {
  const [userInput, setUserInput] = useState('');
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { openRouterModel } = useSettings();

  // Track which session we've already loaded/synced to prevent re-entrancy
  const activeSessionRef = useRef<string | null>(null);
  // Track which session the streaming messages belong to
  const streamingSessionRef = useRef<string | null>(null);

  // Get ChatContext operations for persistence
  const {
    messages: persistedMessages,
    currentSession,
    loadingMessages,
    createSession,
    loadSession,
    sendMessage: persistMessage,
  } = useChatOperations();

  // ── SESSION LOADING ────────────────────────────────────────────────────────
  // React to URL changes: load the session whose ID is in the URL.
  // This is the SINGLE entry point for all session switching.
  useEffect(() => {
    const loadSessionFromUrl = async () => {
      if (!sessionId) {
        // No session in URL -> Stay in initial state, don't auto-create
        activeSessionRef.current = null;
        return;
      }

      // If we already loaded this session, skip
      if (activeSessionRef.current === sessionId && currentSession?.id === sessionId) {
        return;
      }

      // New session ID in URL → flush old state and load
      activeSessionRef.current = sessionId;
      streamingSessionRef.current = null;  // invalidate any in-flight streaming
      onResetMessages();                    // clear legacy/streaming messages

      try {
        await loadSession(sessionId);
      } catch (err) {
        console.error('Failed to load session:', err);
        // Session doesn't exist → create new
        try {
          const s = await createSession('websec', 'WebSec Agent Chat');
          activeSessionRef.current = s.id;
          navigate(`/chat/${s.id}`, { replace: true });
        } catch (e) {
          console.error('Failed to create fallback session:', e);
        }
      }
    };

    loadSessionFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── SYNC HISTORY TO AI AGENT ───────────────────────────────────────────────
  // Once the DB messages finish loading for the current session,
  // inject them into useWebSecAgent so the AI has the conversation context.
  const syncedForSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      currentSession &&
      currentSession.id === sessionId &&
      !loadingMessages &&
      syncedForSessionRef.current !== currentSession.id
    ) {
      syncedForSessionRef.current = currentSession.id;
      streamingSessionRef.current = currentSession.id;
      onSyncHistory(persistedMessages);
    }
  }, [currentSession, sessionId, loadingMessages, persistedMessages, onSyncHistory]);

  // ── PERSIST AI RESPONSES ───────────────────────────────────────────────────
  // When the AI finishes a response (a 'model' message appears in legacyMessages
  // that isn't loading), persist it to the DB if it belongs to the current session.
  useEffect(() => {
    if (!currentSession || legacyMessages.length === 0) return;
    // Only persist if streaming belongs to THIS session
    if (streamingSessionRef.current !== currentSession.id) return;

    const last = legacyMessages[legacyMessages.length - 1];
    if (last.role !== 'model' || last.isLoading) return;

    // Check not already persisted (by content match)
    const alreadyPersisted = persistedMessages.some(
      (pm) => pm.content === last.content && pm.role === 'assistant'
    );
    if (alreadyPersisted) return;

    persistMessage(last.content, 'assistant').catch((err) =>
      console.error('Failed to persist assistant message:', err)
    );
  }, [legacyMessages, currentSession, persistMessage, persistedMessages]);

  // ── TEXTAREA AUTO-RESIZE ───────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userInput]);

  // ── SEND MESSAGE ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || isLoading || !currentSession) return;

    const messageContent = userInput;
    setUserInput('');

    // Mark streaming as belonging to this session
    streamingSessionRef.current = currentSession.id;

    try {
      // 1. Persist to DB
      await persistMessage(messageContent, 'user');
      // 2. Send to AI agent (useWebSecAgent will add user msg + trigger response)
      onSendMessage(messageContent);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Still try to send to AI
      onSendMessage(messageContent);
    }
  }, [userInput, isLoading, currentSession, persistMessage, onSendMessage]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── DISPLAY MESSAGES ───────────────────────────────────────────────────────
  // Combine persisted (DB) messages with live streaming messages.
  // DB messages are the source of truth for history.
  // Legacy (streaming) messages may contain a NEW assistant response not yet in DB.
  const displayMessages = useMemo(() => {
    // If we're still loading or session not ready, show nothing
    if (loadingMessages || !currentSession) return [];

    // Start from persisted messages (DB = source of truth)
    const dbMsgs = persistedMessages.map((pm) => ({
      id: pm.id,
      role: pm.role as 'user' | 'assistant' | 'error',
      content: pm.content,
      created_at: pm.created_at,
    }));

    // Check if there's a live streaming response not yet persisted
    if (
      legacyMessages.length > 0 &&
      streamingSessionRef.current === currentSession.id
    ) {
      const lastLegacy = legacyMessages[legacyMessages.length - 1];
      if (lastLegacy.role === 'model') {
        // Check if this response is already in DB
        const alreadyInDb = persistedMessages.some(
          (pm) => pm.role === 'assistant' && pm.content === lastLegacy.content
        );
        if (!alreadyInDb) {
          // Append the live streaming response
          dbMsgs.push({
            id: 'streaming-response',
            role: 'assistant',
            content: lastLegacy.content,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    return dbMsgs;
  }, [persistedMessages, legacyMessages, currentSession, loadingMessages]);

  // ── RENDER ─────────────────────────────────────────────────────────────────
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
      <form onSubmit={handleFormSubmit} className={`relative flex flex-col w-full bg-white/[0.03] backdrop-blur-md rounded-[26px] shadow-lg border transition-all duration-300 ${
        activeAgent === 'kali' ? 'border-cyan-500/50 focus-within:border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.15)]' :
        activeAgent === 'recon' ? 'border-purple-500/50 focus-within:border-purple-400/80 shadow-[0_0_15px_rgba(168,85,247,0.15)]' :
        activeAgent === 'bugtrace' ? 'border-emerald-500/50 focus-within:border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]' :
        'border-white/[0.05] focus-within:border-coral/30'
      }`}>
        
        <textarea
          ref={textareaRef}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${
            activeAgent === 'kali' ? 'Kali Expert' :
            activeAgent === 'recon' ? 'ReconFTW' :
            activeAgent === 'bugtrace' ? 'BugTrace Scanner' :
            'WebSecAgent'
          }...`}
          disabled={isLoading}
          data-testid="chat-input"
          className="w-full bg-transparent border-none text-white placeholder-text-tertiary focus:ring-0 focus:outline-none resize-none overflow-y-hidden py-3 px-5 mt-1"
          rows={1}
          style={{ maxHeight: '200px', minHeight: '44px' }}
        />

        <div className="flex justify-between items-center w-full px-3 pb-3">
          {/* Tools Area (Left) */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-thicker ${
              activeAgent === 'kali' ? 'text-cyan-400' :
              activeAgent === 'recon' ? 'text-purple-400' :
              activeAgent === 'bugtrace' ? 'text-emerald-400' :
              'text-ui-text-dim/40'
            }`}>
              {activeAgent === 'kali' ? 'KALI MODE' :
               activeAgent === 'recon' ? 'RECON MODE' :
               activeAgent === 'bugtrace' ? 'BUGTRACE MODE' :
               'STANDARD'}
            </span>
          </div>

          {/* Action Area (Right) */}
          <div className="flex items-center gap-2">
            {/* Tool Selection Menu (3 dots) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
                  isToolsMenuOpen ? 'bg-white/10 text-white' : 'text-ui-text-dim hover:text-white hover:bg-white/5'
                }`}
                title="Select Security Agent"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {/* Tools Menu Popover */}
              {isToolsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsToolsMenuOpen(false)}></div>
                  <div className="absolute bottom-full right-0 mb-3 w-56 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 z-50 overflow-hidden transform origin-bottom-right animate-in fade-in zoom-in-95 duration-200">
                    <div className="text-[10px] text-ui-text-dim px-3 pb-2 pt-1 font-bold uppercase tracking-widest opacity-60">Security Agents</div>
                    
                    {/* WebSec Agent (Default) */}
                    <button
                      type="button"
                      onClick={() => { setActiveAgent('web'); setIsToolsMenuOpen(false); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${activeAgent === 'web' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <AiBrainIcon className={`w-4 h-4 ${activeAgent === 'web' ? 'text-ui-accent' : 'text-ui-text-dim group-hover:text-white'}`} />
                        <span className={`${activeAgent === 'web' ? 'text-white font-medium' : 'text-ui-text-dim group-hover:text-white'}`}>Standard WebSec</span>
                      </div>
                      {activeAgent === 'web' && <div className="w-1.5 h-1.5 rounded-full bg-ui-accent shadow-[0_0_8px_rgba(255,127,80,0.6)]"></div>}
                    </button>

                    {/* Kali Agent */}
                    <button
                      type="button"
                      onClick={() => { setActiveAgent('kali'); setIsToolsMenuOpen(false); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${activeAgent === 'kali' ? 'bg-cyan-500/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <TerminalIcon className={`w-4 h-4 ${activeAgent === 'kali' ? 'text-cyan-400' : 'text-ui-text-dim group-hover:text-white'}`} />
                        <span className={`${activeAgent === 'kali' ? 'text-cyan-400 font-medium' : 'text-ui-text-dim group-hover:text-white'}`}>Kali Expert Mode</span>
                      </div>
                      {activeAgent === 'kali' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>}
                    </button>

                    {/* ReconFTW Agent */}
                    <button
                      type="button"
                      onClick={() => { setActiveAgent('recon'); setIsToolsMenuOpen(false); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${activeAgent === 'recon' ? 'bg-purple-500/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <ScanIcon className={`w-4 h-4 ${activeAgent === 'recon' ? 'text-purple-400' : 'text-ui-text-dim group-hover:text-white'}`} />
                        <span className={`${activeAgent === 'recon' ? 'text-purple-400 font-medium' : 'text-ui-text-dim group-hover:text-white'}`}>ReconFTW Automation</span>
                      </div>
                      {activeAgent === 'recon' && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>}
                    </button>

                    {/* BugTraceAI-CLI Agent */}
                    <button
                      type="button"
                      onClick={() => { setActiveAgent('bugtrace'); setIsToolsMenuOpen(false); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${activeAgent === 'bugtrace' ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <BugTraceAILogo className={`w-4 h-4 ${activeAgent === 'bugtrace' ? 'text-emerald-400' : 'text-ui-text-dim group-hover:text-white'}`} />
                        <span className={`${activeAgent === 'bugtrace' ? 'text-emerald-400 font-medium' : 'text-ui-text-dim group-hover:text-white'}`}>BugTrace Scanner</span>
                      </div>
                      {activeAgent === 'bugtrace' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>}
                    </button>
                  </div>
                </>
              )}
            </div>

            {isLoading ? (
              <button
                type="button"
                onClick={abortCurrentRequest}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all border border-red-500/20"
                aria-label="Stop generating"
              >
                <div className="w-3 h-3 bg-current rounded-sm animate-pulse"></div>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!userInput.trim()}
                data-testid="send-button"
                className={`group flex-shrink-0 w-9 h-9 rounded-full text-ui-bg flex items-center justify-center disabled:bg-white/5 disabled:text-ui-text-dim/30 transition-all disabled:shadow-none ${
                   activeAgent === 'kali' ? 'bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]' :
                   activeAgent === 'recon' ? 'bg-purple-500 hover:bg-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' :
                   activeAgent === 'bugtrace' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                   'bg-ui-accent hover:bg-ui-accent-hover shadow-glow-coral'
                }`}
                aria-label="Send message"
              >
                <svg className="h-4 w-4 transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </button>
            )}
          </div>
        </div>
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
          ) : displayMessages.length === 0 && !isLoading ? (
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
              {isLoading && (
                <ChatBubble
                  message={{
                    id: 'loading',
                    role: 'assistant',
                    content: '',
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