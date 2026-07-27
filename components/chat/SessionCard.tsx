// components/chat/SessionCard.tsx
// Clean session item - ChatGPT-inspired minimal list style with 3-dot menu
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession } from '../../contexts/ChatContext';
import { TrashIcon } from '../Icons.tsx';

interface SessionCardProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  isActive,
  onSelect,
  onArchive,
  onDelete,
  onRename,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditTitle(session.title);
  };

  const handleRenameBlur = () => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameBlur();
    } else if (e.key === 'Escape') {
      setEditTitle(session.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      data-testid="session-card"
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300 relative border
        ${isActive
          ? 'bg-ui-accent/10 text-ui-text-main border-ui-accent/40 shadow-lg shadow-ui-accent/5'
          : 'text-ui-text-dim border-transparent hover:bg-ui-input-bg/60 hover:text-ui-text-main hover:border-ui-accent/20'
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Indicator for active session */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-ui-accent rounded-r-full shadow-[0_0_8px_rgba(255,127,80,0.8)]" />
      )}

      {/* Chat icon - industrial style */}
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-ui-accent' : 'text-ui-text-dim/60 group-hover:text-ui-accent/60'}`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0 overflow-hidden relative">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRenameBlur}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full bg-transparent text-[13px] font-bold text-ui-text-main focus:outline-none -ml-1 pl-1"
          />
        ) : (
          <span
            className="text-[13px] font-bold truncate block pr-6"
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleDoubleClick();
            }}
            title={session.title}
          >
            {session.title}
          </span>
        )}
      </div>

      {/* 3-dot menu button - shows on hover or if active */}
      {(showActions || showMenu || isActive) && !isEditing && (
        <div ref={menuRef} className="absolute right-2 flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            data-testid="menu-button"
            className="p-1 rounded-lg text-ui-text-dim hover:text-ui-text-main hover:bg-ui-accent/10 transition-all"
            title="Options"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-40 bg-ui-bg/95 backdrop-blur-xl border border-ui-border rounded-xl shadow-2xl py-1.5 z-[60] animate-fade-in">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setIsEditing(true);
                  setEditTitle(session.title);
                }}
                className="w-full px-3 py-2 text-left text-xs font-bold text-ui-text-dim hover:bg-ui-accent/10 hover:text-ui-text-main flex items-center gap-3 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                RENAME
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onArchive();
                }}
                data-testid="archive-button"
                className="w-full px-3 py-2 text-left text-xs font-bold text-ui-text-dim hover:bg-ui-accent/10 hover:text-ui-text-main flex items-center gap-3 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                ARCHIVE
              </button>
              <div className="border-t border-ui-border my-1.5"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                data-testid="delete-button"
                className="w-full px-3 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                DELETE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
