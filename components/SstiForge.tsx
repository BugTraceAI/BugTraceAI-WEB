// components/SstiForge.tsx
// version 0.0.36
import React, { useState, useCallback } from 'react';
import { generateSstiPayloads } from '../services/Service.ts';
import { ForgedPayload } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { Spinner } from './Spinner.tsx';
import { PuzzlePieceIcon, ClipboardDocumentListIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';

const TEMPLATE_ENGINES = ['Jinja2 (Python)', 'Twig (PHP)', 'Freemarker (Java)', 'Velocity (Java)', 'Generic'];

interface SstiForgeProps {
  onShowApiKeyWarning: () => void;
}

export const SstiForge: React.FC<SstiForgeProps> = ({ onShowApiKeyWarning }) => {
  const [engine, setEngine] = useState<string>(TEMPLATE_ENGINES[0]);
  const [goal, setGoal] = useState<string>('whoami');
  const [generatedPayloads, setGeneratedPayloads] = useState<ForgedPayload[] | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { apiOptions, isApiKeySet } = useApiOptions();

  const handleGenerate = useCallback(async () => {
    if (!isApiKeySet) {
      onShowApiKeyWarning();
      return;
    }
    if (!goal.trim()) {
      setError('Please enter a goal (e.g., a command to execute).');
      return;
    }
    setError(null);
    setIsGenerating(true);
    setGeneratedPayloads(null);

    try {
      const result = await generateSstiPayloads(engine, goal, apiOptions!);
      setGeneratedPayloads(result.payloads);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred while generating payloads.');
    } finally {
      setIsGenerating(false);
    }
  }, [engine, goal, apiOptions, isApiKeySet, onShowApiKeyWarning]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <ToolLayout
      icon={<PuzzlePieceIcon className="h-8 w-8 text-coral" />}
      title="SSTI Payload Generator"
      description="Generate Server-Side Template Injection payloads tailored for specific template engines and goals."
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <label htmlFor="engine" className="label-mini mb-2 block">Template Engine</label>
          <div className="relative">
            <select
              id="engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="input-premium w-full p-4 appearance-none cursor-pointer"
              disabled={isGenerating}
            >
              {TEMPLATE_ENGINES.map(eng => <option key={eng} value={eng} className="bg-ui-bg text-ui-text-main">{eng}</option>)}
            </select>
            <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-ui-accent">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="goal" className="label-mini mb-2 block">Instruction / Command Payload</label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., id, cat /etc/passwd, {{7*7}}"
            className="input-premium w-full h-32 p-5 font-mono text-sm resize-y"
            disabled={isGenerating}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !goal.trim()}
          className="btn-mini btn-mini-primary !h-12 !px-10 !rounded-xl shadow-glow-coral group gap-3"
          title="Generate SSTI payloads based on the selected engine and goal"
        >
          {isGenerating ? <Spinner /> : <PuzzlePieceIcon className="h-5 w-5 group-hover:rotate-12 transition-transform" />}
          GENERATE INJECTION VECTORS
        </button>
      </div>

      {isGenerating && (
        <div className="mt-8 text-center animate-pulse flex flex-col items-center gap-2">
          <div className="w-16 h-1 bg-ui-accent/20 rounded-full overflow-hidden">
            <div className="w-full h-full bg-ui-accent animate-scan-slow" />
          </div>
          <p className="label-mini !text-[9px] !text-ui-text-dim/60">SYNTHESIZING TEMPLATE LOGIC...</p>
        </div>
      )}

      {error && !isGenerating && (
        <div className="mt-8 p-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono text-xs max-w-3xl mx-auto flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {error}
        </div>
      )}

      {generatedPayloads && !isGenerating && (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          {generatedPayloads.length > 0 ? generatedPayloads.map((p, index) => (
            <div key={index} className="card-premium p-5 !bg-ui-bg/40 hover:!border-ui-accent/40 transition-all group/card">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-[11px] font-black uppercase tracking-widest text-ui-accent">{p.technique}</h5>
                <span className="label-mini !text-[8px] opacity-40">VECTOR-{index + 1}</span>
              </div>
              <p className="text-ui-text-dim text-[11px] leading-relaxed mb-4 min-h-[32px]">{p.description}</p>
              <div className="bg-black/40 p-3 rounded-xl font-mono text-xs text-ui-accent/90 relative group border border-white/5">
                <pre className="overflow-x-auto no-scrollbar"><code className="whitespace-pre-wrap break-all">{p.payload}</code></pre>
                <button
                  onClick={() => handleCopy(p.payload, index)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-ui-accent/10 border border-ui-accent/30 text-ui-accent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-ui-accent/20"
                  aria-label="Copy payload"
                  title="Copy payload"
                >
                  {copiedIndex === index ? (
                    <span className="text-[8px] font-black px-1">COPIED</span>
                  ) : (
                    <ClipboardDocumentListIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center p-12 bg-ui-bg/20 border border-dashed border-ui-border rounded-xl">
              <p className="label-mini !text-ui-text-dim/60">No variations generated. Try rephrasing your goal.</p>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};