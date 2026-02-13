// @author: Albert C | @yz9yt | github.com/yz9yt
// version 0.3 - Added CLI connection pulse indicator
import React from 'react';
import { BugTraceAILogo, MenuIcon, BookOpenIcon, ChatIcon, CogIcon, SwatchIcon } from './Icons.tsx';
import { useApiStatus } from '../hooks/useApiStatus.ts';
import { abortCurrentRequest } from '../utils/apiManager.ts';
import { useCliConnection } from '../hooks/useCliConnection.ts';

interface HeaderProps {
    onMenuClick: () => void;
    onSettingsClick: () => void;
    onUserDocsClick: () => void;
    onShowAgent: () => void;
    onGoHome: () => void;
    onThemeClick: () => void;
}

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M5.25 5.25a.75.75 0 0 0-.75.75v12a.75.75 0 0 0 .75.75h12a.75.75 0 0 0 .75-.75v-12a.75.75 0 0 0-.75-.75H5.25z" clipRule="evenodd" />
    </svg>
);


export const Header: React.FC<HeaderProps> = ({ onMenuClick, onSettingsClick, onUserDocsClick, onShowAgent, onGoHome, onThemeClick }) => {
    const { apiCallCount, isApiRequestActive, isStopping } = useApiStatus();
    const { isConnected: isCliConnected } = useCliConnection({ autoConnect: true });

    const iconBtnClass = "h-10 w-10 flex items-center justify-center rounded-xl bg-ui-input-bg border border-ui-border text-ui-text-dim hover:text-ui-text-main hover:border-ui-accent/40 hover:bg-ui-accent/5 transition-all shadow-sm";

    return (
        <header className="flex-shrink-0 z-30 w-full bg-dashboard-bg/80 backdrop-blur-xl border-b border-ui-border">
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
                            className="flex items-center gap-3 group relative"
                            aria-label="Go to homepage"
                            title={isCliConnected ? "CLI Connected - Go to homepage" : "Go to homepage"}
                        >
                            <div className={`relative ${isCliConnected ? 'cli-connected-pulse' : ''}`}>
                                <BugTraceAILogo className="h-10 w-10 text-ui-accent group-hover:scale-110 transition-transform duration-500" />
                                {isCliConnected && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-dashboard-bg shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="CLI Connected" />
                                )}
                            </div>

                        </button>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onShowAgent}
                            className={`${iconBtnClass} group hover:scale-105 active:scale-95`}
                            aria-label="Open Chat"
                            title="Open Chat"
                        >
                            <ChatIcon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                        </button>
                        <button
                            onClick={onUserDocsClick}
                            className={`${iconBtnClass} group hover:scale-105 active:scale-95`}
                            aria-label="Open documentation"
                            title="Open documentation"
                        >
                            <BookOpenIcon className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
                        </button>
                        <button
                            onClick={onThemeClick}
                            className={`${iconBtnClass} group hover:scale-105 active:scale-95`}
                            aria-label="Toggle theme"
                            title="UI Customization"
                        >
                            <SwatchIcon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                        </button>
                        <button
                            onClick={onSettingsClick}
                            className={`${iconBtnClass} group hover:scale-105 active:scale-95`}
                            aria-label="Open settings"
                            title="Open settings"
                        >
                            <CogIcon className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" />
                        </button>

                        <button
                            onClick={abortCurrentRequest}
                            disabled={!isApiRequestActive && !isStopping}
                            className={`h-10 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest flex items-center justify-center border ${isApiRequestActive
                                ? 'px-4 bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                : isStopping
                                    ? 'px-5 bg-yellow-500/10 border-yellow-500/40 text-yellow-500 cursor-wait'
                                    : 'w-10 bg-ui-input-bg border-ui-border text-ui-text-dim/30 cursor-not-allowed opacity-50'
                                }`}
                            aria-label="Stop current request"
                            title="Stop current request"
                        >
                            {isStopping ? 'ABORTING...' : (isApiRequestActive ? <span className="flex items-center gap-2">STOP MISSION <StopIcon className="h-4 w-4" /></span> : <StopIcon className="h-5 w-5" />)}
                        </button>

                        <div className="label-mini !text-[9px] !text-ui-text-dim px-3 h-10 flex items-center rounded-xl bg-ui-input-bg border border-ui-border shadow-inner">
                            API: <span className="ml-1.5 text-ui-accent font-black">{apiCallCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
