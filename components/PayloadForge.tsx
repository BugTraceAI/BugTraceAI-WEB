// @author: Albert C | @yz9yt | github.com/yz9yt
// version 0.1 Beta
import React, { useState, useCallback, useEffect } from 'react';
import { forgePayloads } from '../services/Service.ts';
import { ForgedPayload } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { Spinner } from './Spinner.tsx';
import { FireIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import { SlidingSegmentedControl } from './cli/SlidingSegmentedControl.tsx';
import { CopyableCodeBlock } from './CopyableCodeBlock.tsx';

type ForgeTab = 'ai' | 'fuzz';

interface PayloadForgeProps {
  payloadForForge: string | null;
  onPayloadUsed: () => void;
  onShowApiKeyWarning: () => void;
}

export const PayloadForge: React.FC<PayloadForgeProps> = ({ payloadForForge, onPayloadUsed, onShowApiKeyWarning }) => {
  const [basePayload, setBasePayload] = useState<string>('<script>alert(1)</script>');

  const [forgedPayloads, setForgedPayloads] = useState<ForgedPayload[] | null>(null);
  const [isForging, setIsForging] = useState<boolean>(false);
  const [forgeError, setForgeError] = useState<string | null>(null);
  const { apiOptions, isApiKeySet } = useApiOptions();

  const [payloadList, setPayloadList] = useState<string>('');

  const [activeTab, setActiveTab] = useState<ForgeTab>('ai');

  useEffect(() => {
    if (payloadForForge) {
      setBasePayload(payloadForForge);
      onPayloadUsed();
    }
  }, [payloadForForge, onPayloadUsed]);

  const handleForge = useCallback(async () => {
    if (!isApiKeySet) {
      onShowApiKeyWarning();
      return;
    }
    if (!basePayload.trim()) {
      setForgeError('Please enter a base payload to forge.');
      return;
    }
    setForgeError(null);

    setIsForging(true);
    setForgedPayloads(null);
    setPayloadList('');
    setActiveTab('ai'); // Default to AI tab on new generation

    try {
      const result = await forgePayloads(basePayload, apiOptions!);
      setForgedPayloads(result.payloads);

      // --- Enhanced Fuzzing List Generation ---
      if (result.payloads && result.payloads.length > 0) {
        const fuzzingPrefixes = [
          '', // The payload itself
          "'",
          '"',
          "`",
          ">",
          "'>",
          "\">",
          "`>",
          "</script>",
          "</form>",
          "</div>",
          "</textarea>",
          "-->",
          "'-",
          "\"-",
          "`-",
          "');",
          "\");",
          "`));",
          "'});",
          "\"});",
          "`});",
        ];

        const allFuzzStrings = result.payloads.flatMap(forged => {
          const singleLinePayload = forged.payload.replace(/[\r\n\t]/g, '');
          return fuzzingPrefixes.map(prefix => `${prefix}${singleLinePayload}`);
        });
        const uniqueList = Array.from(new Set(allFuzzStrings));
        setPayloadList(uniqueList.join('\n'));
      } else {
        setPayloadList('// AI did not return any payloads to generate a fuzzing list from.');
      }

    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred.';
      setForgeError(errorMessage);
    } finally {
      setIsForging(false);
    }
  }, [basePayload, apiOptions, isApiKeySet, onShowApiKeyWarning]);

  return (
    <ToolLayout
      icon={<FireIcon className="h-8 w-8 text-orange-400" />}
      title="Payload Forge"
      description="Enter a base payload (e.g., an XSS script) and let the AI generate advanced variations for WAF bypass testing."
    >
      <div className="relative">
        <label htmlFor="basePayload" className="label-mini mb-2 block">Base Payload String</label>
        <textarea
          id="basePayload"
          value={basePayload}
          onChange={(e) => setBasePayload(e.target.value)}
          placeholder="e.g., <script>alert(1)</script>"
          className="input-premium h-32 w-full resize-y p-4 font-mono text-sm leading-relaxed sm:p-5"
          disabled={isForging}
        />
      </div>

      <div className="flex justify-center mt-8">
        <button
          onClick={handleForge}
          disabled={isForging || !basePayload.trim()}
          className="btn-mini btn-mini-primary h-11 !px-8 !rounded-xl shadow-glow-coral gap-2 group"
        >
          {isForging ? <Spinner /> : <FireIcon className="h-5 w-5 group-hover:rotate-12 transition-transform" />}
          FORGE ADVANCED VARIATIONS
        </button>
      </div>

      {isForging && (
        <div className="mt-8 text-center animate-pulse flex flex-col items-center gap-2">
          <div className="w-16 h-1 bg-ui-accent/20 rounded-full overflow-hidden">
            <div className="w-full h-full bg-ui-accent animate-scan-slow" />
          </div>
          <p className="label-mini !text-[9px] !text-ui-text-dim/60">SYNTHESIZING BYPASS LOGIC...</p>
        </div>
      )}

      {forgeError && !isForging && (
        <div className="mt-8 p-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono text-xs max-w-3xl mx-auto flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {forgeError}
        </div>
      )}

      {forgedPayloads && !isForging && (
        <div className="mt-10">
          <div className="mb-6">
            <SlidingSegmentedControl
              value={activeTab}
              onChange={value => setActiveTab(value as ForgeTab)}
              ariaLabel="Payload forge result view"
              itemWidth={148}
              variant="sub"
              options={[{ value: 'ai', label: 'AI variations' }, { value: 'fuzz', label: 'Fuzzing list' }]}
            />
          </div>

          {activeTab === 'ai' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {forgedPayloads.length > 0 ? forgedPayloads.map((p, index) => (
                <div key={index} className="card-premium p-5 !bg-ui-bg/40 hover:!border-ui-accent/40 transition-all group/card">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-[11px] font-black uppercase tracking-widest text-ui-accent">{p.technique}</h5>
                    <span className="label-mini !text-[8px] opacity-40">BYPASS-{index + 1}</span>
                  </div>
                  <p className="text-ui-text-dim text-[11px] leading-relaxed mb-4 min-h-[32px]">{p.description}</p>
                  <CopyableCodeBlock value={p.payload} language="PAYLOAD" />
                </div>
              )) : (
                <div className="col-span-full text-center p-12 bg-ui-bg/20 border border-dashed border-ui-border rounded-xl">
                  <p className="label-mini !text-ui-text-dim/60">No variations generated. Try a different base payload.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-ui-accent/5 border border-ui-accent/20">
                <div className="w-1 h-10 bg-ui-accent rounded-full" />
                <p className="text-[11px] text-ui-text-dim italic leading-relaxed">
                  Comprehensive list for fuzzing tools like Burp Intruder, combining all variations with common bypass prefixes.
                </p>
              </div>
              <CopyableCodeBlock value={payloadList} language="FUZZING LIST" maxHeight="20rem" />
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};
