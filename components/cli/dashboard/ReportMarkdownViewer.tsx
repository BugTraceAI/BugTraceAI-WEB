// components/cli/dashboard/ReportMarkdownViewer.tsx
// v3.0 - Major redesign matching reference mockup
/* eslint-disable max-lines -- Report markdown viewer component (~420 lines).
 * Rich report viewer with metric cards, vulnerability chart, findings table,
 * download section, and markdown rendering. Presentation-heavy component.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import JSZip from 'jszip';
import { MarkdownRenderer } from '../../MarkdownRenderer.tsx';
import { ArrowPathIcon, ArrowDownTrayIcon, DocumentTextIcon } from '../../Icons.tsx';
import { useReportViewer, Finding, ScanStats } from '../../../hooks/useReportViewer.ts';

interface CLIReport {
  id: string;
  target_url: string;
  scan_date: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  report_path: string;
}

interface ReportMarkdownViewerProps {
  report: CLIReport;
  onBack: () => void;
}

const ITEMS_PER_PAGE = 10;

const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string; bar: string; fill: string }> = {
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-500', bar: 'bg-red-500', fill: '#ef4444' },
  high: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-500', bar: 'bg-orange-500', fill: '#f97316' },
  medium: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-500', bar: 'bg-yellow-500', fill: '#eab308' },
  low: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-500', bar: 'bg-blue-500', fill: '#3b82f6' },
};

const downloadFiles = [
  { filename: 'final_report.md', label: 'Report', icon: 'MD' },
  { filename: 'validated_findings.json', label: 'Validated', icon: 'JSON' },
  { filename: 'raw_findings.json', label: 'Raw', icon: 'JSON' },
  { filename: 'engagement_data.json', label: 'Engagement', icon: 'JSON' },
];

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();
};

// Group findings by type for the donut chart legend
const groupByType = (findings: Finding[]): { name: string; value: number; severity: string }[] => {
  const map = new Map<string, { count: number; severity: string }>();
  for (const f of findings) {
    const key = f.type || f.title;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { count: 1, severity: f.severity.toLowerCase() });
    }
  }
  return Array.from(map.entries())
    .map(([name, { count, severity }]) => ({ name, value: count, severity }))
    .sort((a, b) => b.value - a.value);
};

interface AttackChain {
  name: string;
  vulnerabilities: string;
  impact: string;
}

const buildReportSummary = (
  report: CLIReport,
  findings: Finding[],
  scanStats: ScanStats | null,
  markdown: string,
  attackChains: AttackChain[],
): string => {
  const s = report.severity_summary;
  const counts = s || {
    critical: findings.filter(f => f.severity.toLowerCase() === 'critical').length,
    high: findings.filter(f => f.severity.toLowerCase() === 'high').length,
    medium: findings.filter(f => f.severity.toLowerCase() === 'medium').length,
    low: findings.filter(f => f.severity.toLowerCase() === 'low').length,
  };
  const total = counts.critical + counts.high + counts.medium + counts.low;

  let summary = `This is a cybersecurity scan report for **${report.target_url}**. I'd like your help understanding the findings, their severity, and what actions should be taken.\n\n`;
  summary += `## Scan Summary\n`;
  summary += `- **Date:** ${report.scan_date || 'Unknown'}\n`;
  if (scanStats?.duration) summary += `- **Duration:** ${scanStats.duration}\n`;
  if (scanStats?.urls_scanned != null) summary += `- **URLs Scanned:** ${scanStats.urls_scanned}\n`;
  summary += `- **Total Findings:** ${total} (Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low})\n\n`;

  if (findings.length > 0) {
    summary += `## Findings\n\n`;
    summary += `| # | Type | Severity | Parameter | CVSS | Status |\n`;
    summary += `|---|------|----------|-----------|------|--------|\n`;
    for (const [i, f] of findings.entries()) {
      const status = f.status === 'VALIDATED_CONFIRMED' ? 'Confirmed' : f.validated ? 'Validated' : 'Pending';
      const cvss = f.cvss_score != null ? String(f.cvss_score) : '-';
      summary += `| ${i + 1} | ${f.type || f.title} | ${f.severity} | ${f.parameter || '-'} | ${cvss} | ${status} |\n`;
    }
    summary += `\n`;
  }

  if (attackChains.length > 0) {
    summary += `## Attack Chains\n\n`;
    for (const [i, chain] of attackChains.entries()) {
      summary += `### ${i + 1}. ${chain.name}\n`;
      summary += `- **Vulnerabilities:** ${chain.vulnerabilities}\n`;
      summary += `- **Impact:** ${chain.impact}\n\n`;
    }
  }

  if (markdown) {
    const MAX_REPORT_LEN = 6000;
    const truncated = markdown.length > MAX_REPORT_LEN
      ? markdown.substring(0, MAX_REPORT_LEN) + '\n\n... (report truncated for chat context)'
      : markdown;
    summary += `## Full Report\n\n${truncated}\n`;
  }

  return summary;
};

export const ReportMarkdownViewer: React.FC<ReportMarkdownViewerProps> = ({ report, onBack }) => {
  const {
    markdown,
    findings,
    scanStats,
    loading,
    error,
    selectedSeverity,
    selectedCategory,
    filteredFindings,
    setSelectedSeverity,
    setSelectedCategory,
    handleCardClick,
    handleCategoryClick,
    loadData,
  } = useReportViewer(report.id);

  const navigate = useNavigate();
  const [zipping, setZipping] = useState(false);
  const [sendingToChat, setSendingToChat] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'findings' | 'report'>('findings');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const CLI_API_URL = import.meta.env.VITE_CLI_API_URL || 'http://localhost:8000';
  const WEB_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Compute severity counts
  const s = report.severity_summary;
  const totalFindings = s ? s.critical + s.high + s.medium + s.low : findings.length;
  const severityCounts = s || {
    critical: findings.filter(f => f.severity.toLowerCase() === 'critical').length,
    high: findings.filter(f => f.severity.toLowerCase() === 'high').length,
    medium: findings.filter(f => f.severity.toLowerCase() === 'medium').length,
    low: findings.filter(f => f.severity.toLowerCase() === 'low').length,
  };

  // Donut chart data
  const chartData = useMemo(() => [
    { name: 'Critical', value: severityCounts.critical },
    { name: 'High', value: severityCounts.high },
    { name: 'Medium', value: severityCounts.medium },
    { name: 'Low', value: severityCounts.low },
  ].filter(d => d.value > 0), [severityCounts]);

  const chartColors = chartData.map(d => SEVERITY_COLORS[d.name.toLowerCase()]?.fill || '#6b7280');

  // Grouped findings for legend
  const findingsByType = useMemo(() => groupByType(findings), [findings]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / ITEMS_PER_PAGE));
  const paginatedFindings = filteredFindings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Reset page when filter changes
  const handleSeverityClick = (sev: 'critical' | 'high' | 'medium' | 'low') => {
    setCurrentPage(1);
    handleCardClick(sev);
  };

  const onCategoryClick = (cat: string) => {
    setCurrentPage(1);
    handleCategoryClick(cat);
  }

  const handleDownload = async (filename: string) => {
    const fileUrl = `${CLI_API_URL}/api/scans/${report.id}/files/${filename}`;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(`Could not download ${filename}. Check that the CLI API is reachable.`);
    }
  };

  const handleDownloadAll = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      const results = await Promise.allSettled(
        downloadFiles.map(async ({ filename }) => {
          const url = `${CLI_API_URL}/api/scans/${report.id}/files/${filename}`;
          const res = await fetch(url);
          if (!res.ok) return null;
          const text = await res.text();
          return { filename, text };
        })
      );
      let added = 0;
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          zip.file(r.value.filename, r.value.text);
          added++;
        }
      }
      if (added === 0) return;
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan-${report.id}-report.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
    } finally {
      setZipping(false);
    }
  };

  const handleSendToChat = async () => {
    setSendingToChat(true);
    try {
      // 1. Fetch attack chains (non-blocking — empty array on failure)
      let attackChains: AttackChain[] = [];
      try {
        const chainsRes = await fetch(`${CLI_API_URL}/api/scans/${report.id}/files/attack_chains.json`);
        if (chainsRes.ok) {
          const data = await chainsRes.json();
          attackChains = data.chains || [];
        }
      } catch { /* attack chains not available — continue without them */ }

      // 2. Create a new chat session
      const sessionRes = await fetch(`${WEB_API_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: 'websec',
          title: `Report: ${report.target_url}`,
        }),
      });
      if (!sessionRes.ok) throw new Error('Failed to create chat session');
      const { data: session } = await sessionRes.json();

      // 3. Build structured report summary with all available data
      const summary = buildReportSummary(report, findings, scanStats, markdown, attackChains);

      // 4. Send as initial user message
      await fetch(`${WEB_API_URL}/chats/${session.id}/messages/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: summary }],
        }),
      });

      // 5. Navigate to chat with this session
      navigate(`/chat/${session.id}`);
    } catch (err) {
      console.error('Failed to send report to chat:', err);
    } finally {
      setSendingToChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <ArrowPathIcon className="h-8 w-8 text-coral animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-coral hover:bg-coral-hover text-white rounded-xl text-sm transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 md:p-8">
      {/* ═══ HEADER BAR ═══ */}
      <div className="dashboard-card px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-4">
            {/* Target URL */}
            <h1 className="text-sm font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5 truncate font-mono tracking-tight">
              {report.target_url || 'Unknown Target'}
            </h1>
            {/* Integrated Scan Stats */}
            <div className="flex items-center gap-3 text-[10px] font-mono text-purple-gray border-l border-white/10 pl-3">
              <span>SCAN #{report.id.substring(0, 8)}</span>
              <span className="text-white/20">&bull;</span>
              <span>{formatDate(report.scan_date)}</span>
              {scanStats.duration && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span className="text-emerald-400">{scanStats.duration}</span>
                </>
              )}
              {scanStats.urls_scanned != null && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span>{scanStats.urls_scanned} URLs</span>
                </>
              )}
            </div>
          </div>

          {/* Tech Stack Mini-Badges */}
          {scanStats.tech_stack?.technologies && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              {scanStats.tech_stack.technologies.slice(0, 4).map((tech) => (
                <span key={tech.name} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-muted border border-white/5">
                  {tech.name}
                </span>
              ))}
              {(scanStats.tech_stack.technologies.length > 4) && (
                <span className="text-[9px] text-muted">+{scanStats.tech_stack.technologies.length - 4}</span>
              )}
            </div>
          )}

          <div className="flex-shrink-0 text-right flex items-center gap-4">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="text-[10px] font-bold text-muted hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg border border-white/5"
            >
              {showMetrics ? 'Show Less' : 'Show More'}
              <svg className={`h-3 w-3 transition-transform duration-300 ${showMetrics ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              onClick={handleSendToChat}
              disabled={sendingToChat || (!markdown && findings.length === 0)}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest transition-colors flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendingToChat ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Send to Chat
                </>
              )}
            </button>

            <button
              onClick={onBack}
              className="text-[10px] font-bold text-coral hover:text-coral-hover uppercase tracking-widest transition-colors flex items-center gap-1"
            >
              &larr; Return
            </button>
          </div>
        </div>
      </div>

      {showMetrics && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* ═══ METRIC CARDS ═══ */}
          {totalFindings > 0 && (
            <div className="grid grid-cols-[1.2fr_1fr] gap-4">
              {/* Left Card: Totals + Distribution Donut */}
              <div className="dashboard-card p-4 flex items-center justify-between gap-6">

                {/* Left Side: Interactive Counters List */}
                <div className="flex-1 flex flex-col justify-center space-y-1.5 max-w-[70%] border-r border-white/5 pr-6">
                  <div className="flex items-center justify-between mb-1 px-2">
                    <span className="text-[10px] font-bold text-purple-gray uppercase tracking-wider">Severity Breakdown</span>
                    <span className="text-[10px] text-muted font-mono">{totalFindings} Total</span>
                  </div>

                  {['critical', 'high', 'medium', 'low'].map((sev) => {
                    const count = severityCounts[sev as keyof typeof severityCounts];
                    const colors = SEVERITY_COLORS[sev];
                    const isSelected = selectedSeverity === sev;
                    const pct = totalFindings > 0 ? (count / totalFindings) * 100 : 0;

                    if (!colors) return null;

                    return (
                      <button
                        key={sev}
                        onClick={() => handleSeverityClick(sev as any)}
                        className={`flex flex-col justify-center px-2 py-1.5 rounded-lg transition-all hover:bg-white/5 text-left group ${isSelected ? `bg-white/10 ring-1 ring-${colors.text.split('-')[1]}` : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] uppercase font-bold tracking-wider transition-colors ${isSelected ? colors.text : 'text-muted group-hover:text-white'}`}>
                            {sev}
                          </span>
                          <span className="text-[10px] text-white font-mono font-bold tabular-nums ml-auto block text-right">{String(count).padStart(2, '0')}</span>
                        </div>
                        <div className="h-1 bg-purple-medium/40 rounded-full overflow-hidden w-full">
                          <div className={`h-full ${colors.bg.replace('/10', '').replace('/15', '')} rounded-full transition-all group-hover:brightness-125`} style={{ width: `${pct}%`, backgroundColor: colors.fill }} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right Side: Donut Chart */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%" cy="50%"
                          innerRadius={30} outerRadius={50}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={chartColors[i]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-sm font-black text-white/50">{totalFindings}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Card: Finding Categories Breakdown */}
              <div className="dashboard-card px-4 py-3">
                <h3 className="text-[10px] font-bold text-purple-gray uppercase tracking-wider mb-2">Top Categories</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {findingsByType.slice(0, 6).map((item) => {
                    const pct = totalFindings > 0 ? (item.value / totalFindings) * 100 : 0;
                    const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.low;
                    const isSelected = selectedCategory === item.name;
                    return (
                      <button
                        key={item.name}
                        onClick={() => onCategoryClick(item.name)}
                        className={`flex flex-col justify-center p-2 rounded-lg transition-all hover:bg-white/5 text-left group ${isSelected ? 'bg-white/10 ring-1 ring-coral/50' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] truncate max-w-[100px] transition-colors ${isSelected ? 'text-coral font-bold' : 'text-muted group-hover:text-white'}`}>
                            {item.name}
                          </span>
                          <span className="text-[9px] text-white font-bold">{item.value}</span>
                        </div>
                        <div className="h-1 bg-purple-medium/40 rounded-full overflow-hidden w-full">
                          <div className={`h-full ${colors.bar} rounded-full transition-all group-hover:brightness-125`} style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ DOWNLOAD SECTION ═══ */}

          {/* ═══ DOWNLOAD SECTION ═══ */}
          {(markdown || findings.length > 0) && (
            <div className="dashboard-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <ArrowDownTrayIcon className="h-4 w-4 text-purple-gray" />
                <span className="text-xs font-semibold text-purple-gray uppercase tracking-wider">Download Report Files</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {downloadFiles.map(({ filename, label, icon }) => (
                  <button
                    key={filename}
                    onClick={() => handleDownload(filename)}
                    className="px-3 py-2 bg-purple-light/80 hover:bg-purple-elevated text-white rounded-lg text-xs font-medium transition-all flex items-center gap-2 border border-white/10 hover:border-white/25 hover:scale-105"
                    title={`Download ${filename}`}
                  >
                    <DocumentTextIcon className="h-3.5 w-3.5 text-coral" />
                    {label}
                    <span className="text-purple-gray font-mono text-[10px]">.{icon.toLowerCase()}</span>
                  </button>
                ))}
                <button
                  onClick={handleDownloadAll}
                  disabled={zipping}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 hover:scale-105 ml-auto"
                  title="Download all files as ZIP"
                >
                  {zipping ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Zipping...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Download All (.zip)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )
      }


      {/* ═══ ACTIVE FILTER BANNER ═══ */}
      {
        (selectedSeverity !== 'all' || selectedCategory) && (
          <div className="flex items-center justify-between bg-purple-medium/50 rounded-xl p-3 border border-white/5">
            <span className="text-purple-gray text-sm flex items-center gap-2">
              Showing
              {selectedSeverity !== 'all' && (
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${SEVERITY_COLORS[selectedSeverity]?.bg} ${SEVERITY_COLORS[selectedSeverity]?.text}`}>
                  {selectedSeverity}
                </span>
              )}
              {selectedCategory && (
                <span className="font-bold text-coral bg-coral/10 px-2 py-0.5 rounded text-[10px]">
                  {selectedCategory}
                </span>
              )}
              findings ({filteredFindings.length})
            </span>
            <button
              onClick={() => { setSelectedSeverity('all'); setSelectedCategory(null); setCurrentPage(1); }}
              className="text-xs font-bold text-muted hover:text-white uppercase tracking-wider transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filter
            </button>
          </div>
        )
      }

      {/* ═══ CONTENT TABS ═══ */}
      <div className="dashboard-card overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-glass-border/20">
          <button
            onClick={() => setActiveTab('findings')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'findings'
              ? 'text-coral border-b-2 border-coral'
              : 'text-muted hover:text-purple-gray'
              }`}
          >
            Findings ({filteredFindings.length})
          </button>
          {markdown && (
            <button
              onClick={() => setActiveTab('report')}
              className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'report'
                ? 'text-coral border-b-2 border-coral'
                : 'text-muted hover:text-purple-gray'
                }`}
            >
              Full Report
            </button>
          )}
        </div>

        {activeTab === 'findings' ? (
          /* ── FINDINGS LIST ── */
          <div>
            {filteredFindings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted">
                  {(selectedSeverity !== 'all' || selectedCategory) && findings.length > 0
                    ? `No findings match this filter (${findings.length} total — click "Clear Filter" to see all)`
                    : 'No findings to display'}
                </p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_90px_80px_60px_160px] text-[9px] text-muted uppercase tracking-widest px-4 py-2 border-b border-glass-border/10">
                  <span className="font-bold">Finding Name</span>
                  <span className="font-bold">Severity</span>
                  <span className="font-bold">Status</span>
                  <span className="font-bold">CVSS</span>
                  <span className="font-bold">URL</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-glass-border/10">
                  {paginatedFindings.map((finding, i) => {
                    const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i;
                    const isExpanded = expandedIdx === globalIdx;
                    const sev = finding.severity.toLowerCase();
                    const colors = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
                    const statusLabel = finding.status === 'VALIDATED_CONFIRMED' ? 'Confirmed' : finding.validated ? 'Validated' : 'Pending';
                    const statusColor = finding.status === 'VALIDATED_CONFIRMED'
                      ? 'text-emerald-400 bg-emerald-500/15'
                      : finding.validated ? 'text-blue-400 bg-blue-500/15' : 'text-yellow-400 bg-yellow-500/15';

                    return (
                      <div key={finding.id || i}>
                        {/* Row */}
                        <button
                          type="button"
                          onClick={() => setExpandedIdx(isExpanded ? null : globalIdx)}
                          className={`w-full grid grid-cols-[1fr_90px_80px_60px_160px] items-center px-4 py-2 text-left transition-colors hover:bg-purple-light/20 ${isExpanded ? 'bg-purple-light/15' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className={`h-3 w-3 flex-shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white tracking-tight truncate group-hover:text-coral transition-colors">{finding.title}</p>
                              {finding.type && finding.type !== finding.title && (
                                <p className="text-[9px] text-muted/70 truncate">{finding.type}</p>
                              )}
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase w-fit ${colors.bg} ${colors.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {finding.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${statusColor}`}>
                            {statusLabel}
                          </span>
                          <span className="text-sm text-white font-mono">
                            {finding.cvss_score != null ? finding.cvss_score : '-'}
                          </span>
                          <span className="text-xs text-coral/70 truncate" title={finding.url || ''}>
                            {finding.url || '-'}
                          </span>
                        </button>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-1 bg-purple-light/10 border-t border-glass-border/10">
                            <div className="grid grid-cols-3 gap-4 mt-3">
                              {/* Left column: main details */}
                              <div className="col-span-2 space-y-4">
                                {/* Exploitation Details (rendered as markdown) */}
                                {/* Exploitation Details (rendered as markdown) */}
                                {finding.exploitation_details && (
                                  <div>
                                    {finding.exploitation_details.trim().startsWith('{"result":') ? (
                                      (() => {
                                        try {
                                          const json = JSON.parse(finding.exploitation_details);
                                          return (
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                              <p className="text-xs text-muted uppercase tracking-wider font-bold mb-1">Validation Note</p>
                                              <p className="text-sm text-purple-gray">
                                                {json.reason || json.result || 'No details available.'}
                                              </p>
                                              {json.confidence && (
                                                <div className="mt-2 flex items-center gap-2">
                                                  <span className="text-[10px] text-muted">Confidence:</span>
                                                  <span className="text-[10px] text-white font-mono">{(json.confidence * 100).toFixed(0)}%</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        } catch (e) {
                                          return <MarkdownRenderer content={finding.exploitation_details} />;
                                        }
                                      })()
                                    ) : (
                                      <MarkdownRenderer content={finding.exploitation_details} />
                                    )}
                                  </div>
                                )}

                                {/* Reproduction Steps (if no exploitation_details) */}
                                {!finding.exploitation_details && finding.llm_reproduction_steps && finding.llm_reproduction_steps.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-coral uppercase tracking-wider mb-2">Reproduction Steps</h4>
                                    <ol className="space-y-1.5 text-sm text-purple-gray list-decimal list-inside">
                                      {finding.llm_reproduction_steps.map((step, si) => (
                                        <li key={si}>{step}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}

                                {/* Fallback description */}
                                {!finding.exploitation_details && !finding.llm_reproduction_steps?.length && finding.description && (
                                  <p className="text-sm text-purple-gray">{finding.description}</p>
                                )}
                              </div>

                              {/* Right column: metadata sidebar */}
                              <div className="space-y-3">
                                {/* CVSS Card */}
                                {finding.cvss_score != null && (
                                  <div className={`rounded-xl p-3 border ${colors.bg} border-white/5`}>
                                    <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">CVSS Score</p>
                                    <div className="flex items-baseline gap-2">
                                      <span className={`text-2xl font-bold ${colors.text}`}>{finding.cvss_score}</span>
                                      <span className={`text-xs font-semibold uppercase ${colors.text}`}>{finding.severity}</span>
                                    </div>
                                    {finding.cvss_vector && (
                                      <p className="text-[10px] font-mono text-muted mt-1.5 break-all">{finding.cvss_vector}</p>
                                    )}
                                  </div>
                                )}

                                {/* Technical details */}
                                <div className="rounded-xl p-3 bg-purple-medium/30 border border-white/5 space-y-2">
                                  <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Technical Details</p>
                                  {finding.parameter && (
                                    <div>
                                      <span className="text-[10px] text-muted">Parameter</span>
                                      <p className="text-xs text-white font-mono break-all">{finding.parameter}</p>
                                    </div>
                                  )}
                                  {finding.payload && (
                                    <div>
                                      <span className="text-[10px] text-muted">Payload</span>
                                      <p className="text-xs text-coral font-mono break-all bg-black/20 rounded px-2 py-1 mt-0.5">{finding.payload}</p>
                                    </div>
                                  )}
                                  {finding.source && (
                                    <div>
                                      <span className="text-[10px] text-muted">Source</span>
                                      <p className="text-xs text-purple-gray font-mono">{finding.source}</p>
                                    </div>
                                  )}
                                  {finding.url && (
                                    <div>
                                      <span className="text-[10px] text-muted">URL</span>
                                      <p className="text-xs text-coral/80 font-mono break-all">{finding.url}</p>
                                    </div>
                                  )}
                                </div>

                                {/* CVSS Rationale */}
                                {finding.cvss_rationale && (
                                  <div className="rounded-xl p-3 bg-purple-medium/30 border border-white/5">
                                    <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">CVSS Rationale</p>
                                    <p className="text-xs text-purple-gray leading-relaxed">{finding.cvss_rationale}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-glass-border/20">
                  <span className="text-xs text-muted">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredFindings.length)} of {filteredFindings.length} findings
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-lg text-xs text-purple-gray hover:text-white bg-purple-light/40 hover:bg-purple-elevated/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-purple-gray">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-lg text-xs text-purple-gray hover:text-white bg-purple-light/40 hover:bg-purple-elevated/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── FULL MARKDOWN REPORT ── */
          <div className="p-6 text-purple-gray overflow-x-auto">
            <MarkdownRenderer content={markdown} />
          </div>
        )}
      </div>
    </div >
  );
};
