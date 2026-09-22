// components/cli/CLIFramework.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TerminalIcon, DocumentTextIcon, CogIcon, SignalIcon } from '../Icons.tsx';
import { ScanTargetTab } from './ScanTargetTab.tsx';
import { PastReportsTab } from './PastReportsTab.tsx';
import { ConfigurationTab } from './ConfigurationTab.tsx';
import { ProviderTab } from './ProviderTab.tsx';
import { SlidingSegmentedControl } from './SlidingSegmentedControl.tsx';
import type { ExploitSeed } from '../../types.ts';

interface CLIFrameworkProps {
  onClose: () => void;
  onSendToRepeater?: (seed: ExploitSeed) => void;
}

// Model Lab moved to its own sidebar module at /modellab (no longer a BugTraceAI sub-tab).
type TabType = 'scan' | 'reports' | 'config' | 'provider';

const tabToPath: Record<TabType, string> = {
  scan: '/bugtraceai/scan',
  reports: '/bugtraceai/reports',
  config: '/bugtraceai/config',
  provider: '/bugtraceai/provider',
};

const pathToTab: Record<string, TabType> = {
  '/bugtraceai/scan': 'scan',
  '/bugtraceai/reports': 'reports',
  '/bugtraceai/config': 'config',
  '/bugtraceai/provider': 'provider',
  '/bugtraceai': 'scan', // Default
};

export const CLIFramework: React.FC<CLIFrameworkProps> = ({ onClose, onSendToRepeater }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const tabContentRef = useRef<HTMLDivElement>(null);

  // Sync URL to tab on mount and location change
  useEffect(() => {
    let tab = pathToTab[location.pathname];
    // Handle /bugtraceai/reports/:reportId deep links
    if (!tab && location.pathname.startsWith('/bugtraceai/reports/')) {
      tab = 'reports';
    }
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.pathname]);

  // The tab content is a persistent scroll container. Without resetting it,
  // navigating from a long report (often scrolled down) to Scan Target keeps
  // that old offset and clips the ENGINE selector and first form controls.
  useEffect(() => {
    tabContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab, location.pathname]);

  // Sync tab to URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(tabToPath[tab]);
  };

  const tabs = [
    { id: 'scan' as TabType, name: 'Scan Target', icon: <TerminalIcon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" /> },
    { id: 'reports' as TabType, name: 'Reports', icon: <DocumentTextIcon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" /> },
    { id: 'config' as TabType, name: 'Configuration', icon: <CogIcon className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" /> },
    { id: 'provider' as TabType, name: 'Provider', icon: <SignalIcon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" /> },
  ];

  const handleRescan = (targetUrl: string) => {
    // Switch to scan tab and prefill URL
    setActiveTab('scan');
    // Note: The prefilling will be handled by passing config via prop in future iteration
    // For now, user will need to manually enter the URL
    console.log('Re-scan requested for:', targetUrl);
  };

  const handleViewScan = () => {
    setActiveTab('scan');
    navigate(tabToPath.scan);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scan':
        return <ScanTargetTab />;
      case 'reports':
        return <PastReportsTab onRescan={handleRescan} onViewScan={handleViewScan} onSendToRepeater={onSendToRepeater} />;
      case 'config':
        return <ConfigurationTab />;
      case 'provider':
        return <ProviderTab />;
    }
  };

  return (
    <div className="h-full flex flex-col card-premium !bg-black/20 rounded-[2rem] overflow-hidden" data-testid="cli-framework">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-ui-border bg-black/40 px-5 py-2.5">
        <SlidingSegmentedControl
          value={activeTab}
          onChange={value => handleTabChange(value as TabType)}
          ariaLabel="BugTraceAI scanner navigation"
          testIdPrefix="cli-tab"
          itemWidth={136}
          options={tabs.map(tab => ({ value: tab.id, label: <><span aria-hidden="true">{tab.icon}</span>{tab.name}</> }))}
        />
      </div>

      {/* Tab Content */}
      <div ref={tabContentRef} className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain">
        {renderTabContent()}
      </div>
    </div>
  );
};
