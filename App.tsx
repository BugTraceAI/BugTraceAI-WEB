// @author: Albert C | @yz9yt | github.com/yz9yt
// App.tsx
// version 0.1 Beta
import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainMenu } from './components/MainMenu.tsx';
import { AnalysisHistory } from './components/analysis/AnalysisHistory.tsx';
import { ReportViewer } from './components/analysis/ReportViewer.tsx';
import { ComparisonView } from './components/analysis/ComparisonView.tsx';
import { CLIFramework } from './components/cli/index.ts';
import { UrlAnalyzer } from './components/UrlAnalyzer.tsx';
import { CodeAnalyzer } from './components/CodeAnalyzer.tsx';
import { JsRecon } from './components/JsRecon.tsx';
import { DomXssPathfinder } from './components/DomXssPathfinder.tsx';
import { PayloadForge } from './components/PayloadForge.tsx';
import { SstiForge } from './components/SstiForge.tsx';
import { OobInteractionHelper } from './components/OobInteractionHelper.tsx';
import { JwtAnalyzer } from './components/JwtAnalyzer.tsx';
import { PrivEscPathfinder } from './components/PrivEscPathfinder.tsx';
import { FileUploadAuditor } from './components/FileUploadAuditor.tsx';
import { UrlListFinder } from './components/UrlListFinder.tsx';
import { SubdomainFinder } from './components/SubdomainFinder.tsx';
import { SubTabs } from './components/SubTabs.tsx';
import { Header } from './components/Header.tsx';
import { Footer } from './components/Footer.tsx';
import { DevDocumentationModal } from './components/DevDocumentationModal.tsx';
import { UserDocumentationModal } from './components/UserDocumentationModal.tsx';
import { XssExploitationAssistant } from './components/XssExploitationAssistant.tsx';
import { SqlExploitationAssistant } from './components/SqlExploitationAssistant.tsx';
import { WebSecAgent } from './components/WebSecAgent.tsx';
import { DisclaimerModal } from './components/DisclaimerModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { ThemeModal } from './components/ThemeModal.tsx';
import { ApiKeyWarningModal } from './components/ApiKeyWarningModal.tsx';
import { SecurityHeadersAnalyzer } from './components/SecurityHeadersAnalyzer.tsx';
import { NoLightModeModal } from './components/NoLightModeModal.tsx';
import { ErrorToast } from './components/ErrorToast.tsx';
import { useWebSecAgent } from './hooks/useWebSecAgent.tsx';
import { useChatContext } from './contexts/ChatContext.tsx';
import { useRouteSync } from './hooks/useRouteSync.ts';
import { View, Tool, VulnerabilityReport, Vulnerability, ExploitContext, Severity } from './types.ts';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.CLI_FRAMEWORK);
  const [activeSubTab, setActiveSubTab] = useState<Tool>(Tool.DAST);

  // Setup route synchronization
  const { navigateToView, navigateToSubTab } = useRouteSync({
    activeView,
    activeSubTab,
    onNavigate: setActiveView,
    onSubTabChange: setActiveSubTab,
  });

  const [selectedReport, setSelectedReport] = useState<VulnerabilityReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDevDocModalOpen, setIsDevDocModalOpen] = useState<boolean>(false);
  const [isUserDocModalOpen, setIsUserDocModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isApiKeyWarningModalOpen, setIsApiKeyWarningModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'api' | 'status' | 'danger'>('api');

  const [payloadForForge, setPayloadForForge] = useState<string | null>(null);
  const [jwtForAnalyzer, setJwtForAnalyzer] = useState<string | null>(null);
  const [exploitAssistantContext, setExploitAssistantContext] = useState<ExploitContext | null>(null);
  const [sqlExploitAssistantContext, setSqlExploitAssistantContext] = useState<ExploitContext | null>(null);

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [disclaimerRejected, setDisclaimerRejected] = useState(false);

  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [comparingReports, setComparingReports] = useState<{ a: string, b: string } | null>(null);

  useEffect(() => {
    try {
      const accepted = sessionStorage.getItem('disclaimerAccepted') === 'true';
      if (accepted) {
        setDisclaimerAccepted(true);
      }
    } catch (e) {
      console.error("Could not access sessionStorage:", e);
    }
  }, []);

  const handleShowApiKeyWarning = () => {
    setIsApiKeyWarningModalOpen(true);
  };

  // Use the new custom hook for all WebSec Agent logic
  const {
    messages: agentMessages,
    isLoading: isAgentLoading,
    sendMessage: sendAgentMessage,
    resetMessages: resetAgentMessages,
    startAnalysisWithAgent,
    startReportAnalysisWithAgent
  } = useWebSecAgent(handleShowApiKeyWarning);

  const { loadSession } = useChatContext();

  const handleAcceptDisclaimer = () => {
    try {
      sessionStorage.setItem('disclaimerAccepted', 'true');
    } catch (e) {
      console.error("Could not write to sessionStorage:", e);
    }
    setDisclaimerAccepted(true);
    setDisclaimerRejected(false);
  };

  const handleRejectDisclaimer = () => {
    setDisclaimerRejected(true);
  };

  const handleAnalysisStart = () => {
    setIsLoading(true);
    setSelectedReport(null);
    setAnalysisLog([]);
    setExploitAssistantContext(null);
    setSqlExploitAssistantContext(null);
  };

  const handleAnalysisComplete = (report: VulnerabilityReport) => {
    const severityOrder: Record<Severity, number> = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 1,
      [Severity.MEDIUM]: 2,
      [Severity.LOW]: 3,
      [Severity.INFO]: 4,
      [Severity.UNKNOWN]: 5,
    };

    const sortedVulnerabilities = [...(report.vulnerabilities || [])].sort((a, b) => {
      const severityA = severityOrder[a.severity] ?? 99;
      const severityB = severityOrder[b.severity] ?? 99;
      return severityA - severityB;
    });

    const sortedReport = { ...report, vulnerabilities: sortedVulnerabilities };
    const reportWithId = { ...sortedReport, id: new Date().toISOString() };

    setSelectedReport(reportWithId);
    setIsLoading(false);
  };

  const handleAnalysisError = (message: string) => {
    setIsLoading(false);
    setAnalysisLog(prev => [...prev, `Analysis failed: ${message}`]);
  }

  const handleShowSettings = () => {
    setSettingsInitialTab('api');
    setIsSettingsModalOpen(true);
  };

  const handleGoToSettings = () => {
    setIsApiKeyWarningModalOpen(false);
    setSettingsInitialTab('api');
    setIsSettingsModalOpen(true);
  };


  const handleSendToPayloadForge = (payload: string) => {
    setPayloadForForge(payload);
    navigateToView(View.PAYLOAD_TOOLS, Tool.PAYLOAD_FORGE);
  };

  const handleSendToJwtAnalyzer = (token: string) => {
    setJwtForAnalyzer(token);
    navigateToView(View.JWT_ANALYZER);
    setExploitAssistantContext(null);
    setSqlExploitAssistantContext(null);
  };

  const handlePayloadUsed = () => {
    setPayloadForForge(null);
  };

  const handleShowExploitAssistant = (vulnerability: Vulnerability, targetUrl?: string) => {
    setExploitAssistantContext({ vulnerability, targetUrl });
    setSqlExploitAssistantContext(null);
    navigateToView(View.XSS_EXPLOIT_ASSISTANT);
  };

  const handleShowSqlExploitAssistant = (vulnerability: Vulnerability, targetUrl: string) => {
    setSqlExploitAssistantContext({ vulnerability, targetUrl });
    setExploitAssistantContext(null);
    navigateToView(View.SQL_EXPLOIT_ASSISTANT);
  };

  const handleShowAgent = () => {
    navigateToView(View.WEB_SEC_AGENT);
    setExploitAssistantContext(null);
    setSqlExploitAssistantContext(null);
  };

  const handleThemeClick = () => {
    setIsThemeModalOpen(true);
  };

  const handleAnalyzeWithAgent = (vulnerability: Vulnerability, analyzedTarget: string) => {
    navigateToView(View.WEB_SEC_AGENT);
    setExploitAssistantContext(null);
    setSqlExploitAssistantContext(null);
    startAnalysisWithAgent(vulnerability, analyzedTarget);
  };

  const handleSendReportToAgent = (reportText: string, analysisType: string) => {
    navigateToView(View.WEB_SEC_AGENT);
    setExploitAssistantContext(null);
    setSqlExploitAssistantContext(null);
    startReportAnalysisWithAgent(reportText, analysisType);
  };

  const handleSelectAnalysisFromHistory = (analysis: any) => {
    setViewingReportId(analysis.id);
  };

  const handleCloseReportViewer = () => {
    setViewingReportId(null);
  };

  const handleReRunFromViewer = (_target: string, type: string) => {
    setViewingReportId(null);
    if (type === 'url_analysis') {
      navigateToView(View.URL_ANALYSIS, Tool.DAST);
    } else {
      navigateToView(View.CODE_ANALYSIS, Tool.SAST);
    }
  };

  const handleNavigateToChat = async (sessionId: string) => {
    setViewingReportId(null);
    navigateToView(View.WEB_SEC_AGENT);
    await loadSession(sessionId);
  };

  const handleCompareReports = (idA: string, idB: string) => {
    setComparingReports({ a: idA, b: idB });
  };

  const handleCloseComparison = () => {
    setComparingReports(null);
  };

  const handleSubTabNavigation = (tool: Tool) => {
    navigateToSubTab(tool);
    setSelectedReport(null); // Clear previous report to prevent state leakage
  };

  const handleNavigate = (view: View) => {
    navigateToView(view); // Use router navigation (handles default sub-tab for tabbed views)
    setSelectedReport(null); // ARCHITECTURAL FIX: Clear report when changing main view to prevent state leakage
    setIsMenuOpen(false);
    setExploitAssistantContext(null); // Clear context when navigating
    setSqlExploitAssistantContext(null);
  };

  const handleGoHome = () => {
    handleNavigate(View.CLI_FRAMEWORK);
  };

  if (disclaimerRejected) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-4 text-center">
        <div>
          <h1 className="text-2xl font-bold text-red-400">Disclaimer Rejected</h1>
          <p className="mt-4">You must accept the disclaimer to use this application.</p>
          <p className="mt-2 text-sm text-gray-400">Please reload the page to review the disclaimer again.</p>
        </div>
      </div>
    );
  }

  if (!disclaimerAccepted) {
    return <DisclaimerModal onAccept={handleAcceptDisclaimer} onReject={handleRejectDisclaimer} />;
  }

  const renderActiveView = () => {
    const urlAnalysisTools = [
      { id: Tool.DAST, name: "DAST" },
      { id: Tool.SECURITY_HEADERS_ANALYZER, name: "Headers Analyzer" },
    ];
    const codeAnalysisTools = [
      { id: Tool.SAST, name: "SAST" },
      { id: Tool.JS_RECON, name: "JS Recon" },
      { id: Tool.DOM_XSS_PATHFINDER, name: "DOM XSS Pathfinder" },
    ];
    const payloadTools = [
      { id: Tool.PAYLOAD_FORGE, name: "Payload Forge" },
      { id: Tool.SSTI_FORGE, name: "SSTI Forge" },
      { id: Tool.OOB_INTERACTION_HELPER, name: "OOB Helper" },
    ];
    const discoveryTools = [
      { id: Tool.URL_LIST_FINDER, name: "URL Finder" },
      { id: Tool.SUBDOMAIN_FINDER, name: "Subdomain Finder" },
    ];

    switch (activeView) {
      case View.URL_ANALYSIS:
        return (
          <>
            <SubTabs tools={urlAnalysisTools} activeTool={activeSubTab} setTool={handleSubTabNavigation} />
            {activeSubTab === Tool.DAST && (
              <UrlAnalyzer
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
                onAnalysisError={handleAnalysisError}
                onShowApiKeyWarning={handleShowApiKeyWarning}
                report={selectedReport}
                isLoading={isLoading}
                analysisLog={analysisLog}
                setAnalysisLog={setAnalysisLog}
                onSendToPayloadForge={handleSendToPayloadForge}
                onSendToJwtAnalyzer={handleSendToJwtAnalyzer}
                onShowExploitAssistant={handleShowExploitAssistant}
                onShowSqlExploitAssistant={handleShowSqlExploitAssistant}
                onAnalyzeWithAgent={handleAnalyzeWithAgent}
              />
            )}
            {activeSubTab === Tool.SECURITY_HEADERS_ANALYZER && (
              <SecurityHeadersAnalyzer
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
                onAnalysisError={handleAnalysisError}
                onShowApiKeyWarning={handleShowApiKeyWarning}
                isLoading={isLoading}
                report={selectedReport}
              />
            )}
          </>
        );
      case View.CODE_ANALYSIS:
        return (
          <>
            <SubTabs
              tools={codeAnalysisTools}
              activeTool={activeSubTab}
              setTool={handleSubTabNavigation}
            />
            {activeSubTab === Tool.SAST && (
              <CodeAnalyzer
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
                onAnalysisError={handleAnalysisError}
                onShowApiKeyWarning={handleShowApiKeyWarning}
                report={selectedReport}
                isLoading={isLoading}
                analysisLog={analysisLog}
                setAnalysisLog={setAnalysisLog}
                onSendToPayloadForge={handleSendToPayloadForge}
                onSendToJwtAnalyzer={handleSendToJwtAnalyzer}
                onShowExploitAssistant={(vuln) => handleShowExploitAssistant(vuln, undefined)}
                onAnalyzeWithAgent={handleAnalyzeWithAgent}
              />
            )}
            {activeSubTab === Tool.JS_RECON && (
              <JsRecon
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
                onAnalysisError={handleAnalysisError}
                onShowApiKeyWarning={handleShowApiKeyWarning}
                report={selectedReport}
                isLoading={isLoading}
                analysisLog={analysisLog}
                setAnalysisLog={setAnalysisLog}
                onAnalyzeWithAgent={handleAnalyzeWithAgent}
                onSendToJwtAnalyzer={handleSendToJwtAnalyzer}
              />
            )}
            {activeSubTab === Tool.DOM_XSS_PATHFINDER && (
              <DomXssPathfinder
                onAnalysisStart={handleAnalysisStart}
                onAnalysisComplete={handleAnalysisComplete}
                onAnalysisError={handleAnalysisError}
                onShowApiKeyWarning={handleShowApiKeyWarning}
                isLoading={isLoading}
                report={selectedReport}
              />
            )}
          </>
        );
      case View.PAYLOAD_TOOLS:
        return (
          <>
            <SubTabs tools={payloadTools} activeTool={activeSubTab} setTool={handleSubTabNavigation} />
            {activeSubTab === Tool.PAYLOAD_FORGE && <PayloadForge payloadForForge={payloadForForge} onPayloadUsed={handlePayloadUsed} onShowApiKeyWarning={handleShowApiKeyWarning} />}
            {activeSubTab === Tool.SSTI_FORGE && <SstiForge onShowApiKeyWarning={handleShowApiKeyWarning} />}
            {activeSubTab === Tool.OOB_INTERACTION_HELPER && <OobInteractionHelper />}
          </>
        );
      case View.DISCOVERY_TOOLS:
        return (
          <>
            <SubTabs tools={discoveryTools} activeTool={activeSubTab} setTool={handleSubTabNavigation} />
            {activeSubTab === Tool.URL_LIST_FINDER && <UrlListFinder />}
            {activeSubTab === Tool.SUBDOMAIN_FINDER && <SubdomainFinder />}
          </>
        );
      case View.JWT_ANALYZER:
        return <JwtAnalyzer
          initialToken={jwtForAnalyzer}
          report={selectedReport}
          onTokenConsumed={() => setJwtForAnalyzer(null)}
          onAnalysisComplete={handleAnalysisComplete}
          onSendReportToAgent={handleSendReportToAgent}
          onShowApiKeyWarning={handleShowApiKeyWarning}
        />;
      case View.EXPLOIT_TOOLS:
        return (
          <PrivEscPathfinder
            onAnalysisStart={handleAnalysisStart}
            onAnalysisComplete={handleAnalysisComplete}
            onAnalysisError={handleAnalysisError}
            report={selectedReport}
            isLoading={isLoading}
            onAnalyzeWithAgent={handleAnalyzeWithAgent}
            onShowApiKeyWarning={handleShowApiKeyWarning}
          />
        );
      case View.FILE_UPLOAD_AUDITOR:
        return <FileUploadAuditor
          onAnalysisStart={handleAnalysisStart}
          onAnalysisComplete={handleAnalysisComplete}
          onAnalysisError={handleAnalysisError}
          onShowApiKeyWarning={handleShowApiKeyWarning}
          isLoading={isLoading}
        />;
      case View.WEB_SEC_AGENT:
        return (
          <WebSecAgent
            messages={agentMessages}
            onSendMessage={sendAgentMessage}
            onResetMessages={resetAgentMessages}
            isLoading={isAgentLoading}
          />
        );
      case View.XSS_EXPLOIT_ASSISTANT:
        return (
          <XssExploitationAssistant
            exploitContext={exploitAssistantContext}
            onShowApiKeyWarning={handleShowApiKeyWarning}
          />
        );
      case View.SQL_EXPLOIT_ASSISTANT:
        return (
          <SqlExploitationAssistant
            exploitContext={sqlExploitAssistantContext}
            onShowApiKeyWarning={handleShowApiKeyWarning}
          />
        );
      case View.CLI_FRAMEWORK:
        return <CLIFramework onClose={() => handleNavigate(View.URL_ANALYSIS)} />;
      case View.HISTORY:
        return <AnalysisHistory onSelectAnalysis={handleSelectAnalysisFromHistory} onCompareReports={handleCompareReports} />;
      default:
        return <p>Select a tool from the menu.</p>;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ErrorToast />
      <Header
        onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
        onSettingsClick={handleShowSettings}
        onUserDocsClick={() => setIsUserDocModalOpen(true)}
        onShowAgent={handleShowAgent}
        onGoHome={handleGoHome}
        onThemeClick={handleThemeClick}
      />
      <MainMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeView={activeView}
        onNavigate={handleNavigate}
      />

      <main className={`flex-1 w-full flex flex-col min-h-0 overflow-y-auto overflow-x-hidden ${activeView === View.WEB_SEC_AGENT ? '' : 'p-3 sm:p-4 lg:p-6'}`}>
        <Routes>
          {/* Dynamic routes with URL parameters */}
          <Route path="/chat/:sessionId" element={renderActiveView()} />
          <Route path="/chat" element={renderActiveView()} />
          <Route path="/bugtraceai/:tab" element={renderActiveView()} />
          <Route path="/bugtraceai" element={renderActiveView()} />
          {/* Sub-tab routes */}
          <Route path="/url-analysis/:subtab" element={renderActiveView()} />
          <Route path="/url-analysis" element={renderActiveView()} />
          <Route path="/code-analysis/:subtab" element={renderActiveView()} />
          <Route path="/code-analysis" element={renderActiveView()} />
          <Route path="/payload-tools/:subtab" element={renderActiveView()} />
          <Route path="/payload-tools" element={renderActiveView()} />
          <Route path="/discovery-tools/:subtab" element={renderActiveView()} />
          <Route path="/discovery-tools" element={renderActiveView()} />
          {/* All other routes */}
          <Route path="*" element={renderActiveView()} />
        </Routes>
      </main>

      <Footer onDevDocsClick={() => setIsDevDocModalOpen(true)} />

      {/* Modals */}
      <DevDocumentationModal isOpen={isDevDocModalOpen} onClose={() => setIsDevDocModalOpen(false)} />
      <UserDocumentationModal isOpen={isUserDocModalOpen} onClose={() => setIsUserDocModalOpen(false)} />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
      />
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
      <ApiKeyWarningModal isOpen={isApiKeyWarningModalOpen} onClose={() => setIsApiKeyWarningModalOpen(false)} onGoToSettings={handleGoToSettings} />
      <ErrorToast />
      {/* Report Viewer Modal */}
      {viewingReportId && (
        <ReportViewer
          reportId={viewingReportId}
          onClose={handleCloseReportViewer}
          onReRun={handleReRunFromViewer}
          onNavigateToChat={handleNavigateToChat}
        />
      )}

      {/* Comparison View Modal */}
      {comparingReports && (
        <ComparisonView
          reportIdA={comparingReports.a}
          reportIdB={comparingReports.b}
          onClose={handleCloseComparison}
        />
      )}
    </div>
  );
};

export default App;
