// components/chat/ChatSidebar.tsx
// Clean sidebar - ChatGPT-inspired minimal design
import React, { useState, useEffect, useRef } from 'react';
import { useChatOperations } from '../../hooks/useChatOperations';
import { SessionCard } from './SessionCard';
import { NewChatModal } from './NewChatModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ChatSearchBar } from './ChatSearchBar';
import { ChatSession } from '../../contexts/ChatContext';
import { XMarkIcon } from '../Icons.tsx';
import { Spinner } from '../Spinner.tsx';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onToggle }) => {
  const {
    sessions,
    currentSession,
    loadingSessions,
    loadSessions,
    startNewChat,
    resumeChat,
    archiveSession,
    deleteSession,
    renameSession,
  } = useChatOperations();

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);
  const loadedRef = useRef(false);

  // Load sessions on mount and when showArchived changes
  useEffect(() => {
    loadSessions(showArchived);
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  // Filter sessions based on archived state and ensure uniqueness
  const filteredSessions = React.useMemo(() => {
    const filtered = sessions.filter((s) =>
      showArchived ? s.is_archived : !s.is_archived
    );

    // Remove any potential duplicates by ID
    const uniqueMap = new Map(filtered.map((s) => [s.id, s]));
    return Array.from(uniqueMap.values());
  }, [sessions, showArchived]);

  const handleNewChat = async (type: 'websec' | 'xss' | 'sql') => {
    try {
      await startNewChat(type);
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await deleteSession(deleteTarget.id);
        setDeleteTarget(null);
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  };

  const handleArchive = async (sessionId: string) => {
    try {
      await archiveSession(sessionId);
    } catch (error) {
      console.error('Failed to archive session:', error);
    }
  };

  const handleRename = async (sessionId: string, newTitle: string) => {
    try {
      await renameSession(sessionId, newTitle);
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const handleSearchResultSelect = async (sessionId: string) => {
    try {
      await resumeChat(sessionId);
    } catch (error) {
      console.error('Failed to load search result:', error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Sidebar */}
      <div className="w-64 bg-white/[0.03] flex flex-col h-full border-r border-white/[0.06]">
        {/* Header */}
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center gap-2 mb-4 px-1">
            <button
              onClick={() => setShowNewChatModal(true)}
              data-testid="new-chat-button"
              className="group flex items-center justify-center gap-2.5 px-4 h-10 rounded-xl bg-ui-accent/10 border border-ui-accent/20 text-ui-text-main hover:bg-ui-accent/20 transition-all flex-1 shadow-lg shadow-ui-accent/5"
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-ui-accent text-ui-bg group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(255,127,80,0.4)]">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="label-mini !text-[11px] !text-ui-text-main font-bold tracking-tight">New Mission</span>
            </button>
            <button
              onClick={onToggle}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-ui-text-dim hover:text-ui-accent hover:bg-ui-accent/10 transition-all border border-transparent hover:border-ui-accent/20 flex-shrink-0"
              title="Close sidebar"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 mb-4">
            <ChatSearchBar onResultSelect={handleSearchResultSelect} />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <span className="label-mini !text-[10px]">
                {showArchived ? 'NO ARCHIVED CHATS' : 'NO CHATS YET'}
              </span>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={currentSession?.id === session.id}
                onSelect={() => resumeChat(session.id)}
                onArchive={() => handleArchive(session.id)}
                onDelete={() => setDeleteTarget(session)}
                onRename={(newTitle) => handleRename(session.id, newTitle)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-ui-border bg-dashboard-bg/40">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all ${showArchived ? 'bg-ui-accent border-ui-accent shadow-[0_0_8px_rgba(255,127,80,0.4)]' : 'bg-ui-bg border-ui-border'
              }`}>
              {showArchived && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              data-testid="show-archived-toggle"
            />
            <span className="label-mini !text-[10px] text-ui-text-dim group-hover:text-ui-text-main transition-colors">Show Archived</span>
          </label>
        </div>
      </div>

      {/* Modals */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onSelect={handleNewChat}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        sessionTitle={deleteTarget?.title || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
