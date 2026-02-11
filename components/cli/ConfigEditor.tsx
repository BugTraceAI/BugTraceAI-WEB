import { lazy, Suspense, useState } from 'react';

// Lazy load Monaco Editor to reduce bundle size
const Editor = lazy(() => import('@monaco-editor/react').then(mod => ({ default: mod.Editor })));

interface ConfigEditorProps {
  content: string;
  onChange: (content: string) => void;
  errors?: Array<{ line?: number; message: string }>;
  readOnly?: boolean;
}

export function ConfigEditor({ content, onChange, errors = [], readOnly = false }: ConfigEditorProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleEditorMount = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col" data-testid="config-editor">
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-gray-400">Loading editor...</div>
          </div>
        )}
        <Suspense fallback={<div className="h-full flex items-center justify-center bg-gray-900"><div className="text-gray-400">Loading editor...</div></div>}>
          <Editor
            height="100%"
            defaultLanguage="ini"
            theme="vs-dark"
            value={content}
            onChange={(value) => onChange(value || '')}
            onMount={handleEditorMount}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </Suspense>
      </div>

      {/* Error panel */}
      {errors.length > 0 && (
        <div className="bg-red-900/50 border-t border-red-700 p-2 max-h-32 overflow-y-auto">
          <div className="text-red-400 text-sm font-semibold mb-1">Validation Errors:</div>
          {errors.map((error, i) => (
            <div key={i} className="text-red-300 text-sm">
              {error.line ? `Line ${error.line}: ` : ''}{error.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
