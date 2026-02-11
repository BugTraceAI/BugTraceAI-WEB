// components/PrivEscPathfinder.tsx
// version 0.0.37
import React, { useState, useCallback, useEffect } from 'react';
import { findPrivescExploits } from '../services/Service.ts';
import { Vulnerability, VulnerabilityReport } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { VulnerabilityCard } from './VulnerabilityCard.tsx';
import { Spinner } from './Spinner.tsx';
import { KeyIcon, ScanIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import { ReportHeader } from './ReportHeader.tsx';

interface PrivEscPathfinderProps {
    onAnalysisStart: () => void;
    onAnalysisComplete: (report: VulnerabilityReport) => void;
    onAnalysisError: (message: string) => void;
    onShowApiKeyWarning: () => void;
    report: VulnerabilityReport | null;
    isLoading: boolean;
    onAnalyzeWithAgent: (vulnerability: Vulnerability, analyzedTarget: string) => void;
}

export const PrivEscPathfinder: React.FC<PrivEscPathfinderProps> = ({ onAnalysisStart, onAnalysisComplete, onAnalysisError, onShowApiKeyWarning, report, isLoading, onAnalyzeWithAgent }) => {
  const [technology, setTechnology] = useState<string>('WordPress');
  const [version, setVersion] = useState<string>('5.8');
  const [error, setError] = useState<string | null>(null);
  const { apiOptions, isApiKeySet } = useApiOptions();
  
  // When a report is selected from history, pre-fill the form
  useEffect(() => {
    if (report && !isLoading) {
      const parts = report.analyzedTarget.split(' ');
      if (parts.length >= 2) {
        setTechnology(parts.slice(0, -1).join(' '));
        setVersion(parts[parts.length - 1]);
      }
    }
  }, [report, isLoading]);

  const handleSearch = useCallback(async () => {
    if (!isApiKeySet) {
        onShowApiKeyWarning();
        return;
    }
    if (!technology.trim() || !version.trim()) {
      setError('Please provide both a technology and a version.');
      return;
    }
    setError(null);
    
    onAnalysisStart();
    try {
      const result = await findPrivescExploits(technology, version, apiOptions!);
      onAnalysisComplete(result);
    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred while searching for exploits.';
      setError(errorMessage);
      onAnalysisError(errorMessage);
    }
  }, [technology, version, onAnalysisStart, onAnalysisComplete, onAnalysisError, apiOptions, isApiKeySet, onShowApiKeyWarning]);

  return (
    <ToolLayout
      icon={<KeyIcon className="h-8 w-8 text-coral" />}
      title="PrivEsc Pathfinder"
      description="Find public Privilege Escalation (PrivEsc) and RCE exploits for specific software versions using AI-powered search."
    >
      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="technology" className="block text-sm font-medium text-purple-gray mb-2">Technology / Product</label>
          <input
            id="technology"
            type="text"
            value={technology}
            onChange={(e) => setTechnology(e.target.value)}
            placeholder="e.g., WordPress, Apache Tomcat"
            className="w-full p-2 bg-purple-medium/60 border-0 rounded-lg text-white focus:ring-2 focus:ring-coral/50 focus:border-coral focus:outline-none transition-colors"
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="version" className="block text-sm font-medium text-purple-gray mb-2">Version</label>
          <input
            id="version"
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g., 5.8.1, 9.0.50"
            className="w-full p-2 bg-purple-medium/60 border-0 rounded-lg text-white focus:ring-2 focus:ring-coral/50 focus:border-coral focus:outline-none transition-colors"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={handleSearch}
          disabled={isLoading || !technology.trim() || !version.trim()}
          className="group relative inline-flex items-center justify-center px-8 py-3 bg-coral-active hover:bg-coral text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-coral/20 hover:shadow-coral/40"
        >
          {isLoading ? <Spinner /> : <ScanIcon className="h-5 w-5 mr-2" />}
          <span className="relative">Find Exploits</span>
        </button>
      </div>

      {isLoading && (
        <div className="mt-8 text-center text-purple-gray animate-pulse">
            <p>AI is searching for relevant CVEs and exploits...</p>
        </div>
      )}
      
      {error && !isLoading && (
        <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg font-mono max-w-3xl mx-auto">{error}</div>
      )}

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
                        onAnalyzeWithAgent={() => onAnalyzeWithAgent(vuln, report.analyzedTarget)}
                    />
                ))}
                </div>
            ) : (
                <div className="text-center p-6 bg-green-900/30 border border-green-500/30 text-green-300 rounded-lg backdrop-blur-sm">
                    <p className="font-semibold">No public exploits for Privilege Escalation or RCE were found for this specific version.</p>
                </div>
            )}
        </div>
      )}
    </ToolLayout>
  );
};