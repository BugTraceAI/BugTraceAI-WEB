// @author: Albert C | @yz9yt | github.com/yz9yt
// version 0.3 - Added CLI connection pulse indicator
import React from 'react';
import { BugTraceAILogo, MenuIcon, BookOpenIcon, ChatIcon, CogIcon, SunIcon } from './Icons.tsx';
import { useApiStatus } from '../hooks/useApiStatus.ts';
import { abortCurrentRequest } from '../utils/apiManager.ts';
import { useCliConnection } from '../hooks/useCliConnection.ts';

interface HeaderProps {
    onMenuClick: () => void;
    onSettingsClick: () => void;
    onUserDocsClick: () => void;
    onShowAgent: () => void;
    onGoHome: () => void;
    onLightModeClick: () => void;
}

const StopIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M5.25 5.25a.75.75 0 0 0-.75.75v12a.75.75 0 0 0 .75.75h12a.75.75 0 0 0 .75-.75v-12a.75.75 0 0 0-.75-.75H5.25z" clipRule="evenodd" />
    </svg>
);


export const Header: React.FC<HeaderProps> = ({ onMenuClick, onSettingsClick, onUserDocsClick, onShowAgent, onGoHome, onLightModeClick }) => {
    const { apiCallCount, isApiRequestActive, isStopping } = useApiStatus();
    const { isConnected: isCliConnected } = useCliConnection({ autoConnect: true });

    const iconBtnClass = "p-2 rounded-xl bg-purple-medium/50 border border-white/5 text-purple-gray hover:text-white hover:bg-purple-light/50 transition-all duration-500";

    return (
        <header className="flex-shrink-0 z-30 w-full bg-purple-deep/50 backdrop-blur-xl border-b border-white/5">
            <div className="w-full px-4 sm:px-6">
                <div className="flex items-center justify-between h-14">
                    {/* Left side */}
                    <div className="flex items-center gap-3">
                        {/* Hamburger button */}
                        <button
                            onClick={onMenuClick}
                            className={`${iconBtnClass} hover:scale-105 active:scale-95`}
                            aria-label="Toggle menu"
                            title="Toggle menu"
                        >
                            <MenuIcon className="h-5 w-5" />
                        </button>
                        {/* Logo with CLI connection indicator */}
                        <button
                            onClick={onGoHome}
                            className="flex items-center gap-2 group relative"
                            aria-label="Go to homepage"
                            title={isCliConnected ? "CLI Connected - Go to homepage" : "Go to homepage"}
                        >
                            <div className={isCliConnected ? 'cli-connected-pulse' : ''}>
                                <BugTraceAILogo className="h-10 w-10 text-coral group-hover:scale-110 transition-transform duration-300" />
                            </div>
                            {isCliConnected && (
                                <span className="absolute -top-1 left-7 w-3 h-3 bg-red-500 rounded-full border-2 border-purple-deep" title="CLI Connected" />
                            )}
                            <span className="text-lg font-bold bg-gradient-to-r from-coral to-coral-hover bg-clip-text text-transparent hidden sm:block">BugTraceAI</span>
                        </button>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onShowAgent}
                            className={iconBtnClass}
                            aria-label="Open Chat"
                            title="Open Chat"
                        >
                            <ChatIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={onUserDocsClick}
                            className={iconBtnClass}
                            aria-label="Open documentation"
                            title="Open documentation"
                        >
                            <BookOpenIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={onLightModeClick}
                            className={iconBtnClass}
                            aria-label="Toggle light mode"
                            title="Light Mode"
                        >
                            <SunIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={onSettingsClick}
                            className={iconBtnClass}
                            aria-label="Open settings"
                            title="Open settings"
                        >
                            <CogIcon className="h-5 w-5" />
                        </button>

                        <button
                            onClick={abortCurrentRequest}
                            disabled={!isApiRequestActive && !isStopping}
                            className={`rounded-xl transition-all duration-200 text-sm font-semibold flex items-center justify-center border ${
                                isApiRequestActive
                                ? 'p-2 bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 animate-pulse'
                                : isStopping
                                ? 'px-4 py-2 bg-yellow-500/20 border-yellow-500/30 text-yellow-400 cursor-wait'
                                : 'p-2 bg-purple-medium/30 border-0 text-muted cursor-not-allowed'
                            }`}
                            aria-label="Stop current request"
                            title="Stop current request"
                        >
                            {isStopping ? 'Stopping...' : <StopIcon className="h-5 w-5" />}
                        </button>

                        <div className="text-[10px] text-purple-gray font-mono px-2.5 py-1.5 rounded-xl bg-purple-medium/50 border border-white/5">
                            API: {apiCallCount}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
