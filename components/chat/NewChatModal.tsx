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
        className="card-premium w-full max-w-md overflow-hidden shadow-2xl shadow-ui-accent/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-ui-border bg-ui-bg/50">
          <span className="label-mini text-ui-accent mb-1 block">New Mission Deployment</span>
          <h2 className="title-standard">Select Assistant Type</h2>
          <p className="text-xs text-ui-text-dim mt-1">Initialize a specialized security logic unit</p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3 bg-dashboard-bg/30">
          {assistantTypes.map(({ type, icon, label, description }) => (
            <button
              key={type}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
              data-testid={`assistant-${type}`}
              className="w-full text-left p-4 rounded-xl bg-ui-input-bg border border-ui-border hover:border-ui-accent/50 hover:bg-ui-accent/5 transition-all group relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-1 h-full bg-ui-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="flex-shrink-0 p-3 rounded-xl bg-dashboard-bg border border-ui-border group-hover:border-ui-accent/30 transition-colors">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-ui-text-main group-hover:text-ui-accent transition-colors uppercase tracking-tight">
                    {label}
                  </h3>
                  <p className="text-xs text-ui-text-dim mt-0.5">{description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-ui-bg/80 flex justify-end gap-3 border-t border-ui-border">
          <button
            onClick={onClose}
            className="btn-mini btn-mini-secondary px-8"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
};
