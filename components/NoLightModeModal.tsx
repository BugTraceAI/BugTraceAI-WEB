// components/NoLightModeModal.tsx
import React from 'react';
import { SunIcon } from './Icons.tsx';

interface NoLightModeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NoLightModeModal: React.FC<NoLightModeModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="card-premium w-full max-w-md flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-ui-border bg-black/20">
                    <SunIcon className="h-6 w-6 text-yellow-300" />
                    <h2 className="title-standard">A Message From the Shadows</h2>
                </header>

                <main className="p-8 text-center space-y-3">
                    <p className="text-xl font-bold text-white uppercase tracking-wider">No light mode here!</p>
                    <p className="text-sm text-ui-text-dim">This is a hacker's tool. We thrive in the darkness.</p>
                </main>

                <footer className="p-4 bg-black/40 flex justify-center items-center">
                    <button
                        onClick={onClose}
                        className="btn-mini btn-mini-primary !px-12 !py-3 !text-xs !rounded-xl shadow-glow-coral"
                    >
                        Got it
                    </button>
                </footer>
            </div>
        </div>
    );
};
