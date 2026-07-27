// components/SecurityHeadersAnalyzer.tsx
// version 0.0.37
import React, { useState, useCallback } from 'react';
import { analyzeHeaders } from '../services/Service.ts';
import { HeadersReport, HeaderFinding, VulnerabilityReport, Vulnerability, Severity } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { useAnalysisContext } from '../contexts/AnalysisContext.tsx';
import { Spinner } from './Spinner.tsx';
import { ScanIcon, ShieldCheckIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import { HeadersReportHeader } from './HeadersReportHeader.tsx';

interface SecurityHeadersAnalyzerProps {
    onAnalysisStart: () => void;
    onAnalysisComplete: (report: VulnerabilityReport) => void;
    onAnalysisError: (message: string) => void;
    onShowApiKeyWarning: () => void;
    isLoading: boolean;
    report: VulnerabilityReport | null;
}

const SEVERITY_STYLES: Record<HeaderFinding['severity'], string> = {
    'High': 'border-orange-500',
    'Medium': 'border-yellow-500',
    'Low': 'border-coral',
    'Info': 'border-0',
};

const FindingCard: React.FC<{ finding: HeaderFinding }> = ({ finding }) => {
    const isPassing = finding.status === 'Present - Good';

    return (
        <div className={`card-premium p-5 !bg-ui-bg/40 border-l-4 ${SEVERITY_STYLES[finding.severity]}`}>
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-black text-sm uppercase tracking-wide text-ui-text-main font-mono">{finding.name}</h4>
                <span className={`badge-mini ${isPassing ? 'badge-mini-success' : 'badge-mini-error'}`}>
                    {finding.status}
                </span>
            </div>
            {finding.value && (
                <div className="mb-4">
                    <p className="label-mini mb-1.5 opacity-60">DETECTED VALUE</p>
                    <pre className="bg-black/40 p-3 rounded-xl font-mono text-[10px] text-ui-accent/90 overflow-x-auto border border-white/5"><code>{finding.value}</code></pre>
                </div>
            )}
            <div>
                <p className="label-mini mb-1 opacity-60">REMEDIATION INTELLIGENCE</p>
                <p className="text-xs text-ui-text-dim leading-relaxed">{finding.recommendation}</p>
            </div>
        </div>
    );
};

const convertToVulnerabilityReport = (report: HeadersReport): VulnerabilityReport => {
    const summaryVulnerability: Vulnerability = {
        vulnerability: 'Overall Security Header Grade',
        severity: Severity.INFO,
        description: `The overall security header grade for ${report.analyzedUrl} is **${report.overallScore}**.`,
        impact: report.summary,
        recommendation: 'See individual header findings for specific recommendations.',
        vulnerableCode: `Overall Score: ${report.overallScore}`
    };

    const findingVulnerabilities: Vulnerability[] = report.findings.map(finding => {
        let severity: Severity;
        switch (finding.severity) {
            case 'High': severity = Severity.HIGH; break;
            case 'Medium': severity = Severity.MEDIUM; break;
            case 'Low': severity = Severity.LOW; break;
            default: severity = Severity.INFO;
        }

        return {
            vulnerability: `Security Header: ${finding.name}`,
            severity: severity,
            description: `Status: **${finding.status}**.\n\n${finding.value ? `Value: \`${finding.value}\`` : ''}`,
            impact: 'Misconfigured or missing security headers can lead to vulnerabilities like Cross-Site Scripting (XSS), clickjacking, information disclosure, and Man-in-the-Middle (MITM) attacks.',
            recommendation: finding.recommendation,
            vulnerableCode: finding.value || 'Header Not Found'
        }
    });

    return {
        analyzedTarget: report.analyzedUrl,
        vulnerabilities: [summaryVulnerability, ...findingVulnerabilities],
    };
};

export const SecurityHeadersAnalyzer: React.FC<SecurityHeadersAnalyzerProps> = ({ onAnalysisStart, onAnalysisComplete, onAnalysisError, onShowApiKeyWarning, isLoading }) => {
    const [url, setUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [localReport, setLocalReport] = useState<HeadersReport | null>(null);
    const { apiOptions, isApiKeySet } = useApiOptions();
    const { saveAnalysis } = useAnalysisContext();

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
        setLocalReport(null);

        onAnalysisStart();
        try {
            const result = await analyzeHeaders(url, apiOptions!);
            setLocalReport(result);
            const reportForHistory = convertToVulnerabilityReport(result);
            onAnalysisComplete(reportForHistory);

            // Save to database for history
            try {
                await saveAnalysis(
                    'security_headers',
                    url,
                    reportForHistory.vulnerabilities,
                    {
                        model: apiOptions?.model,
                        scan_config: {
                            overall_score: result.overallScore,
                            findings_count: result.findings.length
                        }
                    }
                );
            } catch (saveError) {
                console.error('Failed to save security headers analysis:', saveError);
            }
        } catch (e: any) {
            const errorMessage = e.message || 'An unexpected error occurred.';
            setError(errorMessage);
            onAnalysisError(errorMessage);
        }
    }, [url, onAnalysisStart, onAnalysisComplete, onAnalysisError, apiOptions, isApiKeySet, onShowApiKeyWarning, saveAnalysis]);

    return (
        <ToolLayout
            icon={<ShieldCheckIcon className="h-8 w-8 text-coral" />}
            title="Security Headers Analyzer"
            description="Enter a URL to analyze its HTTP security headers. The AI will assess headers like CSP and HSTS against best practices."
        >
            <div className="flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    <div className="relative flex-grow w-full max-w-lg">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="input-premium w-full !py-3.5 px-6 !rounded-2xl !text-base"
                            disabled={isLoading}
                            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyze()}
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !url.trim()}
                        className="btn-mini btn-mini-primary w-full sm:w-auto !py-4 px-10 !rounded-2xl !text-sm group"
                    >
                        {isLoading ? <Spinner /> : <ScanIcon className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />}
                        Analyze Headers
                    </button>
                </div>
            </div>

            <div className="mt-6">
                {isLoading && (
                    <div className="mt-8 text-center text-ui-text-dim animate-pulse">
                        <p>AI is fetching and analyzing headers...</p>
                    </div>
                )}

                {error && !isLoading && <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg font-mono max-w-3xl mx-auto">{error}</div>}

                {localReport && !isLoading && (
                    <div className="mt-2 animate-fade-in">
                        <HeadersReportHeader report={localReport} />

                        <div className="mt-6 space-y-4">
                            {localReport.findings.map((finding, index) => (
                                <FindingCard key={index} finding={finding} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ToolLayout>
    );
};