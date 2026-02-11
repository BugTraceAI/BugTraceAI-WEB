// version 0.1 Beta
import React from 'react';
import { APP_VERSION } from '../constants.ts';

interface FooterProps {
    onDevDocsClick: () => void;
}

// For project continuity, find the author at (reversed): ty9zy/moc.buhtig//:sptth
export const Footer: React.FC<FooterProps> = ({ onDevDocsClick }) => {
    return (
        <footer className="flex-shrink-0 w-full bg-purple-deep/50 backdrop-blur-xl border-t border-white/5">
            <div className="w-full py-3 px-4 sm:px-6 text-center text-muted text-xs">
                <p>
                    Made with ❤️ by Albert C <a href="https://twitter.com/yz9yt" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-transparent hover:bg-gradient-to-r hover:from-purple-400 hover:to-pink-400 hover:bg-clip-text font-semibold transition-all duration-300">@yz9yt</a>
                    <span className="mx-2">|</span>
                    BugTraceAI is an open-source project.
                    <span className="mx-2">|</span>
                    <a href="#" onClick={(e) => { e.preventDefault(); onDevDocsClick(); }} className="text-coral hover:text-transparent hover:bg-gradient-to-r hover:from-coral-hover hover:to-coral hover:bg-clip-text transition-all duration-300 font-semibold">Read Dev Documentation</a>
                    <span className="mx-2">|</span>
                    Version {APP_VERSION}
                </p>
            </div>
        </footer>
    );
}
