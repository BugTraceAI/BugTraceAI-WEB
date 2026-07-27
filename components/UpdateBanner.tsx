import React from 'react';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { APP_VERSION } from '../constants';

export const UpdateBanner: React.FC = () => {
  const update = useUpdateCheck();

  if (!update) return null;

  return (
    <div className="w-full bg-cyan-600/90 backdrop-blur-sm text-white px-4 py-2 text-sm flex items-center justify-between z-40">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
        <span>
          <strong>Update available:</strong> BugTraceAI WEB {APP_VERSION} &rarr; {update.latestVersion}
        </span>
        {update.releaseUrl && (
          <a
            href={update.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-cyan-100 ml-1"
          >
            View release
          </a>
        )}
        <span className="text-cyan-200 ml-2">Run: ./launcher.sh update</span>
      </div>
      <button
        onClick={update.dismiss}
        className="text-white/80 hover:text-white transition-colors ml-4 flex-shrink-0"
        aria-label="Dismiss update notification"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};
