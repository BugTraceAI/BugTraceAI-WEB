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
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowNewChatModal(true)}
              data-testid="new-chat-button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-purple-gray hover:text-white hover:bg-white/[0.06] transition-colors flex-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New chat
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
              title="Close sidebar"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Search bar */}
          <ChatSearchBar onResultSelect={handleSearchResultSelect} />
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p className="text-xs">
                {showArchived ? 'No archived chats' : 'No chats yet'}
              </p>
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
        <div className="flex-shrink-0 p-3 border-t border-white/[0.06]">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-purple-gray transition-colors">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              data-testid="show-archived-toggle"
              className="focus:ring-coral h-3.5 w-3.5 text-coral-active border-0 rounded bg-transparent cursor-pointer"
            />
            Show archived
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
