// @author: Albert C | @yz9yt | github.com/yz9yt
// version 0.1 Beta
/* eslint-disable max-lines -- Code analyzer component (255 lines).
 * SAST analysis with recursive scanning and deep analysis features.
 * Includes code validation, multi-pass analysis, consolidation, and enrichment.
 * Analysis pipeline spans multiple phases - splitting would fragment SAST workflow.
 */
import React, { useState, useCallback } from 'react';
import { analyzeCode, consolidateReports, performSastDeepAnalysis } from '../services/Service.ts';
import { Vulnerability, VulnerabilityReport } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { useAnalysisContext } from '../contexts/AnalysisContext.tsx';
import { useChatContext } from '../contexts/ChatContext.tsx';
import { VulnerabilityCard } from './VulnerabilityCard.tsx';
import { Spinner } from './Spinner.tsx';
import { ScanIcon, TerminalIcon, CodeBracketIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import { ReportHeader } from './ReportHeader.tsx';

interface CodeAnalyzerProps {
  onAnalysisStart: () => void;
  onAnalysisComplete: (report: VulnerabilityReport) => void;
  onAnalysisError: (message: string) => void;
  onShowApiKeyWarning: () => void;
  report: VulnerabilityReport | null;
  isLoading: boolean;
  analysisLog: string[];
  onSendToPayloadForge: (payload: string) => void;
  onSendToJwtAnalyzer: (token: string) => void;
  onShowExploitAssistant: (vulnerability: Vulnerability) => void;
  onAnalyzeWithAgent: (vulnerability: Vulnerability, analyzedTarget: string) => void;
  setAnalysisLog: React.Dispatch<React.SetStateAction<string[]>>;
}

export const CodeAnalyzer: React.FC<CodeAnalyzerProps> = ({ onAnalysisStart, onAnalysisComplete, onAnalysisError, onShowApiKeyWarning, report, isLoading, analysisLog, onSendToPayloadForge, onSendToJwtAnalyzer, onShowExploitAssistant, onAnalyzeWithAgent, setAnalysisLog }) => {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<boolean>(false);
  const [depth, setDepth] = useState<number>(3);
  const { apiOptions, isApiKeySet } = useApiOptions();
  const { saveAnalysis } = useAnalysisContext();
  const { currentSession } = useChatContext();

  const handleAnalyze = useCallback(async () => {
    if (!isApiKeySet) {
      onShowApiKeyWarning();
      return;
    }
    if (!code.trim()) {
      setError('Please enter a code snippet to analyze.');
      return;
    }
    setError(null);

    onAnalysisStart();
    
    try {
        setAnalysisLog(['Starting Analysis...']);
        await new Promise(res => setTimeout(res, 200));

        // --- Phase 1: Recursive Scanning ---
        const successfulReports: VulnerabilityReport[] = [];
        for (let i = 0; i < depth; i++) {
            setAnalysisLog(prev => [...prev, `Executing recursive analysis ${i + 1} of ${depth} with a new prompt variation...`]);
            try {
                const result = await analyzeCode(code, apiOptions!, i);
                successfulReports.push(result);
                setAnalysisLog(prev => [...prev, ` -> Run ${i + 1} completed. Found ${result.vulnerabilities.length} potential vulnerabilities.`]);
            } catch (e: any) {
                console.error(`Recursive analysis run ${i + 1} failed:`, e);
                setAnalysisLog(prev => [...prev, ` -> Run ${i + 1} failed: ${e.message}`]);
            }
        }

        if (successfulReports.length === 0) {
            throw new Error("All recursive analysis attempts failed. This could be due to API errors or network issues.");
        }
        
        // --- Phase 2: Consolidation ---
        let baseReport: VulnerabilityReport;
        if (successfulReports.length > 1) {
            setAnalysisLog(prev => [...prev, `Consolidating ${successfulReports.length} reports with AI...`]);
            baseReport = await consolidateReports(successfulReports, apiOptions!);
            setAnalysisLog(prev => [...prev, 'Consolidation complete.']);
        } else {
            baseReport = successfulReports[0];
        }

        if (baseReport.vulnerabilities.length === 0) {
            onAnalysisComplete(baseReport);
            return;
        }

        // --- Phase 3: Deep Analysis (Optional) ---
        let finalReport: VulnerabilityReport;
        if (deepAnalysis) {
            setAnalysisLog(prev => [...prev, 'Starting in-depth analysis of each finding...']);

            const enrichedVulnerabilities: Vulnerability[] = [];
            for (let i = 0; i < baseReport.vulnerabilities.length; i++) {
                const vuln = baseReport.vulnerabilities[i];
                setAnalysisLog(prev => [...prev, `[${i + 1}/${baseReport.vulnerabilities.length}] Deep analyzing: ${vuln.vulnerability}...`]);
                try {
                    const enrichedVuln = await performSastDeepAnalysis(vuln, code, apiOptions!);
                    enrichedVulnerabilities.push(enrichedVuln);
                } catch (deepError: any) {
                    console.error(`Deep analysis failed for ${vuln.vulnerability}`, deepError);
                    setAnalysisLog(prev => [...prev, ` -> Deep analysis failed. Keeping original finding.`]);
                    enrichedVulnerabilities.push(vuln);
                }
            }

            setAnalysisLog(prev => [...prev, 'Deep Analysis Complete. Generating final report...']);
            finalReport = { ...baseReport, vulnerabilities: enrichedVulnerabilities };
        } else {
            finalReport = baseReport;
        }

        onAnalysisComplete(finalReport);

        // Save analysis to database
        try {
            // Create a short preview of the code for the target field
            const codePreview = code.length > 100 ? code.substring(0, 100) + '...' : code;
            await saveAnalysis(
                'code_analysis',
                codePreview,
                finalReport.vulnerabilities,
                {
                    model: apiOptions?.model,
                    scan_config: {
                        depth,
                        deep_analysis: deepAnalysis
                    }
                },
                currentSession?.id // Link to current chat session if exists
            );
            setAnalysisLog(prev => [...prev, 'Analysis saved to history.']);
        } catch (saveError) {
            console.error('Failed to save analysis:', saveError);
            // Don't block user - analysis succeeded, save failed
        }
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred.';
      setError(errorMessage);
      onAnalysisError(errorMessage);
    }
  }, [code, deepAnalysis, depth, onAnalysisStart, onAnalysisComplete, onAnalysisError, setAnalysisLog, apiOptions, isApiKeySet, onShowApiKeyWarning, saveAnalysis]);

  return (
    <ToolLayout
      icon={<CodeBracketIcon className="h-8 w-8 text-purple-400" />}
      title="Code Analysis (SAST)"
      description="Paste a code snippet for the AI to analyze for vulnerabilities."
    >
      <div className="relative">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="function vulnerable(userInput) {\n  const sql = `SELECT * FROM users WHERE id = '${userInput}'`;\n  // ...\n}"
          className="w-full h-64 p-4 font-mono text-sm bg-purple-medium/50 backdrop-blur-sm border-0 rounded-xl text-white placeholder-muted focus:ring-2 focus:ring-coral/50 focus:border-coral/30 focus:outline-none transition-all duration-200 resize-y"
          disabled={isLoading}
        />
      </div>

      <div className="max-w-xl mx-auto my-6 space-y-4">
        <div >
            <label htmlFor="depth-select-sast" className="block text-sm font-medium text-purple-gray mb-2">
                Analysis Depth <span className="text-muted">(for reliability)</span>
            </label>
            <select
                id="depth-select-sast"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full p-3 bg-purple-medium/50 backdrop-blur-sm border-0 rounded-xl text-white focus:ring-2 focus:ring-coral/50 focus:border-coral/30 focus:outline-none transition-all duration-200"
                disabled={isLoading}
            >
                <option value="1">1 (Fastest)</option>
                <option value="2">2</option>
                <option value="3">3 (Default)</option>
                <option value="4">4</option>
                <option value="5">5 (Most Reliable)</option>
            </select>
        </div>

        <div className="relative flex items-start p-4 bg-purple-medium/30 border-0 rounded-xl cursor-pointer hover:border-coral/30 transition-all duration-200 backdrop-blur-sm" onClick={() => setDeepAnalysis(!deepAnalysis)}>
            <div className="flex items-center h-5">
                <input
                    id="deep-analysis-sast"
                    name="deep-analysis-sast"
                    type="checkbox"
                    checked={deepAnalysis}
                    onChange={(e) => setDeepAnalysis(e.target.checked)}
                    className="focus:ring-coral h-4 w-4 text-coral-active border-glass-border bg-purple-light rounded"
                    disabled={isLoading}
                />
            </div>
            <div className="ml-3 text-sm">
                <label htmlFor="deep-analysis-sast" className="font-medium text-white flex items-center gap-2 cursor-pointer">
                    Enable Deep Analysis
                </label>
                <p className="text-purple-gray">Performs a second, specialized analysis on each finding for a higher-quality report. (Slower, may use more API credits)</p>
            </div>
        </div>
      </div>


      <div className="flex justify-center">
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !code.trim()}
          className="group relative inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-coral to-coral-hover text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-105 hover:shadow-lg hover:shadow-coral/25 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {isLoading ? <Spinner /> : <ScanIcon className="h-5 w-5 mr-2" />}
          <span className="relative">Analyze Code</span>
        </button>
      </div>

      {isLoading && (
        <div className="mt-6 bg-purple-medium/50 backdrop-blur-sm p-5 rounded-xl border-0">
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

      {error && !isLoading && <div className="mt-6 p-4 gradient-red-pink rounded-lg font-mono shadow-lg shadow-red-500/30 text-white">{error}</div>}

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
                    onShowExploitAssistant={() => onShowExploitAssistant(vuln)}
                    onAnalyzeWithAgent={() => onAnalyzeWithAgent(vuln, report.analyzedTarget)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-6 gradient-green-teal rounded-lg backdrop-blur-sm shadow-lg shadow-green-500/20 text-white">
              <p className="font-semibold">Good job! No vulnerabilities were found in the provided code.</p>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};