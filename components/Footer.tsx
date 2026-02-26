// version 0.2
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
        <footer className="flex-shrink-0 w-full bg-dashboard-bg/90 backdrop-blur-3xl border-t border-ui-border">
            <div className="w-full py-4 px-6 text-center">
                <p className="label-mini !text-[9px] !text-ui-text-dim/60 tracking-[0.2em]">
                    Made with ❤️ by Albert C <a href="https://twitter.com/yz9yt" target="_blank" rel="noopener noreferrer" className="text-ui-accent hover:underline font-black transition-all">@yz9yt</a>
                    <span className="mx-3 opacity-30">|</span>
                    BugTraceAI is an open-source project
                    <span className="mx-3 opacity-30">|</span>
                    <button onClick={(e) => { e.preventDefault(); onDevDocsClick(); }} className="text-ui-accent hover:underline font-black transition-all">READ DEV DOCS</button>
                    <span className="mx-3 opacity-30">|</span>
                    WEB {APP_VERSION}
                    {cliVersion ? (
                        <>
                            <span className="mx-1 opacity-30">·</span>
                            <span className="inline-flex items-center gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                CLI {cliVersion}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="mx-1 opacity-30">·</span>
                            <span className="inline-flex items-center gap-1 opacity-40">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                                CLI offline
                            </span>
                        </>
                    )}
                </p>
            </div>
        </footer>
    );
}

