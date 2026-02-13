// components/ChatBubble.tsx
// Clean chat message component - ChatGPT-inspired minimal design
import React from 'react';
import { ChatMessage } from '../contexts/ChatContext';
import { AiBrainIcon } from './Icons.tsx';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';

interface ChatBubbleProps {
    message: ChatMessage;
    isLoading?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isLoading }) => {
    const isAssistant = message.role === 'assistant';
    const isError = message.role === 'error';

    if (isAssistant || isError) {
        // Assistant / Error messages - left aligned with avatar
        return (
            <div className="flex gap-4 items-start group animate-fade-in pl-2">
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1 border border-white/5 shadow-sm ${isError ? 'bg-red-500/10' : 'bg-gradient-to-br from-coral/10 to-purple-elevated/10'}`}>
                    <AiBrainIcon className={`h-5 w-5 ${isError ? 'text-red-400' : 'text-coral'}`} />
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0 overflow-hidden py-1">
                    <div className={`text-[15px] leading-7 overflow-x-auto overflow-y-hidden break-words ${isError ? 'text-red-300' : 'text-white'}`}>
                        {isLoading ? (
                            <div className="flex items-center gap-1 my-2">
                                <div className="h-2 w-2 bg-coral/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-2 w-2 bg-coral/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-2 w-2 bg-coral/50 rounded-full animate-bounce"></div>
                            </div>
                        ) : (
                            <MarkdownRenderer content={message.content} />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // User messages - right aligned with subtle background
    return (
        <div className="flex justify-end animate-fade-in">
            <div className="max-w-[85%] bg-coral/10 border border-coral/10 rounded-2xl rounded-tr-md px-5 py-3 shadow-[0_0_15px_-5px_rgba(6,182,212,0.1)]">
                <div className="text-[15px] leading-relaxed text-off-white whitespace-pre-wrap break-words overflow-hidden">
                    {message.content}
                </div>
            </div>
        </div>
    );
};
