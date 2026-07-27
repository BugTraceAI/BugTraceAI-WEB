// @author: Albert C | @yz9yt | github.com/yz9yt
// components/DomXssPathfinder.tsx
// version 0.1 Beta
import React, { useState, useCallback, useEffect } from 'react';
import { analyzeDomXss } from '../services/Service.ts';
import { DomXssAnalysisResult, VulnerabilityReport, Vulnerability, Severity } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { Spinner } from './Spinner.tsx';
import { FlowChartIcon, ScanIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';

interface DomXssPathfinderProps {
  onAnalysisStart: () => void;
  onAnalysisComplete: (report: VulnerabilityReport) => void;
  onAnalysisError: (message: string) => void;
  onShowApiKeyWarning: () => void;
  isLoading: boolean;
  report: VulnerabilityReport | null;
}

const convertToVulnerabilityReport = (result: DomXssAnalysisResult): VulnerabilityReport => {
  const vulnerabilities: Vulnerability[] = result.connected_paths.map(path => ({
    vulnerability: 'DOM-based Cross-Site Scripting',
    severity: Severity.HIGH,
    description: `A vulnerable data flow path was found from source \`${path.source}\` to sink \`${path.sink}\`.`,
    impact: `User-controlled data from '${path.source}' can be executed by the '${path.sink}', potentially leading to arbitrary JavaScript execution in the user's browser context. This could be used to steal session tokens, perform actions on behalf of the user, or deface the page.`,
    recommendation: `Ensure that any data read from an untrusted source like '${path.source}' is properly sanitized and encoded before being passed to a dangerous sink like '${path.sink}'. Avoid using '.innerHTML' or 'document.write' with user-controlled content; use '.textContent' instead.`,
    vulnerableCode: path.code_snippet,
    injectionPoint: {
      type: 'PATH', // Placeholder as DOM XSS is often in URL fragments
      parameter: path.source,
      method: 'GET'
    }
  }));

  return {
    analyzedTarget: 'DOM XSS Code Analysis',
    vulnerabilities,
  };
};

export const DomXssPathfinder: React.FC<DomXssPathfinderProps> = ({ onAnalysisStart, onAnalysisComplete, onAnalysisError, onShowApiKeyWarning, isLoading, report: selectedReport }) => {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DomXssAnalysisResult | null>(null);
  const { apiOptions, isApiKeySet } = useApiOptions();

  useEffect(() => {
    if (!isLoading && selectedReport?.analyzedTarget !== 'DOM XSS Code Analysis') {
      setResult(null);
    }
  }, [selectedReport, isLoading]);

  const handleAnalyze = useCallback(async () => {
    if (!isApiKeySet) {
      onShowApiKeyWarning();
      return;
    }
    if (!code.trim()) {
      setError('Please paste JavaScript code to analyze.');
      return;
    }
    setError(null);
    setResult(null);

    onAnalysisStart();
    try {
      const analysisResult = await analyzeDomXss(code, apiOptions!);
      setResult(analysisResult);
      const report = convertToVulnerabilityReport(analysisResult);
      onAnalysisComplete(report);
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred while analyzing the code.';
      setError(errorMessage);
      onAnalysisError(errorMessage);
    }
  }, [code, onAnalysisStart, onAnalysisComplete, onAnalysisError, apiOptions, isApiKeySet, onShowApiKeyWarning]);

  return (
    <ToolLayout
      icon={<FlowChartIcon className="h-8 w-8 text-coral" />}
      title="DOM XSS Pathfinder"
      description="Paste JavaScript code to find vulnerable data flow paths from user-controlled sources to dangerous sinks."
    >
      <div className="max-w-3xl mx-auto">
        <label className="label-mini mb-2 block">Source Code Fragment</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={`const urlParams = new URLSearchParams(window.location.search);\nconst name = urlParams.get('name');\ndocument.getElementById('greeting').innerHTML = 'Hello, ' + name;`}
          className="input-premium w-full h-64 p-5 font-mono text-sm resize-y"
          disabled={isLoading}
        />
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !code.trim()}
          className="btn-mini btn-mini-primary !h-12 !px-10 !rounded-xl shadow-glow-coral group gap-3"
        >
          {isLoading ? <Spinner /> : <ScanIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />}
          TRACE DATA FLOW
        </button>
      </div>

      {isLoading && (
        <div className="mt-8 text-center animate-pulse flex flex-col items-center gap-2">
          <div className="w-16 h-1 bg-ui-accent/20 rounded-full overflow-hidden">
            <div className="w-full h-full bg-ui-accent animate-scan-slow" />
          </div>
          <p className="label-mini !text-[9px] !text-ui-text-dim/60">TRACING EXECUTION PATHS...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="mt-8 p-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-mono text-xs max-w-3xl mx-auto flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {error}
        </div>
      )}

      {result && !isLoading && (
        <div className="mt-12 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="title-standard !text-lg">Taint Analysis Results</h3>
            <div className="h-px flex-1 bg-ui-border" />
          </div>

          <div className="mb-10">
            <h4 className="label-mini !text-green-400 mb-4 block">HIGH CONFIDENCE VECTORS</h4>
            {result.connected_paths?.length > 0 ? (
              <div className="space-y-4">
                {result.connected_paths.map((path, index) => (
                  <div key={index} className="card-premium p-5 !bg-green-500/5 border-green-500/20">
                    <div className="text-sm font-black tracking-wide text-green-400 flex items-center gap-2 mb-4">
                      <span className="font-mono bg-green-500/10 px-2 py-1 rounded text-[10px] uppercase">{path.source}</span>
                      <span className="text-green-500/40">→</span>
                      <span className="font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded text-[10px] uppercase">{path.sink}</span>
                    </div>
                    <div className="mb-4">
                      <p className="label-mini mb-1.5 opacity-60">VULNERABLE CHAIN</p>
                      <pre className="bg-black/40 p-3 rounded-xl font-mono text-[10px] text-ui-accent/90 overflow-x-auto border border-white/5"><code>{path.code_snippet}</code></pre>
                    </div>
                    <div>
                      <p className="label-mini mb-1 opacity-60">ANALYSIS</p>
                      <p className="text-xs text-ui-text-dim leading-relaxed">{path.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-ui-border rounded-xl text-center">
                <p className="label-mini !text-ui-text-dim/60">No connected source-to-sink paths detected.</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="label-mini !text-yellow-400 mb-4 block">POTENTIAL TAINT OBJECTS</h4>
            {result.unconnected_findings?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card-premium p-5 !bg-yellow-500/5 border-yellow-500/20">
                  <h5 className="label-mini !text-yellow-400 mb-3">SOURCES IDENTIFIED</h5>
                  <ul className="space-y-1.5">
                    {result.unconnected_findings.filter(f => f.type === 'source').map((f, i) => (
                      <li key={i} className="font-mono text-[10px] text-yellow-200/80 bg-yellow-500/10 px-2 py-1 rounded inline-block mr-2 mb-1">{f.value}</li>
                    ))}
                  </ul>
                </div>
                <div className="card-premium p-5 !bg-red-500/5 border-red-500/20">
                  <h5 className="label-mini !text-red-400 mb-3">SINKS IDENTIFIED</h5>
                  <ul className="space-y-1.5">
                    {result.unconnected_findings.filter(f => f.type === 'sink').map((f, i) => (
                      <li key={i} className="font-mono text-[10px] text-red-300/80 bg-red-500/10 px-2 py-1 rounded inline-block mr-2 mb-1">{f.value}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-ui-border rounded-xl text-center">
                <p className="label-mini !text-ui-text-dim/60">No isolated sources or sinks found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  );
};