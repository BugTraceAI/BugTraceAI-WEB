// version 0.4 — Enhanced with CLI health diagnostics
import React, { useState } from 'react';
import { APP_VERSION } from '../constants.ts';
import { useCliHealth, CliHealthStatus } from '../hooks/useCliHealth.ts';

interface FooterProps {
    onDevDocsClick: () => void;
}

/**
 * Status dot color + label based on engine health.
 */
function getStatusIndicator(health: CliHealthStatus) {
    switch (health.status) {
        case 'healthy':
            return {
                dotClass: 'bg-emerald-400 animate-pulse',
                badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
                textClass: 'text-emerald-400',
                label: `CLI ${health.version}`,
            };
        case 'degraded':
            return {
                dotClass: 'bg-amber-400 animate-pulse',
                badgeBg: 'bg-amber-500/10 border-amber-500/20',
                textClass: 'text-amber-400',
                label: `CLI ${health.version} ⚠`,
            };
        case 'misconfigured':
            return {
                dotClass: 'bg-red-400 animate-pulse',
                badgeBg: 'bg-red-500/10 border-red-500/20',
                textClass: 'text-red-400',
                label: `CLI ${health.version} — MISCONFIGURED`,
            };
        case 'offline':
        default:
            return {
                dotClass: 'bg-red-400',
                badgeBg: '',
                textClass: '',
                label: 'CLI OFFLINE',
            };
    }
}

// For project continuity, find the author at (reversed): ty9zy/moc.buhtig//:sptth
export const Footer: React.FC<FooterProps> = ({ onDevDocsClick }) => {
    const health = useCliHealth();
    const [showWarnings, setShowWarnings] = useState(false);

    const indicator = getStatusIndicator(health);
    const hasWarnings = health.warnings.length > 0;

    return (
        <footer className="flex-shrink-0 w-full bg-dashboard-bg/90 backdrop-blur-3xl border-t border-white/[0.05]">
            <div className="w-full py-4 px-6 text-center">
                <p className="label-mini !text-[9px] !text-ui-text-dim/60 tracking-[0.2em] font-medium">
                    © 2026 BUGTRACEAI — ADVANCED SECURITY OPERATIONS
                    <span className="mx-3 opacity-30">|</span>
                    MAINTAINED BY <a href="https://twitter.com/yz9yt" target="_blank" rel="noopener noreferrer" className="text-ui-accent hover:underline font-black transition-all">@YZ9YT</a>
                    <span className="mx-3 opacity-30">|</span>
                    <button onClick={(e) => { e.preventDefault(); onDevDocsClick(); }} className="text-ui-accent hover:underline font-black transition-all">DEV PORTAL</button>
                    <span className="mx-3 opacity-30">|</span>
                    VERSION {APP_VERSION}
                    <span className="mx-3 opacity-30">|</span>
                    {health.status !== 'offline' ? (
                        <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${indicator.badgeBg} ${hasWarnings ? 'cursor-pointer' : ''}`}
                            onClick={() => hasWarnings && setShowWarnings(!showWarnings)}
                            title={hasWarnings ? 'Click to see warnings' : `Engine healthy — ${health.provider}`}
                        >
                            <span className={`inline-block w-1 h-1 rounded-full ${indicator.dotClass}`} />
                            <span className={`${indicator.textClass} font-bold uppercase tracking-tighter`}>
                                {indicator.label}
                            </span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 opacity-40">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${indicator.dotClass}`} />
                            {indicator.label}
                        </span>
                    )}
                </p>

                {/* Warning banner — shown when user clicks the amber/red status badge */}
                {showWarnings && hasWarnings && (
                    <div className="mt-2 mx-auto max-w-2xl bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-2 text-left">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-red-400 text-[10px] font-bold tracking-wider uppercase">⚠ Engine Warnings</span>
                            <button
                                onClick={() => setShowWarnings(false)}
                                className="text-red-400/60 hover:text-red-400 text-xs"
                            >✕</button>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5">
                            {health.warnings.map((w, i) => (
                                <li key={i} className="text-red-300/80 text-[10px]">{w}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </footer>
    );
}
