// @author: Albert C | @yz9yt | github.com/yz9yt
// version 0.1 Beta
import React from 'react';
import { ShieldExclamationIcon, HeartIcon } from './Icons.tsx';

interface DisclaimerModalProps {
    onAccept: () => void;
    onReject: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onAccept, onReject }) => {
    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            aria-modal="true"
            role="dialog"
        >
            <div
                className="card-premium w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden"
            >
                <header className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-ui-border bg-ui-bg/50">
                    <div className="p-2 rounded-xl bg-ui-accent/10 border border-ui-accent/20">
                        <ShieldExclamationIcon className="h-4 w-4 text-ui-accent" />
                    </div>
                    <div className="flex flex-col">
                        <span className="label-mini text-ui-accent">Usage Policy</span>
                        <h2 className="title-standard">Disclaimer & Terms of Use</h2>
                    </div>
                </header>

                <main className="p-6 text-ui-text-dim space-y-4 text-sm bg-dashboard-bg/30">
                    <p>This application is provided for <strong className="text-ui-accent">educational and research purposes only</strong>. It uses generative AI to analyze web applications and assist in identifying potential security vulnerabilities.</p>
                    <p className="font-semibold text-ui-text-main/90 bg-ui-bg/40 p-3 rounded-lg border border-ui-border">The AI's output may contain inaccuracies, false positives, or false negatives. It is NOT a substitute for professional security auditing or manual code review.</p>
                    <p className="text-ui-text-main font-bold text-xs uppercase tracking-wider">By using this tool, you acknowledge and agree that:</p>
                    <ul className="space-y-3 pl-2">
                        <li className="flex gap-3">
                            <span className="text-ui-accent mt-1">•</span>
                            <span>You will only test applications for which you have <strong className="text-ui-accent">explicit, written permission</strong> from the owner.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="text-ui-accent mt-1">•</span>
                            <span>You are solely responsible for verifying any findings and for any actions taken based on the tool's output.</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="text-ui-accent mt-1">•</span>
                            <span>The creator of this tool assumes no liability for any misuse or damage caused by this application.</span>
                        </li>
                    </ul>
                </main>

                <footer className="p-4 bg-ui-bg flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-ui-border">
                    <div className="text-[10px] text-ui-text-dim flex items-center gap-1.5 font-mono">
                        MADE WITH <HeartIcon className="h-4 w-4 text-red-500/80 animate-pulse" /> BY ALBERT C @YZ9YT
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onReject}
                            className="btn-mini btn-mini-secondary px-6"
                        >
                            Reject
                        </button>
                        <button
                            onClick={onAccept}
                            className="btn-mini btn-mini-primary px-8"
                        >
                            Accept & Continue
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};