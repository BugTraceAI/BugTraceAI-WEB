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
        group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 relative
        ${isActive
          ? 'bg-coral/10 text-coral border border-coral/10'
          : 'text-purple-gray hover:bg-white/5 hover:text-off-white border border-transparent'
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Chat icon - simple text style */}
      <span className={`flex-shrink-0 opacity-80 ${isActive ? 'text-coral' : 'text-current'}`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.08.386c-.453 1.325-1.742 2.186-3.134 2.186-1.571 0-2.912-1.11-3.18-2.646l-.506-4.57c-.122-1.096.732-2.092 1.838-2.092h8.046c.866 0 1.637.5 1.996 1.238.118-.178.258-.344.417-.492l-4.507-4.507A48.243 48.243 0 013 7.5c0-1.602 1.123-2.995 2.707-3.228A48.394 48.394 0 0112 3c1.249 0 2.486.07 3.7.206 1.603.178 2.822 1.527 2.822 3.177v1.128z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5h6" />
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
            className="w-full bg-transparent text-sm text-off-white focus:outline-none -ml-1 pl-1"
          />
        ) : (
          <>
            <span
              className="text-[13px] truncate block pr-8"
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleDoubleClick();
              }}
              title={session.title}
            >
              {session.title}
            </span>
            {/* Gradient fade for long titles */}
            <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l pointer-events-none ${isActive ? 'from-purple-medium to-transparent' : 'from-purple-deep to-transparent bg-opacity-0 group-hover:from-white/10'}`}></div>
          </>
        )}
      </div>

      {/* 3-dot menu button - shows on hover */}
      {(showActions || showMenu) && !isEditing && (
        <div ref={menuRef} className="absolute right-2 flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            data-testid="menu-button"
            className="p-1 rounded text-muted hover:text-white hover:bg-white/10 transition-colors"
            title="Options"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-purple-medium border border-0 rounded-lg shadow-lg py-1 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setIsEditing(true);
                  setEditTitle(session.title);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-purple-gray hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onArchive();
                }}
                data-testid="archive-button"
                className="w-full px-3 py-1.5 text-left text-sm text-purple-gray hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                Archive
              </button>
              <div className="border-t border-white/5 my-1"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                data-testid="delete-button"
                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
