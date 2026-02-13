// components/chat/ConfirmDeleteModal.tsx
import React, { useEffect, useRef } from 'react';
import { ShieldExclamationIcon } from '../Icons.tsx';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  sessionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  sessionTitle,
  onConfirm,
  onCancel,
}) => {
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Focus delete button when modal opens
  useEffect(() => {
    if (isOpen && deleteButtonRef.current) {
      deleteButtonRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="card-premium w-full max-w-md overflow-hidden flex flex-col shadow-2xl shadow-red-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
        <div className="p-8 flex flex-col items-center">
          {/* Warning icon */}
          <div className="mb-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <ShieldExclamationIcon className="h-8 w-8 text-red-500" />
            </div>
          </div>

          {/* Title */}
          <h2 className="title-standard !text-xl text-center mb-2">Confirm Deletion</h2>

          {/* Message */}
          <p className="text-sm text-ui-text-dim text-center leading-relaxed">
            Are you sure you want to scrub the mission log <br />
            <span className="font-bold text-white">"{sessionTitle}"</span>?
          </p>

          <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10 w-full text-center">
            <span className="label-mini !text-[10px] text-red-400">Warning: This action is irreversible</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-black/20 flex justify-center gap-3 border-t border-white/5">
          <button
            onClick={onCancel}
            className="btn-mini btn-mini-secondary px-6"
          >
            Abort
          </button>
          <button
            ref={deleteButtonRef}
            onClick={onConfirm}
            className="btn-mini px-8 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          >
            CONFIRM DELETE
          </button>
        </div>
      </div>
    </div>
  );
};
