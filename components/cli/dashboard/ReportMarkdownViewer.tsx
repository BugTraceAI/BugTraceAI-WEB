// components/cli/dashboard/ReportMarkdownViewer.tsx
// v3.1 - Refactored: pure functions extracted to lib/
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { MarkdownRenderer } from '../../MarkdownRenderer.tsx';
import { ArrowPathIcon, ArrowDownTrayIcon, DocumentTextIcon, InformationCircleIcon } from '../../Icons.tsx';
import { useReportViewer, Finding } from '../../../hooks/useReportViewer.ts';
import type { FindingItem } from '../../../lib/cliApi.ts';
import type { ExploitSeed } from '../../../types.ts';
import { isRepeaterEligible, mapReproToSeed } from '../../../services/finisherSeed.ts';
import { getFindingHttpEvidence, getFindingNarrative } from '../../../services/reportFindingPresentation.ts';
import {
  sortFindings, sortDetections, groupByType, formatDate, buildFullMarkdown,
  computeSeverityCounts, computeTotalFindings, paginate, totalPages,
  type SortCol, type DetSortCol, type SortDir,
} from '../../../lib/markdownTransformers.ts';
import {
  SEVERITY_COLORS, downloadFiles, buildReportSummary, buildFindingMessage, buildDetectionMessage,
  type CLIReport, type AttackChain,
} from '../../../lib/reportExportUtils.ts';

interface ReportMarkdownViewerProps {
  report: CLIReport;
  onBack: () => void;
  onSendToRepeater?: (seed: ExploitSeed) => void;
}

const ITEMS_PER_PAGE = 10;

// Detections: severity ordering for group badges + "prevalidated" predicate (scanner
// is confident enough to surface it, even if shown in the raw detections view).
const DET_SEV_RANK: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const isDetPrevalidated = (d: { status?: string; validated?: boolean }): boolean => {
  const status = d.status?.toUpperCase();
  if (status) return status === 'VALIDATED_CONFIRMED' || status === 'VALIDATED';
  return Boolean(d.validated);
};

