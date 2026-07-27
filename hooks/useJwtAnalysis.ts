// @author: Albert C | @yz9yt | github.com/yz9yt
// hooks/useJwtAnalysis.ts
// version 0.1 Beta
import { useState, useEffect, useCallback } from 'react';
import { analyzeJwt } from '../services/Service.ts';
import { VulnerabilityReport, Severity, ApiOptions, Vulnerability } from '../types.ts';

// --- Utility Functions ---

// Base64URL to regular base64
const base64UrlDecode = (str: string): string => {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
        case 0: break;
        case 2: output += '=='; break;
        case 3: output += '='; break;
        default: throw new Error('Illegal base64url string!');
    }
    try {
        return decodeURIComponent(atob(output).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    } catch (e) {
        return atob(output); // Fallback for non-UTF8 strings
    }
};

const formatJson = (jsonString: string): string => {
    try {
        return JSON.stringify(JSON.parse(jsonString), null, 2);
    } catch {
        return "Invalid JSON content";
    }
};

// --- Types ---

export interface DecodedJwt {
    header: string;
    payload: string;
    signature: string;
}

interface UseJwtAnalysisProps {
    initialToken: string | null;
    report: VulnerabilityReport | null;
    onTokenConsumed: () => void;
    onAnalysisComplete: (report: VulnerabilityReport) => void;
    apiOptions: ApiOptions | null;
    isApiKeySet: boolean;
    onShowApiKeyWarning: () => void;
    saveAnalysis?: (
        type: 'url_analysis' | 'code_analysis' | 'jwt_analysis' | 'security_headers' | 'file_upload',
        target: string,
        vulnerabilities: Vulnerability[],
        metadata?: { model?: string; scan_config?: any },
        sessionId?: string
    ) => Promise<any>;
}

