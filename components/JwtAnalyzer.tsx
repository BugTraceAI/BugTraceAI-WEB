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
                <label htmlFor="jwt-input" className="label-mini mb-2 block">Encoded JWT Payload</label>
                <textarea
                    id="jwt-input"
                    value={encodedJwt}
                    onChange={e => setEncodedJwt(e.target.value)}
                    placeholder="ey...[header]....ey...[payload]....[signature]"
                    className="input-premium w-full h-40 p-5 font-mono text-xs resize-y transition-all duration-300 shadow-inner"
                />
                {error && <p className="text-red-400 text-xs mt-2 font-mono flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                    {error}
                </p>}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                    onClick={() => handleAudit('blue_team')}
                    disabled={loadingState !== 'none' || !decodedJwt}
                    className="btn-mini !bg-blue-500/10 !border-blue-500/40 !text-blue-400 hover:!bg-blue-500/20 !py-4 px-8 !rounded-2xl gap-3 group shadow-glow-blue/10"
                >
                    {loadingState === 'blue' ? <Spinner /> : <ShieldCheckIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                    BLUE TEAM AUDIT
                </button>
                <button
                    onClick={() => handleAudit('red_team')}
                    disabled={loadingState !== 'none' || !decodedJwt}
                    className="btn-mini !bg-red-500/10 !border-red-500/40 !text-red-400 hover:!bg-red-500/20 !py-4 px-8 !rounded-2xl gap-3 group shadow-glow-coral/10"
                >
                    {loadingState === 'red' ? <Spinner /> : <FireIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                    RED TEAM AUDIT
                </button>
            </div>

            {decodedJwt && (
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-8 animate-fade-in">
                    <div>
                        <h4 className="label-mini !text-blue-400 mb-2">JWT HEADER</h4>
                        <pre className="bg-black/40 p-4 rounded-xl font-mono text-[10px] text-blue-300/80 overflow-x-auto border border-blue-500/10"><code>{decodedJwt.header}</code></pre>
                    </div>
                    <div>
                        <h4 className="label-mini !text-ui-accent mb-2">CLAIMS PAYLOAD</h4>
                        <pre className="bg-black/40 p-4 rounded-xl font-mono text-[10px] text-ui-accent/80 overflow-x-auto border border-ui-accent/10"><code>{decodedJwt.payload}</code></pre>
                    </div>
                    <div>
                        <h4 className="label-mini !text-orange-400 mb-2">SIGNATURE DATA</h4>
                        <pre className="bg-black/40 p-4 rounded-xl font-mono text-[10px] text-orange-300/80 overflow-x-auto border border-orange-500/10 break-all"><code>{decodedJwt.signature}</code></pre>
                    </div>
                </div>
            )}

            {loadingState !== 'none' && (
                <div className="flex flex-col items-center justify-center text-ui-text-dim animate-pulse mt-8 space-y-2">
                    <div className="w-12 h-1 bg-ui-accent/20 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-ui-accent animate-scan-slow" />
                    </div>
                    <p className="label-mini !text-[9px]">AI is performing {loadingState} team audit intelligence sync...</p>
                </div>
            )}

            {(blueTeamResult || redTeamResult) && loadingState === 'none' && (
                <div className="mt-12">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <span className="label-mini !text-ui-accent block mb-1">Intelligence Report</span>
                            <h3 className="title-standard !text-2xl">Forensic Audit Results</h3>
                        </div>
                        <div className="flex items-center gap-2">
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
                                className="btn-mini btn-mini-secondary !h-10 !px-4 gap-2"
                                title={`Download ${activeTab === 'blue' ? 'Blue' : 'Red'} Team report as Markdown`}
                            >
                                <DocumentTextIcon className="h-4 w-4" />
                                MARKDOWN
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
                                className="btn-mini btn-mini-secondary !h-10 !px-4 gap-2"
                                title="Download report as structured JSON"
                            >
                                <CodeBracketSquareIcon className="h-4 w-4" />
                                JSON LOG
                            </button>
                        </div>
                    </div>

                    <div className="card-premium p-6 sm:p-8 flex flex-col !bg-ui-bg/40">
                        <div className="flex bg-ui-input-bg/40 p-1.5 rounded-2xl border border-ui-border self-start mb-8 min-w-[300px]">
                            <button
                                onClick={() => setActiveTab('blue')}
                                className={`w-1/2 h-9 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'blue' ? 'bg-blue-500 text-ui-bg shadow-glow-blue/20' : 'text-ui-text-dim hover:text-ui-text-main hover:bg-white/5'}`}
                            >
                                Defensive Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('red')}
                                className={`w-1/2 h-9 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === 'red' ? 'bg-red-500 text-ui-bg shadow-glow-coral' : 'text-ui-text-dim hover:text-ui-text-main hover:bg-white/5'}`}
                            >
                                Attack Surface
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[400px]">
                            {activeTab === 'blue' && blueTeamResult && (
                                <div className="animate-fade-in">
                                    <h3 className="label-mini !text-blue-400 mb-6">DEFENSIVE COMPLIANCE REPORT</h3>
                                    <div className="prose-v3">
                                        <MarkdownRenderer content={blueTeamResult} />
                                    </div>
                                </div>
                            )}
                            {activeTab === 'red' && redTeamResult && (
                                <div className="animate-fade-in">
                                    <h3 className="label-mini !text-red-400 mb-6">ATTACK VECTOR DISCOVERY</h3>
                                    <div className="prose-v3">
                                        <MarkdownRenderer content={redTeamResult} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-ui-border">
                            <button
                                onClick={() => {
                                    const result = getCurrentResult();
                                    if (result) {
                                        const analysisType = activeTab === 'blue' ? 'JWT Blue Team Audit' : 'JWT Red Team Audit';
                                        onSendReportToAgent(result, analysisType);
                                    }
                                }}
                                disabled={!getCurrentResult()}
                                className="btn-mini btn-mini-primary !h-12 !w-full !rounded-xl gap-3 shadow-glow-coral"
                                title="Analyze this report with the WebSec Agent"
                            >
                                <ChatIcon className="h-5 w-5" />
                                DEEP ANALYZE MISSION INTEL WITH AI AGENT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToolLayout>
    );
};
