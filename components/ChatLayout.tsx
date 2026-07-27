// components/ChatLayout.tsx
// Clean layout component for chat interfaces - ChatGPT-inspired minimal design
import React, { useEffect, useRef } from 'react';

interface ChatLayoutProps {
    header: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ header, children, footer }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom whenever children (messages) change
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [children]);

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            {/* Minimal header */}
            <header className="flex-shrink-0 px-4 py-3 border-b border-white/5">
                {header}
            </header>

            {/* Chat area - centered content column */}
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                    {children}
                </div>
            </main>

            {/* Footer with input - centered */}
            <footer className="flex-shrink-0 pb-6 pt-2 px-4">
                <div className="max-w-3xl mx-auto">
                    {footer}
                </div>
            </footer>
        </div>
    );
};