export function useJwtAnalysis({
    initialToken,
    report,
    onTokenConsumed,
    onAnalysisComplete,
    apiOptions,
    isApiKeySet,
    onShowApiKeyWarning,
    saveAnalysis,
}: UseJwtAnalysisProps) {
    const [encodedJwt, setEncodedJwt] = useState(initialToken || '');
    const [decodedJwt, setDecodedJwt] = useState<DecodedJwt | null>(null);
    const [loadingState, setLoadingState] = useState<'none' | 'blue' | 'red'>('none');
    const [error, setError] = useState<string | null>(null);
    const [blueTeamResult, setBlueTeamResult] = useState<string | null>(null);
    const [redTeamResult, setRedTeamResult] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'blue' | 'red'>('blue');

    // Handle initial token consumption
    useEffect(() => {
        if (initialToken) {
            setEncodedJwt(initialToken);
            onTokenConsumed();
        }
    }, [initialToken, onTokenConsumed]);

    // Restore state from report history
    useEffect(() => {
        if (report && report.analyzedTarget.startsWith('JWT Analysis')) {
            const historyVuln = report.vulnerabilities[0];
            if (historyVuln) {
                setEncodedJwt(historyVuln.vulnerableCode);
                const [blueContent, redContent] = historyVuln.description.split('--- \n\n ---');

                const hasBlue = blueContent && !blueContent.includes('not yet performed');
                const hasRed = redContent && !redContent.includes('not yet performed');

                setBlueTeamResult(hasBlue ? blueContent : null);
                setRedTeamResult(hasRed ? redContent : null);

                if (hasBlue) {
                    setActiveTab('blue');
                } else if (hasRed) {
                    setActiveTab('red');
                } else {
                    setActiveTab('blue');
                }

                setError(null);
            }
        }
        else if (!initialToken) {
            setBlueTeamResult(null);
            setRedTeamResult(null);
            setError(null);
        }
    }, [report, initialToken]);

    // Decode JWT whenever it changes
    const tryDecodeJwt = useCallback((jwt: string) => {
        if (jwt.trim()) {
            const parts = jwt.split('.');
            if (parts.length === 3) {
                try {
                    const header = formatJson(base64UrlDecode(parts[0]));
                    const payload = formatJson(base64UrlDecode(parts[1]));
                    const signature = parts[2];
                    setDecodedJwt({ header, payload, signature });
                    setError(null);
                } catch (e: any) {
                    setDecodedJwt(null);
                    setError("Invalid JWT: Malformed Base64URL content.");
                }
            } else {
                setDecodedJwt(null);
                if (jwt.trim().length > 0) {
                    setError("Invalid JWT: Must contain 3 parts separated by dots.");
                }
            }
        } else {
            setDecodedJwt(null);
            setError(null);
        }
    }, []);

    useEffect(() => {
        tryDecodeJwt(encodedJwt);
    }, [encodedJwt, tryDecodeJwt]);

    // Perform Blue or Red Team audit
    const handleAudit = useCallback(async (mode: 'blue_team' | 'red_team') => {
        if (!isApiKeySet) {
            onShowApiKeyWarning();
            return;
        }
        if (!decodedJwt) {
            setError("Cannot analyze an invalid or empty JWT.");
            return;
        }
        setError(null);
        setLoadingState(mode === 'blue_team' ? 'blue' : 'red');

        try {
            const headerObj = JSON.parse(decodedJwt.header);
            const payloadObj = JSON.parse(decodedJwt.payload);

            const result = await analyzeJwt(headerObj, payloadObj, mode, apiOptions!);

            let newBlueResult = blueTeamResult;
            let newRedResult = redTeamResult;

            if (mode === 'blue_team') {
                setBlueTeamResult(result);
                newBlueResult = result;
                setActiveTab('blue');
            } else {
                setRedTeamResult(result);
                newRedResult = result;
                setActiveTab('red');
            }

            const combinedDescription = `${newBlueResult || 'Blue Team analysis not yet performed.'}\n\n--- \n\n ---${newRedResult || 'Red Team analysis not yet performed.'}`;

            const reportForHistory: VulnerabilityReport = {
                analyzedTarget: `JWT Analysis: ${encodedJwt.substring(0, 20)}...`,
                vulnerabilities: [{
                    vulnerability: `JWT Security Audit (Blue & Red Team)`,
                    severity: Severity.INFO,
                    description: combinedDescription,
                    impact: "The impact varies based on the findings. Refer to the full report.",
                    recommendation: "Review the full analysis report for detailed recommendations.",
                    vulnerableCode: encodedJwt,
                }]
            };
            onAnalysisComplete(reportForHistory);

            // Save to database for history
            if (saveAnalysis) {
                try {
                    console.log('[JWT] Saving analysis to history...');
                    await saveAnalysis(
                        'jwt_analysis',
                        `JWT: ${encodedJwt.substring(0, 30)}...`,
                        reportForHistory.vulnerabilities,
                        {
                            model: apiOptions?.model,
                            scan_config: {
                                audit_type: mode,
                                jwt_preview: encodedJwt.substring(0, 50)
                            }
                        }
                    );
                    console.log('[JWT] Analysis saved successfully');
                } catch (saveError: any) {
                    console.error('[JWT] Failed to save analysis:', saveError?.response?.data || saveError?.message || saveError);
                }
            } else {
                console.warn('[JWT] saveAnalysis function not available');
            }

        } catch (e: any) {
            setError(e.message || "An unexpected error occurred during analysis.");
        } finally {
            setLoadingState('none');
        }
    }, [decodedJwt, encodedJwt, onAnalysisComplete, apiOptions, isApiKeySet, onShowApiKeyWarning, blueTeamResult, redTeamResult, saveAnalysis]);

    // Get current active result
    const getCurrentResult = useCallback(() => {
        return activeTab === 'blue' ? blueTeamResult : redTeamResult;
    }, [activeTab, blueTeamResult, redTeamResult]);

    return {
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
    };
}
