// components/ToolLayout.tsx
import React from 'react';

interface ToolLayoutProps {
    icon: React.ReactNode;
    title: string;
    description: React.ReactNode;
    children: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({ title, description, children }) => {
    return (
        <div className="max-w-[90%] mx-auto w-full flex flex-col flex-1 min-h-0">
            <div className="bg-purple-medium/30 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-xl animate-fade-in flex flex-col flex-1 min-h-0">
                {/* Compact header */}
                <div className="flex-shrink-0 px-6 py-3 sm:px-8 border-b border-white/5">
                    <h1 className="text-lg font-bold tracking-tight text-white">
                        {title}
                        <span className="text-sm text-purple-gray ml-3 font-normal hidden sm:inline">
                            {description}
                        </span>
                    </h1>
                    <p className="text-xs text-purple-gray mt-0.5 sm:hidden">{description}</p>
                </div>

                {/* Scrollable content area */}
                <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};
