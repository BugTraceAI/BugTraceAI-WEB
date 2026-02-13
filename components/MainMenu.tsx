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

  const NavLink: React.FC<{ view: View, name: string, icon: React.ReactNode, color: string, disabled?: boolean, requiresCli?: boolean }> = ({ view, name, icon, color, disabled, requiresCli }) => (
    <button
      onClick={() => !disabled && onNavigate(view)}
      title={disabled ? `${name} — CLI not connected (Configure in Settings > CLI Connector)` : `Navigate to ${name}`}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-300 group ${disabled
          ? 'opacity-40 cursor-not-allowed'
          : activeView === view
            ? 'bg-ui-accent/10 text-ui-text-main border border-ui-accent/20 shadow-lg shadow-ui-accent/5'
            : 'text-ui-text-dim hover:bg-ui-bg/50 hover:text-ui-text-main hover:border-ui-border border border-transparent'
        }`}
    >
      <span className={`flex-shrink-0 transition-colors duration-300 ${disabled ? 'text-ui-text-muted' : activeView === view ? 'text-ui-accent' : color.replace('text-', 'text-opacity-80 text-')}`}>{icon}</span>
      <span className="text-[13px] font-semibold flex-grow tracking-tight">{name}</span>
      {disabled && requiresCli && (
        <span className="label-mini !text-[8px] bg-ui-bg/80 border border-ui-border px-1.5 py-0.5 rounded-md">CLI</span>
      )}
      {!disabled && activeView === view && (
        <span className="w-1.5 h-1.5 rounded-full bg-ui-accent shadow-[0_0_8px_rgba(255,127,80,0.6)] flex-shrink-0"></span>
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
        className={`fixed top-0 left-0 w-72 h-full bg-ui-bg/95 backdrop-blur-2xl border-r border-ui-border p-5 flex flex-col z-50 shadow-2xl transition-transform duration-500 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header with logo + close */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ui-accent/10 border border-ui-accent/20 flex items-center justify-center shadow-lg shadow-ui-accent/10">
              <BugTraceAILogo className="h-6 w-6 text-ui-accent" />
            </div>
            <div>
              <span className="label-mini text-ui-accent !text-[9px] mb-[-4px] block">BugTrace AI</span>
              <h1 className="text-lg font-black text-ui-text-main tracking-tight">Suite V3</h1>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-ui-text-dim hover:text-ui-text-main hover:bg-ui-bg/50 border border-transparent hover:border-ui-border transition-all active:scale-90" title="Close menu">
            <XMarkIcon className="h-5 w-5" />
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
          <hr className="border-t border-white/5 my-2" />

          {/* Tools Section */}
          <div className="mb-6 mt-4">
            <h2 className="label-mini px-3 mb-3 text-ui-text-dim/60">Analytical Tools</h2>
            <div className="space-y-1">
              {toolViews.map(item => <NavLink key={item.id} view={item.id} name={item.name} icon={item.icon} color={item.color} />)}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-t border-ui-border/50 my-2" />

          {/* Reports Section */}
          <div className="mt-4">
            <h2 className="label-mini px-3 mb-3 text-ui-text-dim/60">Documentation & Logs</h2>
            <div className="space-y-1">
              {appViews.map(item => <NavLink key={item.id} view={item.id} name={item.name} icon={item.icon} color={item.color} />)}
            </div>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="mt-auto pt-6 border-t border-ui-border space-y-3">
          {/* CLI Connection Status */}
          <div className="px-4 py-3 rounded-2xl bg-dashboard-bg/50 border border-ui-border shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${cliConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-ui-text-muted/30'}`} />
                <span className="label-mini !text-[9px] text-ui-text-dim">CLI System</span>
              </div>
              <span className={`text-[10px] font-bold ${cliConnected ? 'text-green-500' : 'text-ui-text-muted/60'}`}>
                {cliConnected ? 'ACTIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 rounded-2xl bg-ui-bg/30 border border-dashed border-ui-border flex items-center justify-between">
            <div className="flex flex-col">
              <span className="label-mini !text-[8px] text-ui-text-dim/50">Version</span>
              <span className="text-[10px] font-mono text-ui-text-main">0.2.0-BETA</span>
            </div>
            <div className="p-1.5 rounded-lg bg-ui-bg border border-ui-border">
              <BugTraceAILogo className="h-3 w-3 text-ui-text-dim/40" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
