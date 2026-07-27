// components/ErrorToast.tsx
import React, { useEffect } from 'react';
import { useChatContext } from '../contexts/ChatContext';

/**
 * ErrorToast component
 * Displays chat API errors in a toast notification
 * Auto-dismisses after 5 seconds, manual dismiss with X button
 */
export const ErrorToast: React.FC = () => {
  const { error, clearError } = useChatContext();

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
      <div className="bg-red-500/90 backdrop-blur-lg text-white px-6 py-4 rounded-lg shadow-xl border border-red-400/50">
        <div className="flex items-start gap-3">
          {/* Error icon */}
          <svg
            className="w-6 h-6 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>

          {/* Error message */}
          <div className="flex-1">
            <h3 className="font-semibold">Error</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>

          {/* Close button */}
          <button
            onClick={clearError}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
