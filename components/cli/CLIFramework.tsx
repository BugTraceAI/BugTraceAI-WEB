// components/cli/CLIFramework.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TerminalIcon, DocumentTextIcon, CogIcon } from '../Icons.tsx';
import { ScanTargetTab } from './ScanTargetTab.tsx';
import { PastReportsTab } from './PastReportsTab.tsx';
import { ConfigurationTab } from './ConfigurationTab.tsx';

interface CLIFrameworkProps {
  onClose: () => void;
}

type TabType = 'scan' | 'reports' | 'config';

const tabToPath: Record<TabType, string> = {
  scan: '/bugtraceai/scan',
  reports: '/bugtraceai/reports',
  config: '/bugtraceai/config',
};

const pathToTab: Record<string, TabType> = {
  '/bugtraceai/scan': 'scan',
  '/bugtraceai/reports': 'reports',
  '/bugtraceai/config': 'config',
  '/bugtraceai': 'scan', // Default
};

export const CLIFramework: React.FC<CLIFrameworkProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('scan');

  // Sync URL to tab on mount and location change
  useEffect(() => {
    const tab = pathToTab[location.pathname];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.pathname]);

  // Sync tab to URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(tabToPath[tab]);
  };

  const tabs = [
    { id: 'scan' as TabType, name: 'Scan Target', icon: <TerminalIcon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" /> },
    { id: 'reports' as TabType, name: 'Reports', icon: <DocumentTextIcon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" /> },
    { id: 'config' as TabType, name: 'Configuration', icon: <CogIcon className="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" /> },
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
        return <PastReportsTab onRescan={handleRescan} onViewScan={handleViewScan} />;
      case 'config':
        return <ConfigurationTab />;
    }
  };

  return (
    <div className="h-full flex flex-col card-premium !bg-black/20 rounded-[2rem] overflow-hidden" data-testid="cli-framework">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-5 pt-3 bg-black/40 border-b border-ui-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`
              group py-3 px-6 label-mini rounded-t-xl transition-all duration-300 flex items-center gap-2.5 border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-b-ui-accent text-ui-accent bg-ui-accent/5 opacity-100'
                : 'border-b-transparent text-ui-text-dim hover:text-white hover:bg-white/5 opacity-80 hover:opacity-100'
              }
            `}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            data-testid={`cli-tab-${tab.id === 'scan' ? 'scan-target' : tab.id === 'reports' ? 'past-reports' : 'configuration'}`}
          >
            {tab.icon}
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {renderTabContent()}
      </div>
    </div>
  );
};
