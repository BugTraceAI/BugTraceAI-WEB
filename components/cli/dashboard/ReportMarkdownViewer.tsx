// components/cli/dashboard/ReportMarkdownViewer.tsx
// v3.0 - Major redesign matching reference mockup
/* eslint-disable max-lines -- Report markdown viewer component (~420 lines).
 * Rich report viewer with metric cards, vulnerability chart, findings table,
 * download section, and markdown rendering. Presentation-heavy component.
 */
import React, { useState, useMemo } from 'react';
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
  high:     { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-500', bar: 'bg-orange-500', fill: '#f97316' },
  medium:   { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-500', bar: 'bg-yellow-500', fill: '#eab308' },
  low:      { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-500', bar: 'bg-blue-500', fill: '#3b82f6' },
};

const downloadFiles = [
  { filename: 'final_report.md', label: 'Report', icon: 'MD' },
  { filename: 'validated_findings.json', label: 'Validated', icon: 'JSON' },
  { filename: 'raw_findings.json', label: 'Raw', icon: 'JSON' },
  { filename: 'engagement_data.json', label: 'Engagement', icon: 'JSON' },
  { filename: 'validated_findings.md', label: 'Validated', icon: 'MD' },
  { filename: 'raw_findings.md', label: 'Raw MD', icon: 'MD' },
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

export const ReportMarkdownViewer: React.FC<ReportMarkdownViewerProps> = ({ report, onBack }) => {
  const {
    markdown,
    findings,
    scanStats,
    loading,
    error,
    selectedSeverity,
    filteredFindings,
    setSelectedSeverity,
    handleCardClick,
    loadData,
  } = useReportViewer(report.id);

  const [zipping, setZipping] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'findings' | 'report'>('findings');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const CLI_API_URL = import.meta.env.VITE_CLI_API_URL || 'http://localhost:8000';

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

  const handleDownload = (filename: string) => {
    const fileUrl = `${CLI_API_URL}/api/scans/${report.id}/files/${filename}`;
    window.open(fileUrl, '_blank');
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
    <div className="space-y-5">
      {/* ═══ HEADER BAR ═══ */}
      <div className="dashboard-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={onBack}
                className="text-xs text-purple-gray hover:text-coral transition-colors uppercase tracking-wider font-semibold"
              >
                Reports
              </button>
              <span className="text-muted text-xs">&rsaquo;</span>
              <span className="text-xs text-white uppercase tracking-wider font-semibold">Detailed Assessment</span>
            </div>
            {/* Target URL */}
            <h1 className="text-lg font-bold text-white truncate">{report.target_url || 'Unknown Target'}</h1>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-purple-gray font-medium">
              SCAN #{report.id} &bull; {formatDate(report.scan_date)}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ METRIC CARDS ═══ */}
      <div className="grid grid-cols-4 gap-3">
        {/* Total Findings */}
        <div className="dashboard-card p-4 border-l-4 border-purple-500">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">Total Findings</p>
          <p className="text-3xl font-bold text-white">{totalFindings}</p>
          <div className="mt-2 h-1.5 bg-purple-medium/40 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Critical */}
        <button
          onClick={() => handleSeverityClick('critical')}
          className={`dashboard-card p-4 border-l-4 border-red-500 text-left transition-all hover:scale-[1.02] ${selectedSeverity === 'critical' ? 'ring-1 ring-red-500/50' : ''}`}
        >
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">Critical</p>
          <p className="text-3xl font-bold text-white">{String(severityCounts.critical).padStart(2, '0')}</p>
          <div className="mt-2 h-1.5 bg-purple-medium/40 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: totalFindings > 0 ? `${(severityCounts.critical / totalFindings) * 100}%` : '0%' }} />
          </div>
        </button>

        {/* High */}
        <button
          onClick={() => handleSeverityClick('high')}
          className={`dashboard-card p-4 border-l-4 border-orange-500 text-left transition-all hover:scale-[1.02] ${selectedSeverity === 'high' ? 'ring-1 ring-orange-500/50' : ''}`}
        >
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">High Risk</p>
          <p className="text-3xl font-bold text-white">{String(severityCounts.high).padStart(2, '0')}</p>
          <div className="mt-2 h-1.5 bg-purple-medium/40 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: totalFindings > 0 ? `${(severityCounts.high / totalFindings) * 100}%` : '0%' }} />
          </div>
        </button>

        {/* Medium */}
        <button
          onClick={() => handleSeverityClick('medium')}
          className={`dashboard-card p-4 border-l-4 border-yellow-500 text-left transition-all hover:scale-[1.02] ${selectedSeverity === 'medium' ? 'ring-1 ring-yellow-500/50' : ''}`}
        >
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1">Medium</p>
          <p className="text-3xl font-bold text-white">{String(severityCounts.medium).padStart(2, '0')}</p>
          <div className="mt-2 h-1.5 bg-purple-medium/40 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: totalFindings > 0 ? `${(severityCounts.medium / totalFindings) * 100}%` : '0%' }} />
          </div>
        </button>
      </div>

      {/* ═══ CHARTS ROW ═══ */}
      {totalFindings > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Vulnerability Distribution - Donut + Legend */}
          <div className="dashboard-card p-5">
            <h3 className="text-xs font-semibold text-purple-gray uppercase tracking-wider mb-4">Vulnerability Distribution</h3>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%" cy="50%"
                      innerRadius={36} outerRadius={56}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={chartColors[i]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-white">{totalFindings}</span>
                  <span className="text-[9px] text-muted uppercase tracking-wider">Total</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2">
                {chartData.map((entry) => {
                  const colors = SEVERITY_COLORS[entry.name.toLowerCase()];
                  return (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors?.dot || 'bg-gray-500'}`} />
                        <span className="text-purple-gray">{entry.name}</span>
                      </div>
                      <span className="text-white font-semibold">{entry.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Finding Categories Breakdown */}
          <div className="dashboard-card p-5">
            <h3 className="text-xs font-semibold text-purple-gray uppercase tracking-wider mb-4">Findings by Category</h3>
            <div className="space-y-2.5 max-h-[148px] overflow-y-auto pr-1">
              {findingsByType.slice(0, 8).map((item) => {
                const pct = totalFindings > 0 ? (item.value / totalFindings) * 100 : 0;
                const colors = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.low;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-purple-gray truncate mr-2">{item.name}</span>
                      <span className="text-xs text-white font-medium flex-shrink-0">{item.value}</span>
                    </div>
                    <div className="h-1.5 bg-purple-medium/40 rounded-full overflow-hidden">
                      <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCAN INFO & TECHNOLOGY STACK ═══ */}
      {scanStats && (scanStats.duration || scanStats.tech_stack) && (
        <div className="grid grid-cols-2 gap-4">
          {/* Scan Info */}
          <div className="dashboard-card p-5">
            <h3 className="text-xs font-semibold text-purple-gray uppercase tracking-wider mb-4">Scan Info</h3>
            <div className="space-y-3">
              {scanStats.duration && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Duration</span>
                  <span className="text-sm text-white font-mono">{scanStats.duration}</span>
                </div>
              )}
              {scanStats.urls_scanned != null && scanStats.urls_scanned > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">URLs Scanned</span>
                  <span className="text-sm text-white font-mono">{scanStats.urls_scanned}</span>
                </div>
              )}
              {scanStats.total_tokens != null && scanStats.total_tokens > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">LLM Tokens</span>
                  <span className="text-sm text-white font-mono">{scanStats.total_tokens.toLocaleString()}</span>
                </div>
              )}
              {scanStats.estimated_cost != null && scanStats.estimated_cost > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">API Cost</span>
                  <span className="text-sm text-emerald-400 font-mono">${scanStats.estimated_cost.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Technology Stack */}
          <div className="dashboard-card p-5 overflow-hidden">
            <h3 className="text-xs font-semibold text-purple-gray uppercase tracking-wider mb-4">Technology Stack</h3>
            {scanStats.tech_stack?.technologies && scanStats.tech_stack.technologies.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {scanStats.tech_stack.technologies.map((tech) => (
                  <div key={tech.name} className="flex items-center justify-between py-1 border-b border-glass-border/10 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-white font-medium truncate">{tech.name}</span>
                      {tech.eol && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-500/20 text-red-400">EOL</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] text-muted">{tech.category}</span>
                      <span className="text-xs text-coral font-mono">{tech.version || '-'}</span>
                    </div>
                  </div>
                ))}
                {scanStats.tech_stack.waf && scanStats.tech_stack.waf.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-yellow-500/20 text-yellow-400">WAF</span>
                    <span className="text-xs text-purple-gray">{scanStats.tech_stack.waf.join(', ')}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">No technology data available</p>
            )}
          </div>
        </div>
      )}

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

      {/* ═══ ACTIVE FILTER BANNER ═══ */}
      {selectedSeverity !== 'all' && (
        <div className="flex items-center justify-between bg-purple-medium/50 rounded-xl p-3">
          <span className="text-purple-gray text-sm">
            Showing <span className="font-semibold text-white capitalize">{selectedSeverity}</span> findings ({filteredFindings.length})
          </span>
          <button
            onClick={() => { setSelectedSeverity('all'); setCurrentPage(1); }}
            className="text-coral hover:text-coral-hover text-sm transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* ═══ CONTENT TABS ═══ */}
      <div className="dashboard-card overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-glass-border/20">
          <button
            onClick={() => setActiveTab('findings')}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'findings'
                ? 'text-coral border-b-2 border-coral'
                : 'text-muted hover:text-purple-gray'
            }`}
          >
            Findings ({filteredFindings.length})
          </button>
          {markdown && (
            <button
              onClick={() => setActiveTab('report')}
              className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'report'
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
                <p className="text-muted">No findings to display</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_100px_90px_70px_180px] text-[10px] text-muted uppercase tracking-wider px-5 py-2.5 border-b border-glass-border/20">
                  <span className="font-semibold">Finding Name</span>
                  <span className="font-semibold">Severity</span>
                  <span className="font-semibold">Status</span>
                  <span className="font-semibold">CVSS</span>
                  <span className="font-semibold">URL</span>
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
                          className={`w-full grid grid-cols-[1fr_100px_90px_70px_180px] items-center px-5 py-3 text-left transition-colors hover:bg-purple-light/20 ${isExpanded ? 'bg-purple-light/15' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className={`h-3 w-3 flex-shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-sm text-white font-medium truncate">{finding.title}</p>
                              {finding.type && finding.type !== finding.title && (
                                <p className="text-[10px] text-muted truncate">{finding.type}</p>
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
                                {finding.exploitation_details && (
                                  <div>
                                    <MarkdownRenderer content={finding.exploitation_details} />
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
    </div>
  );
};
