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
        className="bg-purple-medium/50 backdrop-blur-xl border-0 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl shadow-red-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
        <div className="p-6">
          {/* Warning icon */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-red-500/20">
              <ShieldExclamationIcon className="h-8 w-8 text-red-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white text-center mb-2">Delete Chat?</h2>

          {/* Message */}
          <p className="text-sm text-purple-gray text-center">
            Are you sure you want to delete <span className="font-semibold text-white">"{sessionTitle}"</span>?
            <br />
            <span className="text-red-400 mt-2 inline-block">This action cannot be undone.</span>
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-black/20 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-500/20 text-purple-gray font-semibold rounded-lg transition-all transform hover:scale-105 hover:bg-gray-500/30"
          >
            Cancel
          </button>
          <button
            ref={deleteButtonRef}
            onClick={onConfirm}
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
