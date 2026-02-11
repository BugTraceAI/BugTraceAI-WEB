// @author: Albert C | @yz9yt | github.com/yz9yt
// hooks/useUrlAnalysis.ts
// Custom hook for URL analysis state management and business logic
import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { analyzeUrl, performDeepAnalysis, consolidateReports, validateVulnerability } from '../services/Service.ts';
import { Vulnerability, VulnerabilityReport, DastScanType, ApiOptions } from '../types.ts';

interface UseUrlAnalysisParams {
  onAnalysisStart: () => void;
  onAnalysisComplete: (report: VulnerabilityReport) => void;
  onAnalysisError: (message: string) => void;
  onShowApiKeyWarning: () => void;
  setAnalysisLog: Dispatch<SetStateAction<string[]>>;
  apiOptions: ApiOptions | null;
  isApiKeySet: boolean;
  saveAnalysis: (
    type: 'url_analysis' | 'code_analysis',
    target: string,
    vulnerabilities: Vulnerability[],
    metadata?: { model?: string; scan_config?: any },
    sessionId?: string
  ) => Promise<any>;
  currentSessionId?: string;
}

export const useUrlAnalysis = ({
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  onShowApiKeyWarning,
  setAnalysisLog,
  apiOptions,
  isApiKeySet,
  saveAnalysis,
  currentSessionId
}: UseUrlAnalysisParams) => {
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scanType, setScanType] = useState<DastScanType>('recon');
  const [deepAnalysis, setDeepAnalysis] = useState<boolean>(false);
  const [validateFindings, setValidateFindings] = useState<boolean>(true);
  const [depth, setDepth] = useState<number>(3);

  const handleAnalyze = useCallback(async () => {
    if (!isApiKeySet) {
      onShowApiKeyWarning();
      return;
    }
    if (!url.trim().startsWith('http://') && !url.trim().startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://.');
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
          const result = await analyzeUrl(url, scanType, apiOptions!, i);
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

      // --- Phase 3: Validation & Deep Analysis (Optional) ---
      let processedVulnerabilities: Vulnerability[] = baseReport.vulnerabilities;
      if (deepAnalysis || validateFindings) {
        setAnalysisLog(prev => [...prev, 'Starting validation and analysis of each finding...']);

        const finalFindings: Vulnerability[] = [];
        for (let i = 0; i < processedVulnerabilities.length; i++) {
          const vuln = processedVulnerabilities[i];
          setAnalysisLog(prev => [...prev, `[${i + 1}/${processedVulnerabilities.length}] Validating finding: ${vuln.vulnerability}...`]);

          try {
            const validationResult = await validateVulnerability(vuln, apiOptions!);
            if (validationResult.is_valid) {
              setAnalysisLog(prev => [...prev, ` -> Finding validated.`]);
              if (deepAnalysis) {
                setAnalysisLog(prev => [...prev, ` -> Starting deep analysis...`]);
                const enrichedVuln = await performDeepAnalysis(vuln, url, apiOptions!);
                finalFindings.push(enrichedVuln);
              } else {
                finalFindings.push(vuln);
              }
            } else {
              setAnalysisLog(prev => [...prev, ` -> Filtering potential false positive: ${vuln.vulnerability} (${validationResult.reasoning})`]);
            }
          } catch (e: any) {
            console.error(`Validation failed for ${vuln.vulnerability}`, e);
            setAnalysisLog(prev => [...prev, ` -> Validation failed. Keeping original finding as-is.`]);
            finalFindings.push(vuln);
          }
        }

        processedVulnerabilities = finalFindings;
      }

      setAnalysisLog(prev => [...prev, 'Final report generation complete.']);
      const finalReport = { ...baseReport, vulnerabilities: processedVulnerabilities };
      onAnalysisComplete(finalReport);

      // Save analysis to database
      try {
        await saveAnalysis(
          'url_analysis',
          url,
          finalReport.vulnerabilities,
          {
            model: apiOptions?.model,
            scan_config: {
              scan_type: scanType,
              depth,
              deep_analysis: deepAnalysis,
              validate_findings: validateFindings
            }
          },
          currentSessionId
        );
        setAnalysisLog(prev => [...prev, 'Analysis saved to history.']);
      } catch (saveError: any) {
        console.error('Failed to save analysis:', saveError);
        setAnalysisLog(prev => [...prev, `⚠️ Failed to save to history: ${saveError?.message || 'Unknown error'}`]);
      }

    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred.';
      setError(errorMessage);
      onAnalysisError(errorMessage);
    }
  }, [
    url, scanType, deepAnalysis, validateFindings, depth,
    onAnalysisStart, onAnalysisComplete, onAnalysisError,
    setAnalysisLog, apiOptions, isApiKeySet, onShowApiKeyWarning,
    saveAnalysis, currentSessionId
  ]);

  return {
    url,
    setUrl,
    error,
    setError,
    scanType,
    setScanType,
    deepAnalysis,
    setDeepAnalysis,
    validateFindings,
    setValidateFindings,
    depth,
    setDepth,
    handleAnalyze
  };
};
