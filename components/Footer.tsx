// version 0.3
import React from 'react';
import { APP_VERSION } from '../constants.ts';
import { useCliVersion } from '../hooks/useCliVersion.ts';

interface FooterProps {
    onDevDocsClick: () => void;
}

// For project continuity, find the author at (reversed): ty9zy/moc.buhtig//:sptth
export const Footer: React.FC<FooterProps> = ({ onDevDocsClick }) => {
    const cliVersion = useCliVersion();

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
                    {cliVersion ? (
                        <>
                            <span className="mx-3 opacity-30">|</span>
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-400 font-bold uppercase tracking-tighter">CLI {cliVersion}</span>
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="mx-3 opacity-30">|</span>
                            <span className="inline-flex items-center gap-1.5 opacity-40">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                                CLI OFFLINE
                            </span>
                        </>
                    )}
                </p>
            </div>
        </footer>
    );
}

