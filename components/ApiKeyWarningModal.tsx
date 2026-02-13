// components/ApiKeyWarningModal.tsx
import React from 'react';
import { CogIcon, ShieldExclamationIcon } from './Icons.tsx';

interface ApiKeyWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoToSettings: () => void;
}

export const ApiKeyWarningModal: React.FC<ApiKeyWarningModalProps> = ({ isOpen, onClose, onGoToSettings }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="card-premium w-full max-w-lg shadow-2xl shadow-ui-accent/10 flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-ui-border bg-ui-bg/50">
                    <div className="p-2 rounded-xl bg-ui-accent/10 border border-ui-accent/20">
                        <ShieldExclamationIcon className="h-4 w-4 text-ui-accent" />
                    </div>
                    <div className="flex flex-col">
                        <span className="label-mini text-ui-accent">Configuration Required</span>
                        <h2 className="title-standard">API Key Required</h2>
                    </div>
                </header>

                <main className="p-8 text-center bg-dashboard-bg/30">
                    <p className="text-base text-ui-text-main font-semibold">An API key is required to use this feature.</p>
                    <p className="mt-2 text-xs text-ui-text-dim">Please configure your OpenRouter API key in the settings menu to proceed with AI-powered analysis.</p>
                </main>

                <footer className="p-4 bg-ui-bg/80 flex justify-end items-center gap-3 border-t border-ui-border">
                    <button
                        onClick={onClose}
                        className="btn-mini btn-mini-secondary px-6"
                    >
                        Dismiss
                    </button>
                    <button
                        onClick={onGoToSettings}
                        className="btn-mini btn-mini-primary px-6 gap-2"
                    >
                        <CogIcon className="h-3.5 w-3.5" />
                        Go to Settings
                    </button>
                </footer>
            </div>
        </div>
    );
};