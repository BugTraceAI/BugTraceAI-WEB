// components/DevDocumentationModal.tsx
import React from 'react';
import { XMarkIcon, BookOpenIcon } from './Icons.tsx';

interface DevDocumentationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DevDocumentationModal: React.FC<DevDocumentationModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-purple-medium/50 backdrop-blur-xl border-0 rounded-2xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex justify-between items-center p-4 bg-purple-deep/60 backdrop-blur-xl border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-coral/10 border border-coral/20">
                            <BookOpenIcon className="h-4 w-4 text-coral" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-coral opacity-70">Internal Docs</span>
                            <h2 className="text-sm font-bold text-off-white">Developer Documentation</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-purple-gray hover:text-white hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-white/10" title="Close documentation">
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </header>

                <main className="flex-1 bg-gray-800/20">
                    <iframe
                        src="/devinfo/devinfo.html"
                        title="Developer Documentation"
                        className="w-full h-full border-none"
                    />
                </main>
            </div>
        </div>
    );
};