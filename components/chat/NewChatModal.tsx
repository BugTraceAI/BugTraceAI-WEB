// components/chat/NewChatModal.tsx
import React, { useEffect } from 'react';
import { ShieldCheckIcon, ShieldExclamationIcon, BeakerIcon } from '../Icons.tsx';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'websec' | 'xss' | 'sql') => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose, onSelect }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  const assistantTypes = [
    {
      type: 'websec' as const,
      icon: <ShieldCheckIcon className="h-8 w-8 text-coral" />,
      label: 'WebSec Agent',
      description: 'General security analysis',
    },
    {
      type: 'xss' as const,
      icon: <ShieldExclamationIcon className="h-8 w-8 text-orange-400" />,
      label: 'XSS Assistant',
      description: 'Cross-site scripting specialist',
    },
    {
      type: 'sql' as const,
      icon: <BeakerIcon className="h-8 w-8 text-purple-400" />,
      label: 'SQL Assistant',
      description: 'SQL injection expert',
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-purple-medium/50 backdrop-blur-xl border-0 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-coral/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-0">
          <h2 className="text-xl font-bold text-white">Select Assistant Type</h2>
          <p className="text-sm text-muted mt-1">Choose the type of security expert you need</p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          {assistantTypes.map(({ type, icon, label, description }) => (
            <button
              key={type}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
              data-testid={`assistant-${type}`}
              className="w-full text-left p-4 rounded-lg bg-purple-medium/50 border-0 hover:border-coral/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-coral transition-colors">
                    {label}
                  </h3>
                  <p className="text-sm text-muted mt-0.5">{description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-purple-gray hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
