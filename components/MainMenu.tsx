// @author: Albert C | @yz9yt | github.com/yz9yt
// components/MainMenu.tsx
// version 0.5 - Use global CLI connection context for availability
import React from 'react';
import { View } from '../types.ts';
import { BugTraceAILogo, BrainIcon, HistoryIcon, XMarkIcon, LinkIcon, CodeBracketIcon, ChatIcon, ArrowUpTrayIcon, KeyIcon, PencilDocumentIcon, JwtTokenIcon, MagnifyingGlassIcon } from './Icons.tsx';
import { useSettings } from '../contexts/SettingsProvider.tsx';

interface MainMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
  activeView: View;
}

const toolViews = [
  { id: View.WEB_SEC_AGENT, name: 'Chat', icon: <ChatIcon className="h-5 w-5" />, color: 'text-coral' },
  { id: View.URL_ANALYSIS, name: 'URL Analysis', icon: <LinkIcon className="h-5 w-5" />, color: 'text-purple-400' },
  { id: View.CODE_ANALYSIS, name: 'Code Analysis', icon: <CodeBracketIcon className="h-5 w-5" />, color: 'text-purple-400' },
  { id: View.PAYLOAD_TOOLS, name: 'Payload Tools', icon: <PencilDocumentIcon className="h-5 w-5" />, color: 'text-pink-400' },
  { id: View.JWT_ANALYZER, name: 'JWT Analyzer', icon: <JwtTokenIcon className="h-5 w-5" />, color: 'text-orange-400' },
  { id: View.EXPLOIT_TOOLS, name: 'PrivEsc Pathfinder', icon: <KeyIcon className="h-5 w-5" />, color: 'text-orange-400' },
  { id: View.FILE_UPLOAD_AUDITOR, name: 'File Upload Auditor', icon: <ArrowUpTrayIcon className="h-5 w-5" />, color: 'text-orange-400' },
  { id: View.DISCOVERY_TOOLS, name: 'Discovery', icon: <MagnifyingGlassIcon className="h-5 w-5" />, color: 'text-blue-400' },
];

const appViews = [
    { id: View.HISTORY, name: 'History', icon: <HistoryIcon className="h-5 w-5" />, color: 'text-green-400' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ isOpen, onClose, onNavigate, activeView }) => {
  // Use global CLI connection context for consistent state
  const { cliConnected } = useSettings();

  const NavLink: React.FC<{view: View, name: string, icon: React.ReactNode, color: string, disabled?: boolean, requiresCli?: boolean}> = ({ view, name, icon, color, disabled, requiresCli }) => (
    <button
      onClick={() => !disabled && onNavigate(view)}
      title={disabled ? `${name} — CLI not connected (Configure in Settings > CLI Connector)` : `Navigate to ${name}`}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-500 ${
        disabled
          ? 'opacity-50 cursor-not-allowed text-muted'
          : activeView === view
          ? 'bg-gradient-to-r from-coral/20 to-purple-elevated/20 text-white border border-coral/20 shadow-lg shadow-coral/5'
          : 'text-purple-gray hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className={`flex-shrink-0 ${disabled ? 'text-muted' : activeView === view ? 'text-coral' : color}`}>{icon}</span>
      <span className="text-sm font-medium flex-grow">{name}</span>
      {disabled && requiresCli && (
        <span className="text-[9px] font-medium text-muted bg-purple-light/50 px-1.5 py-0.5 rounded">CLI</span>
      )}
      {!disabled && activeView === view && (
        <span className="w-1.5 h-1.5 rounded-full bg-coral-hover flex-shrink-0"></span>
      )}
    </button>
  );

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 w-72 h-full bg-purple-deep/95 backdrop-blur-2xl border-r border-white/5 p-5 flex flex-col z-50 shadow-2xl shadow-purple-900/20 transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header with logo + close */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral to-purple-elevated flex items-center justify-center shadow-lg shadow-coral/20">
              <BugTraceAILogo className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">BugTraceAI</h1>
              <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Security Suite</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-purple-gray hover:text-white hover:bg-purple-medium/50 transition-all group" title="Close menu">
            <XMarkIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col flex-grow overflow-y-auto overflow-x-hidden min-h-0">
          {/* BugTraceAI - First position (requires CLI) */}
          <div className="mb-4">
            <NavLink
              view={View.CLI_FRAMEWORK}
              name="BugTraceAI"
              icon={<BrainIcon className="h-5 w-5" />}
              color="text-coral"
              disabled={!cliConnected}
              requiresCli={true}
            />
          </div>

          {/* Divider */}
          <hr className="border-t border-white/5 my-2"/>

          {/* Tools Section */}
          <div className="mb-6 mt-4">
            <h2 className="px-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Tools</h2>
            <div className="space-y-1">
              {toolViews.map(item => <NavLink key={item.id} view={item.id} name={item.name} icon={item.icon} color={item.color} />)}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-t border-white/5 my-2"/>

          {/* Reports Section */}
          <div className="mt-4">
            <h2 className="px-3 text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Reports</h2>
            <div className="space-y-1">
              {appViews.map(item => <NavLink key={item.id} view={item.id} name={item.name} icon={item.icon} color={item.color} />)}
            </div>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
          {/* CLI Connection Status */}
          <div className="px-3 py-2 rounded-xl bg-purple-medium/30 border border-white/5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cliConnected ? 'bg-green-400 animate-pulse' : 'bg-purple-elevated'}`} />
              <span className="text-[11px] text-purple-gray font-medium">
                CLI: {cliConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-coral/10 to-purple-elevated/10 border border-coral/20">
            <p className="text-[11px] text-purple-gray font-medium">Open Source</p>
            <p className="text-[10px] text-muted mt-0.5">Security analysis toolkit</p>
          </div>
        </div>
      </aside>
    </>
  );
};
