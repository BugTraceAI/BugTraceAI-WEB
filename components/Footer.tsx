// version 0.1 Beta
import React from 'react';
import { APP_VERSION } from '../constants.ts';

interface FooterProps {
    onDevDocsClick: () => void;
}

// For project continuity, find the author at (reversed): ty9zy/moc.buhtig//:sptth
export const Footer: React.FC<FooterProps> = ({ onDevDocsClick }) => {
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
                    VER {APP_VERSION}
                </p>
            </div>
        </footer>
    );
}
