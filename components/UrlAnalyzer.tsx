// @author: Albert C | @yz9yt | github.com/yz9yt
// components/UrlAnalyzer.tsx
// version 0.1 Beta
// eslint-disable-next-line max-lines -- Complex form with multiple scan options and configuration UI (243 lines, hook-extracted)
import React, { useEffect } from 'react';
import { Vulnerability, VulnerabilityReport, DastScanType } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { useAnalysisContext } from '../contexts/AnalysisContext.tsx';
import { useChatContext } from '../contexts/ChatContext.tsx';
import { useUrlAnalysis } from '../hooks/useUrlAnalysis.ts';
import { VulnerabilityCard } from './VulnerabilityCard.tsx';
import { Spinner } from './Spinner.tsx';
import { ScanIcon, TerminalIcon, LinkIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import { ReportHeader } from './ReportHeader.tsx';

interface UrlAnalyzerProps {
  onAnalysisStart: () => void;
  onAnalysisComplete: (report: VulnerabilityReport) => void;
  onAnalysisError: (message: string) => void;
  onShowApiKeyWarning: () => void;
  report: VulnerabilityReport | null;
  isLoading: boolean;
  analysisLog: string[];
  onSendToPayloadForge: (payload: string) => void;
  onSendToJwtAnalyzer: (token: string) => void;
  onShowExploitAssistant: (vulnerability: Vulnerability, targetUrl: string) => void;
  onShowSqlExploitAssistant: (vulnerability: Vulnerability, targetUrl: string) => void;
  onAnalyzeWithAgent: (vulnerability: Vulnerability, targetUrl: string) => void;
  setAnalysisLog: React.Dispatch<React.SetStateAction<string[]>>;
}

const scanOptions: { id: DastScanType; name: string; description: string; }[] = [
  { id: 'recon', name: 'Recon Scan', description: 'Fast. Uses public intelligence (e.g., known exploits) to find vulnerabilities. Low invasiveness.' },
  { id: 'active', name: 'Active Scan (Simulated)', description: 'Thorough. Analyzes inputs and application structure to hypothesize vulnerabilities.' },
  { id: 'greybox', name: 'Grey Box Scan (DAST + SAST)', description: 'Most Powerful. Combines Active Scan with an analysis of the site\'s live JavaScript code for higher accuracy.' },
];

export const UrlAnalyzer: React.FC<UrlAnalyzerProps> = ({
  onAnalysisStart, onAnalysisComplete, onAnalysisError, onShowApiKeyWarning,
  report, isLoading, analysisLog,
  onSendToPayloadForge, onSendToJwtAnalyzer, onShowExploitAssistant, onShowSqlExploitAssistant, onAnalyzeWithAgent,
  setAnalysisLog
}) => {
  const { apiOptions, isApiKeySet } = useApiOptions();
  const { saveAnalysis } = useAnalysisContext();
  const { currentSession } = useChatContext();

  const {
    url,
    setUrl,
    error,
    scanType,
    setScanType,
    deepAnalysis,
    setDeepAnalysis,
    validateFindings,
    setValidateFindings,
    depth,
    setDepth,
    handleAnalyze
  } = useUrlAnalysis({
    onAnalysisStart,
    onAnalysisComplete,
    onAnalysisError,
    onShowApiKeyWarning,
    setAnalysisLog,
    apiOptions,
    isApiKeySet,
    saveAnalysis,
    currentSessionId: currentSession?.id
  });

  useEffect(() => {
    // When a report is selected from history, update the input field
    if (report?.analyzedTarget && report.analyzedTarget.startsWith('http')) {
      setUrl(report.analyzedTarget);
    }
  }, [report, setUrl]);

  return (
    <ToolLayout
      icon={<LinkIcon className="h-8 w-8 text-purple-400" />}
      title="URL Analysis (DAST)"
      description="Enter a URL for the AI to analyze using one of the scan modes below."
    >
      <div className="max-w-2xl mx-auto mb-4">
        {/* Scan Type Options - Compact horizontal cards */}
        <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <legend className="sr-only">Scan Type</legend>
          {scanOptions.map(option => (
            <div key={option.id} className={`relative cursor-pointer p-4 rounded-xl transition-all duration-300 border ${scanType === option.id
              ? 'bg-ui-accent/10 border-ui-accent shadow-[0_0_15px_rgba(255,127,80,0.15)] scale-[1.02]'
              : 'bg-ui-input-bg/40 border-ui-border hover:border-ui-accent/30 hover:bg-ui-input-bg/60'
              }`} onClick={() => setScanType(option.id)}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${scanType === option.id ? 'border-ui-accent' : 'border-ui-text-dim/40'
                  }`}>
                  {scanType === option.id && <div className="w-1.5 h-1.5 rounded-full bg-ui-accent shadow-[0_0_8px_rgba(255,127,80,0.8)]" />}
                </div>
                <label htmlFor={option.id} className={`font-bold text-sm cursor-pointer transition-colors ${scanType === option.id ? 'text-ui-text-main' : 'text-ui-text-dim'
                  }`}>
                  {option.name}
                </label>
              </div>
              <p className="text-ui-text-dim/80 text-[11px] leading-relaxed pl-6">{option.description}</p>
            </div>
          ))}
        </fieldset>

        {/* Options Row: Depth + Checkboxes */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-dashboard-bg/50 border border-ui-border rounded-2xl shadow-inner">
          {/* Depth Selector */}
          <div className="flex items-center gap-3">
            <span className="label-mini !text-[9px]">Depth</span>
            <select
              id="depth-select"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="input-premium py-1 px-3 !text-xs !bg-ui-bg"
              disabled={isLoading}
            >
              <option value="1">1 (Fast)</option>
              <option value="2">2</option>
              <option value="3">3 (Default)</option>
              <option value="4">4</option>
              <option value="5">5 (Thorough)</option>
            </select>
          </div>

          <div className="h-4 w-px bg-white/5" />

          {/* Deep Analysis Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer group" title="Performs a second, specialized analysis on each finding">
            <div className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all ${deepAnalysis ? 'bg-ui-accent border-ui-accent shadow-[0_0_8px_rgba(255,127,80,0.4)]' : 'bg-ui-input-bg border-ui-border'
              }`}>
              {deepAnalysis && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={deepAnalysis}
              onChange={(e) => setDeepAnalysis(e.target.checked)}
              disabled={isLoading}
            />
            <span className="text-xs font-semibold text-ui-text-dim group-hover:text-ui-text-main transition-colors">Deep Analysis</span>
          </label>

          <div className="h-4 w-px bg-white/5" />

          {/* Validation Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer group" title="Filter out AI hallucinations and false positives">
            <div className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all ${validateFindings ? 'bg-ui-accent border-ui-accent shadow-[0_0_8px_rgba(255,127,80,0.4)]' : 'bg-ui-input-bg border-ui-border'
              }`}>
              {validateFindings && <div className="w-2 h-2 bg-white rounded-sm" />}
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={validateFindings}
              onChange={(e) => setValidateFindings(e.target.checked)}
              disabled={isLoading}
            />
            <span className="text-xs font-semibold text-ui-text-dim group-hover:text-ui-text-main transition-colors">Validate Findings</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mt-6">
        <div className="relative flex-grow w-full max-w-lg">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ginandjuice.shop/"
            className="input-premium w-full !py-3.5 px-6 !rounded-2xl !text-base"
            disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyze()}
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !url.trim()}
          className="btn-mini btn-mini-primary !py-4 px-10 !rounded-2xl !text-sm group"
        >
          {isLoading ? <Spinner /> : <ScanIcon className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />}
          Analyze URL
        </button>
      </div>

      {isLoading && (
        <div className="mt-6 bg-purple-medium/50 backdrop-blur-sm p-5 rounded-xl border-0 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-purple-300 mb-3">
            <TerminalIcon className="h-5 w-5 animate-pulse" />
            <h3 className="font-semibold">Live Analysis Log</h3>
          </div>
          <div className="text-sm text-purple-gray space-y-1.5 font-mono">
            {analysisLog.map((log, index) => (
              <p key={index} className="opacity-90">{`> ${log}`}</p>
            ))}
          </div>
        </div>
      )}

      {error && !isLoading && <div className="mt-6 p-4 gradient-red-pink rounded-lg font-mono max-w-3xl mx-auto shadow-lg shadow-red-500/30 text-white">{error}</div>}

      {report && !isLoading && (
        <div className="mt-8">
          <ReportHeader report={report} />

          {report.vulnerabilities.length > 0 ? (
            <div className="space-y-4">
              {report.vulnerabilities.map((vuln, index) => (
                <VulnerabilityCard
                  key={index}
                  vulnerability={vuln}
                  analyzedTarget={report.analyzedTarget}
                  onSendToPayloadForge={onSendToPayloadForge}
                  onSendToJwtAnalyzer={onSendToJwtAnalyzer}
                  onShowExploitAssistant={() => onShowExploitAssistant(vuln, report.analyzedTarget)}
                  onShowSqlExploitAssistant={() => onShowSqlExploitAssistant(vuln, report.analyzedTarget)}
                  onAnalyzeWithAgent={() => onAnalyzeWithAgent(vuln, report.analyzedTarget)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-6 gradient-green-teal rounded-lg backdrop-blur-sm shadow-lg shadow-green-500/20 text-white">
              <p className="font-semibold">Analysis complete! The AI did not infer any obvious vulnerabilities for the selected scan type.</p>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};
