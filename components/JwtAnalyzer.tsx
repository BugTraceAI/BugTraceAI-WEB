// @author: Albert C | @yz9yt | github.com/yz9yt
// components/JwtAnalyzer.tsx
// version 0.1 Beta
import React from 'react';
import { VulnerabilityReport } from '../types.ts';
import { useApiOptions } from '../hooks/useApiOptions.ts';
import { useJwtAnalysis } from '../hooks/useJwtAnalysis.ts';
import { useAnalysisContext } from '../contexts/AnalysisContext.tsx';
import { Spinner } from './Spinner.tsx';
import { KeyIcon, ShieldCheckIcon, FireIcon, ChatIcon, DocumentTextIcon, CodeBracketSquareIcon } from './Icons.tsx';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import { sanitizeFilename, triggerDownload } from '../utils/reportExporter.ts';

interface JwtAnalyzerProps {
    initialToken: string | null;
    report: VulnerabilityReport | null;
    onTokenConsumed: () => void;
    onAnalysisComplete: (report: VulnerabilityReport) => void;
    onSendReportToAgent: (reportText: string, analysisType: string) => void;
    onShowApiKeyWarning: () => void;
}

export const JwtAnalyzer: React.FC<JwtAnalyzerProps> = ({ initialToken, report, onTokenConsumed, onAnalysisComplete, onSendReportToAgent, onShowApiKeyWarning }) => {
    const { apiOptions, isApiKeySet } = useApiOptions();
    const { saveAnalysis } = useAnalysisContext();

    const {
        encodedJwt,
        setEncodedJwt,
        decodedJwt,
        loadingState,
        error,
        setError,
        blueTeamResult,
        redTeamResult,
        activeTab,
        setActiveTab,
        handleAudit,
        getCurrentResult,
    } = useJwtAnalysis({
        initialToken,
        report,
        onTokenConsumed,
        onAnalysisComplete,
        apiOptions,
        isApiKeySet,
        onShowApiKeyWarning,
        saveAnalysis,
    });

    return (
        <ToolLayout
            icon={<KeyIcon className="h-8 w-8 text-coral" />}
            title="JWT Decompiler & Auditor"
            description="Paste a JSON Web Token to decode it. Then, use the AI auditor to analyze its security."
        >
            <div>
                <label htmlFor="jwt-input" className="block text-sm font-medium text-purple-gray mb-2">Encoded JWT</label>
                <textarea
                    id="jwt-input"
                    value={encodedJwt}
                    onChange={e => setEncodedJwt(e.target.value)}
                    placeholder="ey...[header]....ey...[payload]....[signature]"
                    className="w-full h-40 p-4 font-mono text-xs bg-purple-medium/60 border-0 rounded-lg text-white focus:ring-2 focus:ring-coral/50 focus:border-coral focus:outline-none transition-all duration-300 resize-y"
                />
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => handleAudit('blue_team')} disabled={loadingState !== 'none' || !decodedJwt} className="group relative w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40">
                    {loadingState === 'blue' ? <Spinner /> : <ShieldCheckIcon className="h-5 w-5 mr-2" />}
                    Blue Team Audit
                </button>
                <button onClick={() => handleAudit('red_team')} disabled={loadingState !== 'none' || !decodedJwt} className="group relative w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 hover:shadow-red-500/40">
                    {loadingState === 'red' ? <Spinner /> : <FireIcon className="h-5 w-5 mr-2" />}
                    Red Team Audit
                </button>
            </div>

            {decodedJwt && (
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-8 animate-fade-in">
                    <div>
                        <h4 className="font-semibold text-purple-300 mb-1">Header</h4>
                        <pre className="bg-black/40 p-3 rounded-md font-mono text-xs text-purple-200 overflow-x-auto border border-purple-500/20"><code>{decodedJwt.header}</code></pre>
                    </div>
                    <div>
                        <h4 className="font-semibold text-coral-hover mb-1">Payload / Claims</h4>
                        <pre className="bg-black/40 p-3 rounded-md font-mono text-xs text-coral-hover overflow-x-auto border border-coral/20"><code>{decodedJwt.payload}</code></pre>
                    </div>
                    <div>
                        <h4 className="font-semibold text-orange-400 mb-1">Signature</h4>
                        <pre className="bg-black/40 p-3 rounded-md font-mono text-xs text-orange-300 overflow-x-auto border border-orange-500/20 break-all"><code>{decodedJwt.signature}</code></pre>
                    </div>
                </div>
            )}

            {loadingState !== 'none' && (
                <div className="flex flex-col items-center justify-center text-purple-gray animate-pulse mt-6">
                    <p>AI is performing the {loadingState} team audit (this may take a moment)...</p>
                </div>
            )}

            {(blueTeamResult || redTeamResult) && loadingState === 'none' && (
                <div className="mt-12">
                    <div className="mb-4 pb-4 border-b border-0">
                        <h3 className="text-xl font-semibold text-white">Analysis Report</h3>
                        <div className="mt-4 pt-4 border-t border-0 flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const content = getCurrentResult();
                                    if (!content) return;
                                    const team = activeTab === 'blue' ? 'blue-team' : 'red-team';
                                    const truncatedJwt = sanitizeFilename(encodedJwt.substring(0, 20));
                                    const date = new Date().toISOString().split('T')[0];
                                    triggerDownload(`jwt-audit-${team}-${truncatedJwt}-${date}.md`, content, 'text/markdown;charset=utf-8');
                                }}
                                disabled={!getCurrentResult()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-900/40 border border-purple-700/80 rounded-lg hover:bg-purple-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Download ${activeTab === 'blue' ? 'Blue' : 'Red'} Team report as Markdown`}
                            >
                                <DocumentTextIcon className="h-4 w-4" />
                                Download as Markdown (.md)
                            </button>
                            <button
                                onClick={() => {
                                    const content = getCurrentResult();
                                    if (!content || !decodedJwt) return;
                                    const team = activeTab === 'blue' ? 'blue' : 'red';
                                    const analysisType = activeTab === 'blue' ? 'Defensive Analysis' : 'Attack Surface';
                                    try {
                                        const reportData = {
                                            team,
                                            analysisType,
                                            jwt: encodedJwt,
                                            decoded: { header: JSON.parse(decodedJwt.header), payload: JSON.parse(decodedJwt.payload) },
                                            reportMarkdown: content
                                        };
                                        const truncatedJwt = sanitizeFilename(encodedJwt.substring(0, 20));
                                        const date = new Date().toISOString().split('T')[0];
                                        triggerDownload(`jwt-audit-${team}-${truncatedJwt}-${date}.json`, JSON.stringify(reportData, null, 2), 'application/json;charset=utf-8');
                                    } catch (e) {
                                        console.error("Failed to create JSON report:", e);
                                        setError("Failed to create JSON report. The decoded JWT might not be valid JSON.");
                                    }
                                }}
                                disabled={!getCurrentResult()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-coral-hover bg-purple-elevated/40 border border-coral/80 rounded-lg hover:bg-purple-elevated/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Download report as structured JSON"
                            >
                                <CodeBracketSquareIcon className="h-4 w-4" />
                                Download as JSON (.json)
                            </button>
                        </div>
                    </div>

                    <div className="bg-purple-medium/60/50 p-4 rounded-lg border-0 min-h-[24rem] flex flex-col">
                        <div className="border-b border-0 mb-4">
                            <div className="flex bg-purple-medium/60/50 p-1 rounded-lg border-0 max-w-sm">
                                <button onClick={() => setActiveTab('blue')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'blue' ? 'bg-blue-500/50 text-white' : 'text-muted hover:bg-white/5'}`}>Blue Team</button>
                                <button onClick={() => setActiveTab('red')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'red' ? 'bg-red-500/50 text-white' : 'text-muted hover:bg-white/5'}`}>Red Team</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {activeTab === 'blue' && blueTeamResult && (
                                <div className="animate-fade-in">
                                    <h3 className="text-xl font-bold text-blue-300 mb-4">Blue Team Report: Defensive Analysis</h3>
                                    <MarkdownRenderer content={blueTeamResult} />
                                </div>
                            )}
                            {activeTab === 'red' && redTeamResult && (
                                <div className="animate-fade-in">
                                    <h3 className="text-xl font-bold text-red-300 mb-4">Red Team Report: Attack Surface</h3>
                                    <MarkdownRenderer content={redTeamResult} />
                                </div>
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-0 flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => {
                                    const result = getCurrentResult();
                                    if (result) {
                                        const analysisType = activeTab === 'blue' ? 'JWT Blue Team Audit' : 'JWT Red Team Audit';
                                        onSendReportToAgent(result, analysisType);
                                    }
                                }}
                                disabled={!getCurrentResult()}
                                className="flex-grow flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-coral-hover bg-purple-elevated/40 border border-coral/80 rounded-lg hover:bg-purple-elevated/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Analyze this report with the WebSec Agent"
                            >
                                <ChatIcon className="h-5 w-5" />
                                Analyze with Agent
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToolLayout>
    );
};
