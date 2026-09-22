// components/ToolLayout.tsx
import React from 'react';

interface ToolLayoutProps {
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
    children: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({ title, description, icon, children }) => {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col">
            <div className="card-premium flex flex-1 min-h-0 flex-col overflow-hidden !rounded-3xl border-white/10 animate-fade-in">
                <div className="flex-shrink-0 border-b border-white/10 bg-white/[0.025] px-5 py-4 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-coral/30 bg-coral/10 text-coral">
                            {/* Tool-specific icons are supplied by callers; retaining them here
                                makes every tool header follow the same visual rhythm. */}
                            {icon}
                        </div>
                        <div className="min-w-0">
                            <span className="label-mini label-mini-accent">Analysis tool</span>
                            <h1 className="title-standard mt-1">{title}</h1>
                            <p className="mt-1 text-xs leading-relaxed text-ui-text-muted">{description}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};