export const ReportMarkdownViewer: React.FC<ReportMarkdownViewerProps> = ({ report, onBack, onSendToRepeater }) => {
  const {
    markdown,
    findings,
    detections,
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
  const [enriching, setEnriching] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState<string | null>(null);
  const [sendingToChat, setSendingToChat] = useState(false);
  const [sendingFindingId, setSendingFindingId] = useState<string | number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [detectionsPage, setDetectionsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'findings' | 'detections' | 'report'>('findings');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [expandedDetGroups, setExpandedDetGroups] = useState<Set<string>>(new Set());
  const toggleDetGroup = (type: string) => setExpandedDetGroups((prev) => {
    const next = new Set(prev);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });
  const [sort, setSort] = useState<{ col: SortCol | null; dir: SortDir }>({ col: null, dir: 'desc' });
  const [detSort, setDetSort] = useState<{ col: DetSortCol | null; dir: SortDir }>({ col: null, dir: 'desc' });
  const [showMetrics, setShowMetrics] = useState(false);
  const [showZipNotice, setShowZipNotice] = useState(() => {
    return localStorage.getItem('hideZipNotice') !== 'true';
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [highlightDownload, setHighlightDownload] = useState(false);

  useEffect(() => {
    // If the modal is hidden by default, flash the download button on mount
    if (!showZipNotice) {
      setHighlightDownload(true);
      const timer = setTimeout(() => setHighlightDownload(false), 2500);
      return () => clearTimeout(timer);
    }
  }, []); // Run only once on mount

  const handleContinue = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideZipNotice', 'true');
    }
    setShowZipNotice(false);
    setHighlightDownload(true);
    setTimeout(() => setHighlightDownload(false), 2500);
  };
  const CLI_API_URL = import.meta.env.VITE_CLI_API_URL || '/cli-api';
  const WEB_API_URL = import.meta.env.VITE_API_URL || '/api';

  // Compute severity counts
  const severityCounts = computeSeverityCounts(report.severity_summary, findings);
  const totalFindings = computeTotalFindings(severityCounts);

  // Donut chart data
  const chartData = useMemo(() => [
    { name: 'Critical', value: severityCounts.critical },
    { name: 'High', value: severityCounts.high },
    { name: 'Medium', value: severityCounts.medium },
    { name: 'Low', value: severityCounts.low },
    { name: 'Info', value: severityCounts.info || 0 },
  ].filter(d => d.value > 0), [severityCounts]);

  const chartColors = chartData.map(d => SEVERITY_COLORS[d.name.toLowerCase()]?.fill || '#6b7280');

  // Grouped findings for legend
  const findingsByType = useMemo(() => groupByType(findings), [findings]);

  // Sorting
  const sortedFindings = useMemo(() => {
    if (!sort.col) return filteredFindings;
    return sortFindings(filteredFindings, sort.col, sort.dir);
  }, [filteredFindings, sort]);

  const handleSort = (col: SortCol) => {
    setSort(prev => {
      if (prev.col === col) {
        return { col, dir: prev.dir === 'asc' ? 'desc' as SortDir : 'asc' as SortDir };
      }
      return { col, dir: (col === 'name' || col === 'url') ? 'asc' as SortDir : 'desc' as SortDir };
    });
    setCurrentPage(1);
    setExpandedIdx(null);
  };

  // Pagination
  const findingsTotalPages = totalPages(sortedFindings.length, ITEMS_PER_PAGE);
  const paginatedFindings = paginate(sortedFindings, currentPage, ITEMS_PER_PAGE);

  // Build enhanced markdown with detections table appended
  const fullMarkdown = useMemo(() => buildFullMarkdown(markdown, detections), [markdown, detections]);

  // Detections sorting
  const sortedDetections = useMemo(() => {
    if (!detSort.col) return detections;
    return sortDetections(detections, detSort.col, detSort.dir);
  }, [detections, detSort]);

  const handleDetSort = (col: DetSortCol) => {
    setDetSort(prev => {
      if (prev.col === col) {
        return { col, dir: prev.dir === 'asc' ? 'desc' as SortDir : 'asc' as SortDir };
      }
      return { col, dir: (col === 'type' || col === 'parameter') ? 'asc' as SortDir : 'desc' as SortDir };
    });
    setDetectionsPage(1);
    setExpandedDetGroups(new Set());
  };

  // Detections grouping — collapse same-type detections into one expandable group
  // (e.g. 18 "missing security header" rows → a single "MISSING_SECURITY_HEADER ×18").
  const groupedDetections = useMemo(() => {
    const map = new Map<string, FindingItem[]>();
    for (const d of sortedDetections) {
      const key = d.type || 'Unknown';
      const arr = map.get(key);
      if (arr) arr.push(d); else map.set(key, [d]);
    }
    return Array.from(map.entries()).map(([type, items]) => {
      const topSev = items.reduce((m, d) => {
        const r = DET_SEV_RANK[(d.severity || 'info').toLowerCase()] || 1;
        return r > m.r ? { r, sev: d.severity || 'info' } : m;
      }, { r: 0, sev: 'info' });
      return { type, items, severity: topSev.sev, prevalidated: items.filter(isDetPrevalidated).length };
    });
  }, [sortedDetections]);

  // Detections pagination (by GROUP, not by individual detection)
  const detTotalPages = totalPages(groupedDetections.length, ITEMS_PER_PAGE);
  const paginatedDetGroups = paginate(groupedDetections, detectionsPage, ITEMS_PER_PAGE);

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
      const res = await fetch(`${CLI_API_URL}/api/scans/${report.id}/report-zip`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `scan-${report.id}-report.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download ZIP:', err);
      alert('Could not download report ZIP. Check that the CLI API is reachable.');
    } finally {
      setZipping(false);
    }
  };

  // Live enrichment status — drives the self-heal "Enrich" button when a report came out
  // under-enriched (empty CVSS/PoC), and reflects an in-progress (auto or manual) re-enrich.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${CLI_API_URL}/api/scans/${report.id}/status`);
        if (!res.ok || !alive) return;
        const d = await res.json();
        if (!alive) return;
        setEnrichmentStatus(d.enrichment_status ?? null);
        if (d.enrichment_status === 'pending') setEnriching(true);
      } catch { /* ignore — the button just won't show */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  // While a re-enrichment runs, poll until it settles, then refresh the report data so the
  // freshly-enriched CVSS/PoC appear without a manual reload.
  useEffect(() => {
    if (!enriching) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch(`${CLI_API_URL}/api/scans/${report.id}/status`);
        if (res.ok) {
          const d = await res.json();
          const st = (d.enrichment_status ?? null) as string | null;
          setEnrichmentStatus(st);
          if (st !== 'pending') {
            setEnriching(false);
            if (st === 'full') loadData();
          }
        }
      } catch { /* keep polling */ }
      if (tries >= 20) setEnriching(false); // cap ~5 min
    }, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriching, report.id]);

  const handleReEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`${CLI_API_URL}/api/scans/${report.id}/re-enrich`, { method: 'POST' });
      if (!res.ok) {
        setEnriching(false);
        if (res.status === 503) alert('The AI models are currently unavailable (no credits or offline). Try Enrich again in a few minutes.');
        else if (res.status === 409) alert('This scan is not finished yet — wait for it to complete before enriching.');
        else alert('Could not start enrichment. Check that the CLI API is reachable.');
        return;
      }
      setEnrichmentStatus('pending'); // the poll effect (via enriching=true) takes over
    } catch {
      setEnriching(false);
      alert('Could not start enrichment. Check that the CLI API is reachable.');
    }
  };

  const handleSendToChat = async () => {
    setSendingToChat(true);
    try {
      // 1. Fetch attack chains (non-blocking -- empty array on failure)
      let attackChains: AttackChain[] = [];
      try {
        const chainsRes = await fetch(`${CLI_API_URL}/api/scans/${report.id}/files/attack_chains.json`);
        if (chainsRes.ok) {
          const data = await chainsRes.json();
          attackChains = data.chains || [];
        }
      } catch { /* attack chains not available -- continue without them */ }

      // 2. Create a new chat session
      const sessionRes = await fetch(`${WEB_API_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: 'websec',
          title: `Report: ${report.target_url}`.substring(0, 250),
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

  // Send a single validated finding to chat
  const handleSendFindingToChat = async (f: Finding, e: React.MouseEvent) => {
    e.stopPropagation();
    const fid = f.id || f.title || f.type;
    setSendingFindingId(fid);
    try {
      const msg = buildFindingMessage(f, report.target_url);
      const findingTitle = f.title || f.type || 'Finding';

      const sessionRes = await fetch(`${WEB_API_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_type: 'websec', title: `${findingTitle} — ${report.target_url}`.substring(0, 250) }),
      });
      if (!sessionRes.ok) throw new Error('Failed to create chat session');
      const { data: session } = await sessionRes.json();

      await fetch(`${WEB_API_URL}/chats/${session.id}/messages/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: msg }] }),
      });
      navigate(`/chat/${session.id}`);
    } catch (err) {
      console.error('Failed to send finding to chat:', err);
    } finally {
      setSendingFindingId(null);
    }
  };

  // Send a single detection to chat
  const handleSendDetectionToChat = async (d: FindingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSendingFindingId(d.finding_id);
    try {
      const msg = buildDetectionMessage(d, report.target_url);

      const sessionRes = await fetch(`${WEB_API_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_type: 'websec', title: `Detection: ${d.type} — ${report.target_url}`.substring(0, 250) }),
      });
      if (!sessionRes.ok) throw new Error('Failed to create chat session');
      const { data: session } = await sessionRes.json();

      await fetch(`${WEB_API_URL}/chats/${session.id}/messages/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: msg }] }),
      });
      navigate(`/chat/${session.id}`);
    } catch (err) {
      console.error('Failed to send detection to chat:', err);
    } finally {
      setSendingFindingId(null);
    }
  };

  // ── SEND TO REPEATER (The Finisher) ───────────────────────────────────────
  // Build an ExploitSeed from a CLI finding/detection and hand it to the parent,
  // which seeds the AI Repeater (View.FINISHER) and navigates. Synchronous — the
  // navigation happens in App.tsx, so no per-icon loading state is needed.
  // If the scan cracked a JWT signing secret ("Weak JWT Secret" finding), expose it so the
  // Repeater can forge admin tokens for auto-auth — the secret lives in the finding's payload.
  const crackedJwtSecret = useMemo(() => {
    const all: any[] = [...(findings || []), ...(detections || [])];
    const jwt = all.find((f) => {
      const t = String(f?.type || f?.title || '').toLowerCase();
      return t.includes('jwt') && (t.includes('secret') || t.includes('weak'));
    });
    const secret = jwt?.payload;
    return typeof secret === 'string' && secret ? secret : undefined;
  }, [findings, detections]);

  const numericScanId = Number(report.id);
  const buildSeedFromFinding = (f: Finding): ExploitSeed => ({
    scanId: Number.isFinite(numericScanId) ? numericScanId : undefined,
    findingId: typeof f.id === 'number' ? f.id : typeof f.id === 'string' ? Number(f.id) : undefined,
    vulnType: f.type || f.title || 'UNKNOWN',
    url: f.url || report.target_url,
    parameter: f.parameter,
    reflectingPayloads: f.payload ? [f.payload] : undefined,
    status: f.status,
    whyStalled: f.validator_notes || undefined,
    confidence: f.confidence_score ?? f.fp_confidence,
    jwtSecret: crackedJwtSecret,
    ...mapReproToSeed((f as unknown as { repro?: unknown }).repro),
  });

  const handleSendToRepeater = () => {
    const top = findings.find((f) => isRepeaterEligible(f.type || f.title)) || findings[0];
    if (top) onSendToRepeater?.(buildSeedFromFinding(top));
  };

  const handleSendFindingToRepeater = (f: Finding, e: React.MouseEvent) => {
    e.stopPropagation();
    onSendToRepeater?.(buildSeedFromFinding(f));
  };

  const handleSendDetectionToRepeater = (d: FindingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onSendToRepeater?.({
      scanId: Number.isFinite(numericScanId) ? numericScanId : undefined,
      findingId: d.finding_id,
      vulnType: d.type || 'UNKNOWN',
      url: d.url || report.target_url,
      parameter: d.parameter,
      reflectingPayloads: d.payload ? [d.payload] : undefined,
      status: d.status,
      whyStalled: d.details,
      confidence: d.confidence,
      jwtSecret: crackedJwtSecret,
      ...mapReproToSeed((d as unknown as { repro?: unknown }).repro),
    });
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
      {/* HEADER BAR */}
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
              {scanStats?.duration && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span className="text-emerald-400">{scanStats.duration}</span>
                </>
              )}
              {scanStats?.urls_scanned != null && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span>{scanStats.urls_scanned} URLs</span>
                </>
              )}
              {scanStats?.scan_type && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span className="text-violet-400 uppercase">{scanStats.scan_type}</span>
                </>
              )}
              {scanStats?.max_depth != null && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span>D:{scanStats.max_depth}</span>
                </>
              )}
              {scanStats?.max_urls != null && (
                <>
                  <span className="text-white/20">&bull;</span>
                  <span>Max:{scanStats.max_urls}</span>
                </>
              )}
            </div>
          </div>

          {/* Tech Stack Mini-Badges */}
          {scanStats?.tech_stack?.technologies && (
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

            {(enrichmentStatus === 'none' || enrichmentStatus === 'partial' || enriching) && (
              <button
                onClick={handleReEnrich}
                disabled={enriching}
                title="This scan experienced a problem. We can enrich the report — it will take some minutes."
                className="text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 px-3 py-1 rounded-lg border disabled:cursor-not-allowed text-amber-400 hover:text-amber-300 bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 disabled:opacity-60"
              >
                {enriching ? (
                  <>
                    <div className="h-3 w-3 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                    Enriching...
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-3 w-3" />
                    Enrich
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleDownloadAll}
              disabled={zipping}
              className={`text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 px-3 py-1 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed ${
                highlightDownload
                  ? 'bg-emerald-500/30 text-white border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.5)] animate-pulse'
                  : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40'
              }`}
            >
              {zipping ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                  Zipping...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-3 w-3" />
                  Download ZIP
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
          {/* METRIC CARDS */}
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

                  {['critical', 'high', 'medium', 'low', 'info'].map((sev) => {
                    const count = severityCounts[sev as keyof typeof severityCounts] || 0;
                    const colors = SEVERITY_COLORS[sev];
                    const isSelected = selectedSeverity === sev;
                    const pct = totalFindings > 0 ? (count / totalFindings) * 100 : 0;

                    if (!colors || (sev === 'info' && count === 0)) return null;

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

          {/* DOWNLOAD SECTION */}
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
              </div>
            </div>
          )}
        </div>
      )
      }


      {/* ZIP NOTICE MODAL */}
      {showZipNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="dashboard-card border border-white/5 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-1">
                <InformationCircleIcon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Visual Summary</h3>
              <p className="text-xs text-purple-gray leading-relaxed mb-2 px-2">
                This is a high-level overview. For exploits, raw data, and full context, please download the ZIP archive.
              </p>
              
              <div className="flex w-full justify-center mt-2">
                <button
                  onClick={handleContinue}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-widest bg-coral/10 hover:bg-coral/20 text-coral transition-colors border border-coral/20 hover:border-coral/40 rounded-xl"
                >
                  Continue
                </button>
              </div>

              <label className="flex items-center gap-2 mt-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-black/20 text-coral focus:ring-coral focus:ring-offset-0 transition-all cursor-pointer"
                />
                <span className="text-[10px] text-muted group-hover:text-purple-gray transition-colors select-none uppercase tracking-wider font-semibold">
                  Don't show again
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE FILTER BANNER */}
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

      {/* CONTENT TABS */}
      <div className="dashboard-card overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-glass-border/20">
          <button
            onClick={() => setActiveTab('findings')}
            title="Validated vulnerabilities confirmed through multi-stage verification (L1-L5 escalation). These are real, exploitable issues."
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'findings'
              ? 'text-coral border-b-2 border-coral'
              : 'text-muted hover:text-purple-gray'
              }`}
          >
            Findings ({filteredFindings.length})
          </button>
          {detections.length > 0 && (
            <button
              onClick={() => setActiveTab('detections')}
              title="Raw detections from scanning agents before final report validation. Includes probes, canaries, unconfirmed signals, and prevalidated results that may still require manual review."
              className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${activeTab === 'detections'
                ? 'text-coral border-b-2 border-coral'
                : 'text-muted hover:text-purple-gray'
                }`}
            >
              ALL DETECTIONS ({detections.length})
            </button>
          )}
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
          /* FINDINGS LIST */
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
                {/* Table header -- sortable */}
                <div className="grid grid-cols-[1fr_90px_80px_60px_160px_72px] text-[9px] text-muted uppercase tracking-widest px-4 py-2 border-b border-glass-border/10">
                  {([['name', 'Finding Name'], ['severity', 'Severity'], ['status', 'Status'], ['cvss', 'CVSS'], ['url', 'URL']] as [SortCol, string][]).map(([col, label]) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleSort(col)}
                      className={`font-bold text-left flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${sort.col === col ? 'text-coral' : ''}`}
                    >
                      {label}
                      {sort.col === col && (
                        <svg className={`w-2.5 h-2.5 transition-transform ${sort.dir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                  <span />
                </div>

                {/* Rows */}
                <div className="divide-y divide-glass-border/10">
                  {paginatedFindings.map((finding, i) => {
                    const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + i;
                    const isExpanded = expandedIdx === globalIdx;
                    const sev = (finding.severity || 'info').toLowerCase();
                    const colors = SEVERITY_COLORS[sev] || SEVERITY_COLORS.low;
                    const statusLabel = finding._needsReview
                      ? 'Needs Review'
                      : finding.status === 'VALIDATED_CONFIRMED' ? 'Confirmed' : finding.validated ? 'Validated' : 'Pending';
                    const statusColor = finding._needsReview
                      ? 'text-violet-300 bg-violet-500/15'
                      : finding.status === 'VALIDATED_CONFIRMED'
                        ? 'text-emerald-400 bg-emerald-500/15'
                        : finding.validated ? 'text-blue-400 bg-blue-500/15' : 'text-yellow-400 bg-yellow-500/15';
                    const narrative = getFindingNarrative(finding);
                    const httpEvidence = getFindingHttpEvidence(finding);

                    return (
                      <div key={finding.id || i}>
                        {/* Row */}
                        <button
                          type="button"
                          onClick={() => setExpandedIdx(isExpanded ? null : globalIdx)}
                          className={`w-full grid grid-cols-[1fr_90px_80px_60px_160px_72px] items-center px-4 py-2 text-left transition-colors hover:bg-purple-light/20 ${isExpanded ? 'bg-purple-light/15' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className={`h-3 w-3 flex-shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white tracking-tight truncate group-hover:text-coral transition-colors">{finding.title || finding.type}</p>
                              {finding.type && finding.title && finding.type !== finding.title && (
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
                          <div className="flex items-center justify-end gap-1">
                            <span
                              role="button"
                              tabIndex={0}
                              title="Send to Chat"
                              onClick={(e) => handleSendFindingToChat(finding, e)}
                              className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-coral hover:bg-coral/10 transition-colors cursor-pointer"
                            >
                              {sendingFindingId === (finding.id || finding.title || finding.type) ? (
                                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                                </svg>
                              )}
                            </span>
                            {onSendToRepeater && isRepeaterEligible(finding.type || finding.title) && (
                              <span
                                role="button"
                                tabIndex={0}
                                title="AIrepeater"
                                onClick={(e) => handleSendFindingToRepeater(finding, e)}
                                className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              >
                                <ArrowPathIcon className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
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
                                {!finding.exploitation_details && !finding.llm_reproduction_steps?.length && (
                                  <div className="text-sm text-purple-gray space-y-4">
                                    {narrative ? (
                                      <MarkdownRenderer content={narrative} />
                                    ) : (
                                      <p className="italic text-muted">No explicit description or exploitation details available.</p>
                                    )}
                                    {finding.validator_notes && !finding.validator_notes.includes('**CVSS Analysis**') && (
                                      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                        <p className="text-xs text-muted uppercase tracking-wider font-bold mb-2">Validation Notes</p>
                                        <MarkdownRenderer content={finding.validator_notes} />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Persisted HTTP proof is independent of optional LLM enrichment. */}
                                {httpEvidence && (
                                  <div className="space-y-3">
                                    {httpEvidence.request && (
                                      <div>
                                        <p className="text-xs text-muted uppercase tracking-wider font-bold mb-2">HTTP Request</p>
                                        <pre className="bg-black/30 border border-white/10 p-3 rounded-lg font-mono text-xs overflow-auto whitespace-pre-wrap break-all">{httpEvidence.request}</pre>
                                      </div>
                                    )}
                                    {(httpEvidence.response || httpEvidence.status != null) && (
                                      <div>
                                        <p className="text-xs text-muted uppercase tracking-wider font-bold mb-2">
                                          HTTP Response{httpEvidence.status != null ? ` — ${httpEvidence.status}` : ''}
                                        </p>
                                        {httpEvidence.response && (
                                          <pre className="bg-black/30 border border-white/10 p-3 rounded-lg font-mono text-xs overflow-auto whitespace-pre-wrap break-all max-h-80">{httpEvidence.response}</pre>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* PoC Screenshot — real browser capture of the exploit firing */}
                                {finding.screenshot_path && (
                                  <div className="mt-2">
                                    <p className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2">PoC Screenshot</p>
                                    <a
                                      href={`${CLI_API_URL}/api/scans/${report.id}/files/${finding.screenshot_path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open full-size screenshot"
                                    >
                                      <img
                                        src={`${CLI_API_URL}/api/scans/${report.id}/files/${finding.screenshot_path}`}
                                        alt="Proof-of-concept screenshot"
                                        loading="lazy"
                                        className="rounded-lg border border-white/10 max-h-96 w-auto hover:border-coral/40 transition-all"
                                      />
                                    </a>
                                  </div>
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
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedFindings.length)} of {sortedFindings.length} findings
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
                      {currentPage} / {findingsTotalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(findingsTotalPages, p + 1))}
                      disabled={currentPage === findingsTotalPages}
                      className="px-3 py-1 rounded-lg text-xs text-purple-gray hover:text-white bg-purple-light/40 hover:bg-purple-elevated/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'detections' ? (
          /* DETECTIONS LIST (all DB findings) */
          <div>
            {detections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted">No detections recorded for this scan</p>
              </div>
            ) : (
              <>
                {/* Table header -- sortable */}
                <div className="grid grid-cols-[1fr_90px_120px_80px_140px_72px] text-[9px] text-muted uppercase tracking-widest px-4 py-2 border-b border-glass-border/10">
                  {([['type', 'Type'], ['severity', 'Severity'], ['status', 'Status'], ['confidence', 'Confidence'], ['parameter', 'Parameter']] as [DetSortCol, string][]).map(([col, label]) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleDetSort(col)}
                      className={`font-bold text-left flex items-center gap-1 hover:text-white transition-colors cursor-pointer ${detSort.col === col ? 'text-coral' : ''}`}
                    >
                      {label}
                      {detSort.col === col && (
                        <svg className={`w-2.5 h-2.5 transition-transform ${detSort.dir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                  <span />
                </div>

                {/* Rows — grouped by type. Singletons render as a normal row; same-type
                    detections (e.g. missing headers) collapse into one ×N group. */}
                <div className="divide-y divide-glass-border/10">
                  {paginatedDetGroups.map((group) => {
                    const expanded = expandedDetGroups.has(group.type);
                    const sev = (group.severity || 'info').toLowerCase();
                    const colors = SEVERITY_COLORS[sev] || SEVERITY_COLORS.info;
                    const grouped = group.items.length > 1;
                    const single = group.items[0];
                    const statusLabel = group.prevalidated === group.items.length
                      ? 'Prevalidated'
                      : group.prevalidated === 0 ? 'Unconfirmed' : `${group.prevalidated}/${group.items.length} prevalidated`;
                    const statusColor = group.prevalidated > 0 ? 'text-sky-400 bg-sky-500/15' : 'text-amber-400 bg-amber-500/15';

                    const chatIcon = (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                      </svg>
                    );
                    const detActions = (det: FindingItem) => (
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <span role="button" tabIndex={0} title="Send to Chat" onClick={(e) => handleSendDetectionToChat(det, e)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-coral hover:bg-coral/10 transition-colors cursor-pointer">
                          {sendingFindingId === det.finding_id ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : chatIcon}
                        </span>
                        {onSendToRepeater && isDetPrevalidated(det) && isRepeaterEligible(det.type) && (
                          <span role="button" tabIndex={0} title="AIrepeater" onClick={(e) => handleSendDetectionToRepeater(det, e)}
                            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer">
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    );

                    return (
                      <div key={group.type}>
                        <button
                          type="button"
                          onClick={() => toggleDetGroup(group.type)}
                          className={`w-full grid grid-cols-[1fr_90px_120px_80px_140px_72px] items-center px-4 py-2 text-left transition-colors hover:bg-purple-light/20 ${expanded ? 'bg-purple-light/15' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className={`h-3 w-3 flex-shrink-0 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs font-bold text-white tracking-tight truncate">{group.type}</p>
                            {grouped && <span className="flex-none text-[10px] font-mono text-purple-300 bg-purple-accent/15 border border-purple-accent/25 px-1.5 py-0.5 rounded-full">×{group.items.length}</span>}
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase w-fit ${colors.bg} ${colors.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {group.severity}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${statusColor}`}>
                            {statusLabel}
                          </span>
                          <span className="text-sm text-white font-mono">
                            {!grouped && single.confidence != null && single.confidence > 0 ? `${Math.round(single.confidence * 100)}%` : '-'}
                          </span>
                          <span className="text-xs text-purple-gray truncate" title={grouped ? `${group.items.length} items` : (single.parameter || '')}>
                            {grouped ? `${group.items.length} items` : (single.parameter || '-')}
                          </span>
                          {grouped ? <span /> : detActions(single)}
                        </button>

                        {/* Expanded — member detections, each with its own send actions */}
                        {expanded && (
                          <div className="px-5 pb-4 pt-2 bg-purple-light/10 border-t border-glass-border/10 space-y-2">
                            {group.items.map((det) => {
                              const dp = isDetPrevalidated(det);
                              return (
                                <div key={det.finding_id} className="rounded-xl p-3 bg-purple-medium/20 border border-white/5">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${dp ? 'text-sky-400 bg-sky-500/15' : 'text-amber-400 bg-amber-500/15'}`}>{dp ? 'Prevalidated' : 'Unconfirmed'}</span>
                                        {det.parameter && <span className="text-[11px] text-white font-mono break-all">{det.parameter}</span>}
                                        <span className="text-[10px] text-muted font-mono">#{det.finding_id}</span>
                                        {det.confidence != null && det.confidence > 0 && <span className="text-[10px] text-muted font-mono">{Math.round(det.confidence * 100)}%</span>}
                                      </div>
                                      {det.url && <p className="text-[11px] text-coral/80 font-mono break-all">{det.url}</p>}
                                      {det.details && (() => {
                                        const dv: unknown = det.details;
                                        let obj: Record<string, unknown> | null = null;
                                        const raw = typeof dv === 'string' ? dv.trim() : '';
                                        if (raw.startsWith('{') || raw.startsWith('[')) {
                                          try { obj = JSON.parse(raw); } catch { obj = null; }
                                        } else if (dv && typeof dv === 'object') {
                                          obj = dv as Record<string, unknown>;
                                        }
                                        // Plain text (not JSON) → show as-is.
                                        if (!obj) return <p className="text-xs text-purple-gray leading-relaxed break-all">{String(dv)}</p>;
                                        // JSON detail (XSS/SQLi): render only scalar fields as chips and drop
                                        // nested confirming_request/response — they embed a full HTML page.
                                        const scalars = Object.entries(obj).filter(([, v]) => v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'));
                                        if (scalars.length === 0) return null;
                                        return (
                                          <div className="flex flex-wrap gap-1.5">
                                            {scalars.map(([k, v]) => {
                                              const s = String(v);
                                              return (
                                                <span key={k} className="text-[10px] text-purple-gray font-mono bg-black/20 rounded px-1.5 py-0.5 break-all">
                                                  <span className="text-muted">{k}:</span> {s.length > 140 ? s.slice(0, 140) + '…' : s}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        );
                                      })()}
                                      {det.payload && <p className="text-[11px] text-coral font-mono break-all bg-black/20 rounded px-2 py-1">{det.payload}</p>}
                                    </div>
                                    {detActions(det)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-glass-border/20">
                  <span className="text-xs text-muted">
                    Showing {((detectionsPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(detectionsPage * ITEMS_PER_PAGE, groupedDetections.length)} of {groupedDetections.length} type groups ({detections.length} detections)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetectionsPage(p => Math.max(1, p - 1))}
                      disabled={detectionsPage === 1}
                      className="px-3 py-1 rounded-lg text-xs text-purple-gray hover:text-white bg-purple-light/40 hover:bg-purple-elevated/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-purple-gray">
                      {detectionsPage} / {detTotalPages}
                    </span>
                    <button
                      onClick={() => setDetectionsPage(p => Math.min(detTotalPages, p + 1))}
                      disabled={detectionsPage === detTotalPages}
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
          /* FULL MARKDOWN REPORT */
          <div className="p-6 text-purple-gray overflow-x-auto">
            <MarkdownRenderer content={fullMarkdown} />
          </div>
        )}
      </div>
    </div >
  );
};
