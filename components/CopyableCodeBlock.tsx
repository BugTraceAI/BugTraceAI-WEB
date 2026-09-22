import React, { useState } from 'react';
import { ClipboardDocumentListIcon } from './Icons.tsx';
import { copyText } from '../lib/clipboard.ts';

interface CopyableCodeBlockProps {
  value: string;
  language?: string;
  className?: string;
  maxHeight?: string;
}

/** Single visual contract for every read-only code/payload block in the web UI. */
export const CopyableCodeBlock: React.FC<CopyableCodeBlockProps> = ({ value, language = 'CODE', className = '', maxHeight }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      await copyText(value);
      setState('copied');
      window.setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2200);
    }
  };

  return (
    <div className={`btai-code-block group ${className}`}>
      <div className="btai-code-toolbar">
        <span className="btai-code-language">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="btai-code-copy"
          title={state === 'copied' ? 'Copied to clipboard' : 'Copy code'}
          aria-label={state === 'copied' ? 'Copied to clipboard' : 'Copy code'}
        >
          <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
          <span>{state === 'copied' ? 'Copied' : state === 'error' ? 'Retry' : 'Copy'}</span>
        </button>
      </div>
      <pre className="btai-code-pre" style={maxHeight ? { maxHeight } : undefined}><code>{value}</code></pre>
    </div>
  );
};
