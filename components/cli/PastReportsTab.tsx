// components/cli/PastReportsTab.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowUpTrayIcon, InformationCircleIcon, ShieldExclamationIcon, TrashIcon, MagnifyingGlassIcon } from '../Icons.tsx';
import { ReportMarkdownViewer } from './dashboard/ReportMarkdownViewer.tsx';
import { MarkdownRenderer } from '../MarkdownRenderer.tsx';
import { BrandedLoader } from '../BrandedLoader.tsx';
import { usePastReports, CLIReport } from '../../hooks/usePastReports.ts';
import { getBadge } from '../../types.ts';
import { useSettings } from '../../contexts/SettingsProvider.tsx';
import { createBtaiApi } from '../../lib/btaiApi.ts';
import type { BtaiApiScanResults, BtaiApiFinding } from '../../lib/btaiApi.ts';
import type { ExploitSeed } from '../../types.ts';
import { isRepeaterEligible, mapReproToSeed } from '../../services/finisherSeed.ts';
import {
  formatApiReportValue,
  getApiAnalysisMarkdown,
  getApiAnalysisPocs,
} from '../../lib/apiReportPresentation.ts';
import { sortApiFindings, type ApiFindingSortColumn, type ApiFindingSortDirection } from '../../lib/apiReportSorting.ts';
import { apiFindingCategorySubtitle, apiFindingStatus, apiFindingTitle } from '../../lib/apiFindingStatus.ts';
import { SlidingSegmentedControl } from './SlidingSegmentedControl.tsx';
import { CopyableCodeBlock } from '../CopyableCodeBlock.tsx';

interface PastReportsTabProps {
  onRescan?: (targetUrl: string) => void;
  onViewScan?: () => void;
  onSendToRepeater?: (seed: ExploitSeed) => void;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

interface DeleteDialogProps {
  target: CLIReport;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ target, deleting, onCancel, onConfirm }) => {
  const isApi = target.engine === 'api';
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
    <div className="bg-[#0f0f14] border border-white/10 rounded-2xl max-w-sm w-full mx-4 shadow-2xl p-6">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 mb-4">
          <TrashIcon className="h-6 w-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{isApi ? 'Stop Scan?' : 'Purge Intelligence?'}</h3>
        <p className="text-muted text-xs leading-relaxed mb-4">
          {isApi ? (
            <>This stops scan <span className="font-mono">{target.id}</span> for <span className="text-coral font-mono">{target.target_url}</span>. Report data may remain in API storage.</>
          ) : (
            <>This operation is irreversible. All findings for <br /><span className="text-coral font-mono">{target.target_url}</span> will be deleted.</>
          )}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all duration-300"
        >
          Abort Mission
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300"
        >
          {deleting ? (isApi ? 'Stopping...' : 'Purging...') : isApi ? 'Confirm Stop' : 'Confirm Purge'}
        </button>
      </div>
    </div>
  </div>
  );
};

interface ReportsListProps {
  loading: boolean;
  reports: CLIReport[];
  filteredReports: CLIReport[];
  onSelectReport: (report: CLIReport) => void;
  onDeleteReport: (report: CLIReport) => void;
}

const SeverityDots: React.FC<{ summary: CLIReport['severity_summary'] }> = ({ summary }) => {
  if (!summary) return null;
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {summary.critical > 0 && (
        <span className="flex items-center gap-1 group/sev">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
          <span className="text-[10px] font-bold text-white/60">{summary.critical}</span>
        </span>
      )}
      {summary.high > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"></span>
          <span className="text-[10px] font-bold text-white/60">{summary.high}</span>
        </span>
      )}
      {(summary.medium > 0 || summary.low > 0) && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
          <span className="text-[10px] font-bold text-white/60">{summary.medium + summary.low}</span>
        </span>
      )}
    </div>
  );
};

const ReportsList: React.FC<ReportsListProps> = ({ loading, reports, filteredReports, onSelectReport, onDeleteReport }) => {
  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <BrandedLoader size="h-10 w-10" />
      </div>
    );
  }

  if (filteredReports.length === 0) {
    return (
      <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
        <ShieldExclamationIcon className="h-10 w-10 mx-auto text-muted/30 mb-4" />
        <p className="text-white/40 text-sm font-bold uppercase tracking-wider">Empty Database</p>
        <p className="text-muted/40 text-xs mt-1">
          {reports.length === 0 ? 'No intelligence reports found. Run a new scan.' : 'No matches for current filter.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] overflow-hidden">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.02]">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Assessment Target</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Date</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Provider</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Source</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted">Findings</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filteredReports.map((report) => {
              const badge = getBadge(report.launch_origin || report.origin);
              const badgeCategory = badge.startsWith('WEB') ? 'web' : badge === 'Legacy / origin unknown' ? 'legacy' : 'engine';
              const badgeClass = badgeCategory === 'web'
                ? 'bg-coral/5 text-coral border-coral/20'
                : badgeCategory === 'legacy'
                  ? 'bg-amber-500/5 text-amber-400 border-amber-500/20'
                  : 'bg-blue-500/5 text-blue-400 border-blue-500/20';
              return (
              <tr
                key={`${report.engine ?? 'cli'}:${report.id}`}
                onClick={() => onSelectReport(report)}
                className="group hover:bg-white/[0.03] transition-all cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-white/80 font-mono font-medium truncate max-w-md group-hover:text-coral transition-colors">
                      {report.target_url?.replace(/^https?:\/\//, '') || 'Unknown'}
                    </span>
                    <span className="text-[9px] text-muted font-mono opacity-50">#{report.id.substring(0, 8)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted font-mono">{formatDate(report.scan_date)}</span>
                </td>
                <td className="px-4 py-3">
                  {report.provider ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded border bg-purple-500/5 text-purple-400 border-purple-500/20">
                      {report.provider.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeClass}`}>
                    {badge}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {report.severity_summary ? (
                    <SeverityDots summary={report.severity_summary} />
                  ) : report.findings_count ? (
                    <span
                      className="text-[10px] font-bold text-white/60 font-mono"
                      title={`${report.findings_count} detections, ${report.confirmed_count || 0} confirmed`}
                    >
                      {report.findings_count} detections
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {report.engine === 'cli' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteReport(report); }}
                      className="p-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : report.engine === 'api' && ['pending', 'running', 'initializing', 'paused'].includes(report.status.toLowerCase()) ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteReport(report); }}
                      className="p-1.5 text-muted hover:text-coral opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-coral/10"
                      title="Stop scan"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="7" width="10" height="10" rx="1.5" />
                      </svg>
                    </button>
                  ) : null}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MAX_FINDINGS = 200;
const MAX_ENDPOINTS = 500;
const MAX_EVIDENCE_LENGTH = 2000;

const severityColor = (severity?: string) => {
  const s = String(severity || '').toLowerCase();
  if (s === 'critical') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (s === 'high') return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
  if (s === 'medium') return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  if (s === 'low') return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
  return 'text-muted border-white/10 bg-white/[0.03]';
};

const truncate = (value: unknown, max = MAX_EVIDENCE_LENGTH) => {
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
};

const apiProviderLabel = (provider?: string | null, model?: string | null): string => {
  if (!provider && !model) return '';
  const providerText = provider ? provider.replace(/[-_]/g, ' ') : 'AI provider';
  const modelText = model ? ` · ${model.split('/').pop()}` : '';
  return `${providerText}${modelText}`;
};

const apiToolLabel = (tool: string): string => {
  const normalized = tool.toLowerCase();
  if (normalized === 'apex_analysis' || normalized === 'ai_analysis') return 'AI analysis';
  return tool.replace(/[_-]/g, ' ');
};

const apiFindingSeed = (finding: BtaiApiFinding, target: string): ExploitSeed => {
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const repro = finding.repro as Record<string, unknown> | undefined;
  const rawEndpoint = String(finding.endpoint || evidence?.url || target).trim();
  // API findings may store the endpoint as `METHOD https://host/path`.
  // ExploitSeed keeps method and URL separately; leaving the prefix attached
  // produces `GET GET https://...` in the Repeater and makes curl resolve
  // `GET` as a hostname.
  const endpointWithMethod = rawEndpoint.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(https?:\/\/\S+)$/i);
  const endpoint = endpointWithMethod ? endpointWithMethod[2] : rawEndpoint;
  // Some API scanners store the documentation link (MDN/CWE/OWASP) in the
  // endpoint field for header findings. Repeater needs the tested target, not
  // the reference page, unless a concrete confirming request is available.
  const referenceEndpoint = /developer\.mozilla\.org|cwe\.mitre\.org|owasp\.org/i.test(endpoint);
  const requestUrl = referenceEndpoint && !repro?.confirming_request ? target : endpoint;
  const method = String(repro?.method || evidence?.method || endpointWithMethod?.[1] || 'GET').toUpperCase();
  const payload = repro?.payload || evidence?.payload;
  const parameter = repro?.parameter || evidence?.parameter;
  return {
    vulnType: String(finding.category || finding.title || 'API finding'),
    url: requestUrl,
    parameter: parameter ? String(parameter) : undefined,
    method: method === 'POST' ? 'POST' : 'GET',
    reflectingPayloads: payload ? [String(payload)] : undefined,
    status: String(finding.severity || 'info'),
    confidence: typeof finding.confidence === 'number' ? finding.confidence : undefined,
    whyStalled: evidence?.description ? String(evidence.description) : undefined,
    ...mapReproToSeed(repro),
  };
};

const buildApiReportChatMessage = (
  report: CLIReport,
  findings: BtaiApiFinding[],
  endpoints: unknown[],
  status: BtaiApiScanResults['status'],
  aiAnalysis: unknown,
): string => {
  const provider = status?.analysis_provider || report.provider || (aiAnalysis as { provider?: string } | null)?.provider;
  const model = status?.analysis_model || (aiAnalysis as { model?: string } | null)?.model;
  return [
    '# BugTraceAI API scan review',
    '',
    `- Target: ${report.target_url}`,
    `- Scan ID: ${report.id}`,
    `- Source: ${report.launch_origin || 'web-api'}`,
    `- Status: ${status?.status || report.status}`,
    `- Findings: ${findings.length}`,
    `- Endpoints: ${endpoints.length}`,
    provider ? `- AI provider: ${provider}` : '',
    model ? `- AI model: ${model}` : '',
    '',
    '## Findings',
    '',
    findings.length ? findings.map((finding, index) => [
      `### ${index + 1}. [${String(finding.severity || 'info').toUpperCase()}] ${apiFindingTitle(finding)}`,
      `- Category: ${finding.category || 'API finding'}`,
      `- Endpoint: ${apiFindingUrl(finding, report.target_url)}`,
      `- Confidence: ${typeof finding.confidence === 'number' ? `${Math.round(finding.confidence * 100)}%` : '—'}`,
      finding.source_tools?.length ? `- Tools: ${finding.source_tools.join(', ')}` : '',
      finding.evidence ? `\n\`\`\`json\n${JSON.stringify(finding.evidence, null, 2).slice(0, 8000)}\n\`\`\`` : '',
    ].filter(Boolean).join('\n')).join('\n\n') : 'No findings were recorded.',
    '',
    '## Endpoints',
    '',
    endpoints.slice(0, 500).map(endpoint => {
      const item = endpoint as Record<string, unknown>;
      return `- ${(item.method || 'GET').toString().toUpperCase()} ${item.url || endpoint}`;
    }).join('\n'),
  ].filter(Boolean).join('\n');
};

const LegacyApiReportViewer: React.FC<{ report: CLIReport; onBack: () => void }> = ({ report, onBack }) => {
  const { btaiApiUrl } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BtaiApiScanResults | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await createBtaiApi(btaiApiUrl).getScanResults(report.id, controller.signal);
        if (!cancelled) {
          setResults(data);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load scan results';
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [report.id, btaiApiUrl]);

  const findings = Array.isArray(results?.findings) ? results!.findings! : [];
  const endpoints = Array.isArray(results?.endpoints) ? results!.endpoints! : [];
  const status = results?.status;
  const toolHealth = results?.tool_health ?? {};
  const schema = results?.schema;
  const aiAnalysis = results?.ai_analysis;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="dashboard-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white font-mono truncate max-w-2xl">
              {report.target_url || 'Unknown Target'}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted">
              <span className="font-mono">SCAN #{report.id}</span>
              <span>{formatDate(report.scan_date)}</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold">
                {report.launch_origin?.toUpperCase() || 'API'}
              </span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-[10px] font-bold text-coral hover:text-coral-hover uppercase tracking-widest transition-colors flex items-center gap-1"
          >
            ← Return
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <BrandedLoader size="h-8 w-8" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-3">{truncate(error, 300)}</p>
            <button
              onClick={() => setResults(null)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="border-t border-white/[0.05] pt-4">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Scan Status</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted">Status</p>
                  <p className="text-white font-mono capitalize">{status?.status?.toLowerCase() || report.status.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-muted">Progress</p>
                  <p className="text-white font-mono">{Math.round((status?.progress ?? 0) * 100)}%</p>
                </div>
                <div>
                  <p className="text-muted">Phase</p>
                  <p className="text-white font-mono">{status?.current_phase || '—'}</p>
                </div>
                <div>
                  <p className="text-muted">Findings</p>
                  <p className="text-white font-mono">{findings.length}</p>
                </div>
              </div>
              {status?.error && (
                <p className="text-xs text-red-400 mt-2">Error: {String(status.error)}</p>
              )}
              {status?.warning && (
                <p className="text-xs text-yellow-400 mt-1">Warning: {String(status.warning)}</p>
              )}
            </div>

            {findings.length > 0 && (
              <div className="border-t border-white/[0.05] pt-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Findings ({findings.length > MAX_FINDINGS ? `showing ${MAX_FINDINGS} of ${findings.length}` : findings.length})
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {findings.slice(0, MAX_FINDINGS).map((f: BtaiApiFinding) => (
                    <div key={f.id || Math.random()} className="p-3 rounded-xl border border-white/[0.05] bg-white/[0.01] space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-white/90 font-medium">{String(f.title || 'Untitled')}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${severityColor(f.severity)}`}>
                          {String(f.severity || 'info').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-muted space-y-1">
                        <p>Endpoint: <span className="text-white/70 font-mono">{String(f.endpoint || '—')}</span></p>
                        <p>Confidence: <span className="text-white/70">{Math.round((f.confidence ?? 0) * 100)}%</span></p>
                        {Array.isArray(f.source_tools) && f.source_tools.length > 0 && (
                          <p>Tools: <span className="text-white/70">{f.source_tools.map(String).join(', ')}</span></p>
                        )}
                      </div>
                      {f.evidence && Object.keys(f.evidence).length > 0 && (
                        <details className="text-xs">
                          <summary className="text-muted cursor-pointer hover:text-white/70 transition-colors">Evidence</summary>
                          <CopyableCodeBlock value={truncate(f.evidence)} language="JSON" maxHeight="12rem" />
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoints.length > 0 && (
              <div className="border-t border-white/[0.05] pt-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
                  Endpoints ({endpoints.length > MAX_ENDPOINTS ? `showing ${MAX_ENDPOINTS} of ${endpoints.length}` : endpoints.length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {endpoints.slice(0, MAX_ENDPOINTS).map((ep: unknown, idx: number) => {
                    const method = String((ep as Record<string, unknown>)?.method ?? 'GET').toUpperCase();
                    const url = String((ep as Record<string, unknown>)?.url ?? (ep as string));
                    return (
                      <div key={idx} className="text-xs font-mono text-white/70 py-1 border-b border-white/[0.03] last:border-0">
                        <span className="text-coral/80 mr-2">{method}</span>
                        <span className="text-white/50">{url}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Object.keys(toolHealth).length > 0 && (
              <div className="border-t border-white/[0.05] pt-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Tool Health</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(toolHealth).map(([tool, info]) => (
                    <div key={tool} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-muted font-bold">{String(tool)}</p>
                      <p className="text-white/70 font-mono">{truncate(info, 200)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {schema && (
              <div className="border-t border-white/[0.05] pt-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Schema</h3>
                <CopyableCodeBlock value={truncate(schema)} language="JSON" maxHeight="12rem" />
              </div>
            )}

            {aiAnalysis && (
              <div className="border-t border-white/[0.05] pt-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">AI Analysis</h3>
                <CopyableCodeBlock value={truncate(aiAnalysis)} language="JSON" maxHeight="12rem" />
              </div>
            )}

            {!loading && !error && findings.length === 0 && endpoints.length === 0 && (
              <div className="border-t border-white/[0.05] pt-4">
                <p className="text-sm text-muted text-center py-8">No structured results available for this scan.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* API reports use the same visual language as CLI reports. The data contracts
 * differ, but the report surface should not: compact header, summary metrics,
 * animated sub-tabs and expandable rows instead of a raw JSON dump. */
const apiSeverityStyle = (severity?: string) => {
  switch (String(severity || 'info').toLowerCase()) {
    case 'critical': return { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/25', dot: 'bg-red-400' };
    case 'high': return { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/25', dot: 'bg-orange-400' };
    case 'medium': return { text: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-500/25', dot: 'bg-yellow-400' };
    case 'low': return { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/25', dot: 'bg-blue-400' };
    default: return { text: 'text-ui-text-muted', bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-white/40' };
  }
};

const apiFindingCvss = (finding: BtaiApiFinding): string => {
  const repro = finding.repro as Record<string, unknown> | undefined;
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const cvss = evidence?.cvss as Record<string, unknown> | undefined;
  const score = repro?.cvss_score ?? cvss?.score;
  return score === undefined || score === null || score === '' ? '—' : String(score);
};

const apiFindingCategory = (finding: BtaiApiFinding): string => {
  if (finding.category) return String(finding.category);
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const classifications = evidence?.classifications as Record<string, unknown> | undefined;
  return String(classifications?.owasp || 'API finding');
};


const isReferenceUrl = (value: unknown): boolean => /developer\.mozilla\.org|cwe\.mitre\.org|owasp\.org|portswigger\.net\/web-security/i.test(String(value || ''));

const apiFindingUrl = (finding: BtaiApiFinding, target?: string): string => {
  if (finding.endpoint && !(target && isReferenceUrl(finding.endpoint))) return String(finding.endpoint);
  const repro = finding.repro as Record<string, unknown> | undefined;
  const evidence = finding.evidence as Record<string, unknown> | undefined;
  const evidenceUrl = repro?.url ?? evidence?.url;
  if (target && (!evidenceUrl || isReferenceUrl(evidenceUrl))) return target;
  return String(evidenceUrl ?? target ?? '—');
};

const apiDetailText = (value: unknown, fallback = '—'): string => {
  if (value === undefined || value === null || value === '') return fallback;
  return truncate(formatApiReportValue(value), 700);
};

const apiStatusStyle = (status: string): { text: string; bg: string } => {
  const normalized = status.toLowerCase();
  if (normalized.includes('confirm') || normalized.includes('valid')) return { text: 'text-emerald-300', bg: 'bg-emerald-500/15' };
  if (normalized.includes('review')) return { text: 'text-violet-300', bg: 'bg-violet-500/15' };
  return { text: 'text-amber-300', bg: 'bg-amber-500/15' };
};

const API_FINDINGS_PAGE_SIZE = 10;

const ApiReportViewerV2: React.FC<{ report: CLIReport; onBack: () => void; onSendToRepeater?: (seed: ExploitSeed) => void }> = ({ report, onBack, onSendToRepeater }) => {
  const { btaiApiUrl } = useSettings();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BtaiApiScanResults | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'report'>('findings');
  const [showMetrics, setShowMetrics] = useState(false);
  const [findingPage, setFindingPage] = useState(0);
  // Findings open in triage order: highest severity first, then the existing
  // deterministic name tie-breaker. Users can still change the sort headers.
  const [findingSort, setFindingSort] = useState<{ col: ApiFindingSortColumn | null; dir: ApiFindingSortDirection }>({ col: 'severity', dir: 'desc' });
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [sendingFindingId, setSendingFindingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [downloadingOpenApi, setDownloadingOpenApi] = useState(false);
  const [sendingToCli, setSendingToCli] = useState(false);
  const [showZipNotice, setShowZipNotice] = useState(() => localStorage.getItem('hideZipNoticeApi') !== 'true');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [highlightDownload, setHighlightDownload] = useState(false);

  useEffect(() => {
    if (!showZipNotice) {
      setHighlightDownload(true);
      const timer = setTimeout(() => setHighlightDownload(false), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleContinue = () => {
    if (dontShowAgain) localStorage.setItem('hideZipNoticeApi', 'true');
    setShowZipNotice(false);
    setHighlightDownload(true);
    setTimeout(() => setHighlightDownload(false), 2500);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await createBtaiApi(btaiApiUrl).getScanResults(report.id, controller.signal);
        if (!cancelled) setResults(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load scan results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [report.id, btaiApiUrl]);

  const findings = (Array.isArray(results?.findings) ? results.findings : []) as BtaiApiFinding[];
  const endpoints = Array.isArray(results?.endpoints) ? results.endpoints : [];
  const status = results?.status;
  const schema = results?.schema;
  const aiAnalysis = results?.ai_analysis;
  const severityCounts = findings.reduce<Record<string, number>>((counts, finding) => {
    const severity = String(finding.severity || 'info').toLowerCase();
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, {});
  const categoryCounts = findings.reduce<Record<string, number>>((counts, finding) => {
    const category = apiFindingCategory(finding);
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const sortedFindings = useMemo(() => findingSort.col ? sortApiFindings(findings, findingSort.col, findingSort.dir) : findings, [findings, findingSort]);
  const totalFindings = sortedFindings.length;
  const findingsPageCount = Math.max(1, Math.ceil(totalFindings / API_FINDINGS_PAGE_SIZE));
  const visibleFindings = sortedFindings.slice(findingPage * API_FINDINGS_PAGE_SIZE, (findingPage + 1) * API_FINDINGS_PAGE_SIZE);
  const providerLabel = apiProviderLabel(status?.analysis_provider || report.provider, status?.analysis_model);
  const scanDuration = status?.started_at && status?.finished_at
    ? formatElapsed(Math.max(0, Math.round((new Date(status.finished_at).getTime() - new Date(status.started_at).getTime()) / 1000)))
    : null;
  const schemaText = formatApiReportValue(schema);
  const aiAnalysisMarkdown = getApiAnalysisMarkdown(aiAnalysis, report.target_url);
  const aiAnalysisPocs = getApiAnalysisPocs(aiAnalysis);

  useEffect(() => {
    setFindingPage(0);
    setExpandedFinding(null);
  }, [results]);

  const handleFindingSort = (column: ApiFindingSortColumn) => {
    setFindingSort(previous => {
      if (previous.col === column) {
        return { col: column, dir: previous.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { col: column, dir: column === 'name' || column === 'url' ? 'asc' : 'desc' };
    });
    setFindingPage(0);
    setExpandedFinding(null);
  };

  const findingSortHeaders: Array<[ApiFindingSortColumn, string]> = [
    ['name', 'Finding name'],
    ['severity', 'Severity'],
    ['status', 'Status'],
    ['cvss', 'CVSS'],
    ['url', 'URL'],
  ];

  const handleDownloadReportZip = async () => {
    setZipping(true);
    try {
      const { blob, filename } = await createBtaiApi(btaiApiUrl).downloadArtifact(report.id, 'report.zip');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || `bugtraceai-api-${report.id}-report.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download the API report ZIP.');
    } finally {
      setZipping(false);
    }
  };

  const handleDownloadOpenApi = async () => {
    setDownloadingOpenApi(true);
    try {
      const { blob, filename } = await createBtaiApi(btaiApiUrl).downloadArtifact(report.id, 'openapi.json');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || `bugtraceai-api-${report.id}-openapi.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download the OpenAPI JSON file.');
    } finally {
      setDownloadingOpenApi(false);
    }
  };

  const handleSendToCli = async () => {
    setSendingToCli(true);
    setError(null);
    try {
      const handoff = await createBtaiApi(btaiApiUrl).getHandoff(report.id);
      // Load the handoff into Scan Web without starting it. The user can
      // review the target/inventory and explicitly press START SCAN.
      navigate('/bugtraceai/scan', {
        state: { target_url: report.target_url, handoff },
      });
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : 'Could not send the API handoff to BugTraceAI-CLI.');
    } finally {
      setSendingToCli(false);
    }
  };

  const handleSendFindingToChat = async (finding: BtaiApiFinding, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const findingKey = String(finding.id || finding.title || finding.endpoint || 'finding');
    setSendingFindingId(findingKey);
    try {
      const base = import.meta.env.VITE_API_URL || '/api';
      const sessionResponse = await fetch(`${base}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_type: 'websec', title: `${apiFindingTitle(finding)} — ${report.target_url}`.slice(0, 250) }),
      });
      if (!sessionResponse.ok) throw new Error('Could not create a chat session.');
      const { data: session } = await sessionResponse.json();
      const detailContext = finding.detail_context || {};
      const aiEnrichment = finding.ai_enrichment;
      const message = [
        '# BugTraceAI API finding review',
        '',
        `Target: ${report.target_url}`,
        `Finding: ${apiFindingTitle(finding)}`,
        `Severity: ${String(finding.severity || 'info').toUpperCase()}`,
        `Category: ${finding.category || 'API finding'}`,
        `Endpoint: ${apiFindingUrl(finding, report.target_url)}`,
        `Confidence: ${typeof finding.confidence === 'number' ? `${Math.round(finding.confidence * 100)}%` : '—'}`,
        `Check: ${apiDetailText(detailContext.check_id)}`,
        `Observed status: ${apiDetailText(detailContext.observed_status)}`,
        `Summary: ${apiDetailText(detailContext.summary)}`,
        aiEnrichment?.model ? `AI model: ${aiEnrichment.model}` : '',
        '',
        '## Evidence',
        '```json',
        JSON.stringify({ evidence: finding.evidence || {}, repro: finding.repro || {} }, null, 2).slice(0, 12000),
        '```',
        aiEnrichment?.poc ? `\n## AI assessment\n\n${truncate(aiEnrichment.poc, 7000)}` : '',
        '',
        'Review the evidence, explain the impact, and propose a safe, non-destructive validation plan.',
      ].join('\n');
      const messageResponse = await fetch(`${base}/chats/${session.id}/messages/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
      });
      if (!messageResponse.ok) throw new Error('Could not send the finding to Chat.');
      navigate(`/chat/${session.id}`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the finding to Chat.');
    } finally {
      setSendingFindingId(null);
    }
  };

  const handleSendFindingToRepeater = (finding: BtaiApiFinding, event?: React.MouseEvent) => {
    event?.stopPropagation();
    onSendToRepeater?.(apiFindingSeed(finding, report.target_url));
  };

  if (loading) {
    return <div className="flex flex-1 items-center justify-center py-24"><ArrowPathIcon className="h-8 w-8 animate-spin text-coral" /></div>;
  }
  if (error && !results) {
    return (
      <div className="flex-1 p-6 md:p-8">
        <div className="dashboard-card p-8 text-center">
          <p className="mb-4 text-sm text-red-400">{truncate(error, 300)}</p>
          <button onClick={onBack} className="btn-mini btn-mini-secondary">← Return to reports</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-5 p-6 md:p-8">
      <div className="dashboard-card px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex flex-1 items-center gap-4">
            <h1 className="max-w-[11rem] truncate rounded-lg border border-white/5 bg-white/5 px-3 py-1 font-mono text-sm font-black tracking-tight text-white md:max-w-[13rem]">{report.target_url || 'Unknown target'}</h1>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap border-l border-white/10 pl-3 text-[10px] font-mono text-purple-gray">
              {providerLabel && <span className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 font-black uppercase text-emerald-300">{providerLabel}</span>}
              <span>SCAN #{report.id.substring(0, 8)}</span><span className="text-white/20">•</span><span>{formatDate(report.scan_date)}</span>
              {scanDuration && <><span className="text-white/20">•</span><span className="text-emerald-400">{scanDuration}</span></>}
              <span>{endpoints.length} ENDPOINTS</span>
              <span className="rounded border border-coral/20 bg-coral/5 px-2 py-0.5 font-black uppercase text-coral">{report.launch_origin || 'web-api'}</span>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center justify-end gap-2 whitespace-nowrap">
            <button type="button" onClick={() => setShowMetrics(previous => !previous)} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted transition-colors hover:bg-white/10 hover:text-white" aria-expanded={showMetrics}>
              {showMetrics ? 'Show Less' : 'Show More'}
              <span className={`h-3 w-3 transition-transform duration-300 ${showMetrics ? 'rotate-180' : ''}`}>⌄</span>
            </button>
            {report.openapi_available !== false && (
              <button
                type="button"
                onClick={() => void handleDownloadOpenApi()}
                disabled={downloadingOpenApi}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-300 transition-all hover:border-sky-500/40 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
                title={downloadingOpenApi ? 'Preparing OpenAPI JSON…' : 'Download the generated OpenAPI JSON for Postman or Bruno'}
                aria-label={downloadingOpenApi ? 'Preparing OpenAPI JSON' : 'Download OpenAPI JSON'}
              >
                {downloadingOpenApi ? <><span className="h-3 w-3 rounded-full border-2 border-sky-300/30 border-t-sky-300 animate-spin" /> Preparing...</> : <><ArrowDownTrayIcon className="h-3 w-3" /> OpenAPI</>}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSendToCli()}
              disabled={sendingToCli}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-coral/25 bg-coral/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-coral transition-all hover:border-coral/50 hover:bg-coral/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title={sendingToCli ? 'Loading handoff into BugTraceAI-CLI…' : 'Load this API handoff into BugTraceAI-CLI and review before starting'}
              aria-label={sendingToCli ? 'Loading handoff into BugTraceAI-CLI' : 'Load API handoff into BugTraceAI-CLI'}
            >
              {sendingToCli ? <><ArrowPathIcon className="h-3 w-3 animate-spin" /> Loading...</> : <><ArrowUpTrayIcon className="h-3 w-3" /> Send to CLI</>}
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadReportZip()}
              disabled={zipping}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40 ${highlightDownload ? 'bg-emerald-500/30 text-white border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.5)] animate-pulse' : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40'}`}
              title={zipping ? 'Preparing report ZIP…' : 'Download complete API report ZIP'}
              aria-label={zipping ? 'Preparing report ZIP' : 'Download complete API report ZIP'}
            >
              {zipping ? <><span className="h-3 w-3 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" /> Zipping...</> : <><ArrowDownTrayIcon className="h-3 w-3" /> Download ZIP</>}
            </button>
            <button type="button" onClick={onBack} className="flex h-7 items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-widest text-coral transition-colors hover:text-white">← Return</button>
          </div>
        </div>
      </div>

      {status?.warning && <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-warning"><span className="font-bold uppercase tracking-wider">Warning:</span> {status.warning}</div>}
      {error && <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">{error}</div>}

      {showMetrics && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr] animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="dashboard-card p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="label-mini">Severity breakdown</h3><span className="font-mono text-[10px] text-muted">{totalFindings} total</span></div>
          <div className="space-y-2">
            {['critical', 'high', 'medium', 'low', 'info'].map(severity => {
              const count = severityCounts[severity] || 0;
              if (!count) return null;
              const style = apiSeverityStyle(severity);
              return <div key={severity} className="flex items-center gap-3"><span className={`w-16 text-[10px] font-bold uppercase ${style.text}`}>{severity}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${style.dot}`} style={{ width: `${totalFindings ? (count / totalFindings) * 100 : 0}%` }} /></div><span className="w-6 text-right font-mono text-xs text-white">{count}</span></div>;
            })}
            {totalFindings === 0 && <p className="py-4 text-xs text-muted">No findings were recorded for this scan.</p>}
          </div>
        </div>
        <div className="dashboard-card p-4"><h3 className="label-mini mb-3">Top categories</h3><div className="grid grid-cols-2 gap-2">{Object.entries(categoryCounts).slice(0, 6).map(([category, count]) => <div key={category} className="rounded-lg border border-white/5 bg-white/[0.02] p-2"><p className="truncate text-[10px] text-muted" title={category}>{category}</p><p className="mt-1 font-mono text-sm font-bold text-white">{count}</p></div>)}{Object.keys(categoryCounts).length === 0 && <p className="py-4 text-xs text-muted">No categories available.</p>}</div></div>
      </div>}

      <div className="dashboard-card overflow-hidden">
        <div className="border-b border-glass-border/20 p-3">
          <SlidingSegmentedControl
            value={activeTab}
            onChange={value => setActiveTab(value as 'findings' | 'report')}
            ariaLabel="API report content view"
            itemWidth={156}
            variant="sub"
            options={[
              { value: 'findings', label: `Findings (${totalFindings})` },
              ...((schema || aiAnalysis) ? [{ value: 'report', label: 'Full report' }] : []),
            ]}
          />
        </div>

        {activeTab === 'findings' && (
          <div>
            {findings.length === 0 ? <p className="px-5 py-12 text-center text-xs text-muted">No findings to display for this scan.</p> : (
              <>
                <div className="hidden grid-cols-[minmax(0,1fr)_90px_112px_58px_minmax(0,1.25fr)_64px] gap-3 border-b border-white/10 px-5 py-2 text-[9px] font-bold uppercase tracking-widest text-muted md:grid">
                  {findingSortHeaders.map(([column, label]) => {
                    const active = findingSort.col === column;
                    return <button
                      key={column}
                      type="button"
                      onClick={() => handleFindingSort(column)}
                      aria-label={`Sort by ${label}`}
                      aria-sort={active ? (findingSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`flex items-center gap-1 text-left transition-colors hover:text-white ${active ? 'text-coral' : ''}`}
                    >
                      {label}
                      {active && <svg className={`h-2.5 w-2.5 transition-transform ${findingSort.dir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>}
                    </button>;
                  })}
                  <span />
                </div>
                <div className="divide-y divide-white/5">
                  {visibleFindings.map((finding, index) => {
                    const key = String(finding.id || `${finding.title}-${index}`);
                    const severity = String(finding.severity || 'info').toLowerCase();
                    const style = apiSeverityStyle(severity);
                    const findingStatus = apiFindingStatus(finding);
                    const findingStatusStyle = apiStatusStyle(findingStatus);
                    const compactFindingStatus = findingStatus.toLowerCase() === 'needs review' ? 'PR' : findingStatus;
                    const findingStatusTitle = compactFindingStatus === 'PR' ? 'Pending To Review' : findingStatus;
                    const categorySubtitle = apiFindingCategorySubtitle(apiFindingCategory(finding));
                    const findingUrl = apiFindingUrl(finding, report.target_url);
                    const expanded = expandedFinding === key;
                    const evidence = finding.evidence as Record<string, unknown> | undefined;
                    const repro = finding.repro as Record<string, unknown> | undefined;
                    const detailContext = finding.detail_context || {};
                    const aiEnrichment = finding.ai_enrichment;
                    const aiPoc = String(aiEnrichment?.poc || '').trim();
                    return <div key={key}>
                      <button type="button" onClick={() => setExpandedFinding(expanded ? null : key)} className={`grid w-full grid-cols-1 gap-2 px-5 py-3 text-left transition-colors hover:bg-purple-light/15 md:grid-cols-[minmax(0,1fr)_90px_112px_58px_minmax(0,1.25fr)_64px] md:items-center md:gap-3 ${expanded ? 'bg-purple-light/10' : ''}`}>
                        <div className="flex min-w-0 items-center gap-2"><span className={`text-muted transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span><div className="min-w-0"><p className="truncate text-xs font-bold tracking-tight text-white">{apiFindingTitle(finding)}</p>{categorySubtitle && <p className="truncate text-[9px] text-muted/70">{categorySubtitle}</p>}</div></div>
                        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${style.bg} ${style.text}`}><span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />{severity}</span>
                        <span className={`w-fit rounded-full px-2 py-0.5 text-[9px] font-medium ${findingStatusStyle.bg} ${findingStatusStyle.text}`} title={findingStatusTitle} aria-label={findingStatusTitle}>{compactFindingStatus}</span>
                        <span className="font-mono text-sm text-white">{apiFindingCvss(finding)}</span>
                        <span className="truncate text-xs text-coral/70" title={findingUrl}>{findingUrl}</span>
                        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                          <span
                            role="button"
                            tabIndex={0}
                            title="Send to Chat"
                            aria-label="Send finding to Chat"
                            onClick={(event) => void handleSendFindingToChat(finding, event)}
                            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-coral hover:bg-coral/10 transition-colors cursor-pointer"
                          >
                            {sendingFindingId === String(finding.id || finding.title || finding.endpoint || 'finding') ? (
                              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 0-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.189 3 14.189 3 12c0-4.556 3.694-8.25 8.25-8.25h.75c4.97 0 9 3.694 9 8.25Z" />
                              </svg>
                            )}
                          </span>
                          {onSendToRepeater && isRepeaterEligible(
                            [finding.title, finding.category, apiDetailText(detailContext.check_id)].filter(Boolean).join(' '),
                            {
                              url: findingUrl,
                              method: String(repro?.method || evidence?.method || detailContext.method || 'GET'),
                            },
                          ) && <span role="button" tabIndex={0} title="AIrepeater" aria-label="Send finding to AIrepeater" onClick={(event) => handleSendFindingToRepeater(finding, event)} className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"><ArrowPathIcon className="h-3.5 w-3.5" /></span>}
                        </div>
                      </button>
                      {expanded && <div className="border-t border-white/5 bg-black/10 px-7 pb-5 pt-3 text-xs"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><p className="label-mini">Finding details</p><p className="text-ui-text-muted">Category: <span className="text-white/80">{apiFindingCategory(finding)}</span></p><p className="text-ui-text-muted">Confidence: <span className="font-mono text-white/80">{Math.round((finding.confidence ?? 0) * 100)}%</span></p><p className="text-ui-text-muted">Tools: <span className="text-white/80">{finding.source_tools?.join(', ') || '—'}</span></p><p className="text-ui-text-muted">Check: <span className="font-mono text-white/80">{apiDetailText(detailContext.check_id)}</span></p><p className="text-ui-text-muted">Observed: <span className="text-white/80">{apiDetailText(detailContext.observed_status || repro?.status)}</span></p><p className="text-ui-text-muted">Affected endpoints: <span className="font-mono text-white/80">{apiDetailText(detailContext.affected_endpoints, '1')}</span></p><p className="text-ui-text-muted">Method / parameter: <span className="font-mono text-white/80">{apiDetailText(detailContext.method)}{detailContext.parameter ? ` / ${apiDetailText(detailContext.parameter)}` : ''}</span></p><p className="text-ui-text-muted">Summary: <span className="text-white/80">{apiDetailText(detailContext.summary || repro?.note)}</span></p><p className="text-ui-text-muted">CVSS vector: <span className="font-mono text-white/80">{apiDetailText(detailContext.cvss_vector)}</span></p></div><div><p className="label-mini mb-2">Evidence</p><CopyableCodeBlock value={truncate(evidence || repro || {}, 3000)} language="EVIDENCE" maxHeight="14rem" /></div></div>{aiEnrichment && <div className="mt-4 rounded-lg border border-coral/20 bg-coral/5 p-3"><div className="mb-2 flex flex-wrap items-center gap-2"><p className="label-mini">AI assessment</p><span className="rounded border border-coral/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-coral">{aiEnrichment.model || 'selected model'}</span><span className="text-[9px] uppercase tracking-wider text-muted">{aiEnrichment.status || 'available'}</span></div>{aiPoc ? <div className="max-h-72 overflow-auto text-[11px] leading-relaxed text-white/75"><MarkdownRenderer content={truncate(aiPoc, 7000)} /></div> : <p className="text-ui-text-muted">The selected model did not return an assessment for this finding.</p>}</div>}</div>}
                    </div>;
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-[10px] text-muted">
                  <span>Showing {findingPage * API_FINDINGS_PAGE_SIZE + 1}-{Math.min((findingPage + 1) * API_FINDINGS_PAGE_SIZE, totalFindings)} of {totalFindings} findings</span>
                  <div className="flex items-center gap-3">
                    <button type="button" disabled={findingPage === 0} onClick={() => { setFindingPage(page => Math.max(0, page - 1)); setExpandedFinding(null); }} className="transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Previous</button>
                    <span className="font-mono text-ui-text-muted">{findingPage + 1} / {findingsPageCount}</span>
                    <button type="button" disabled={findingPage >= findingsPageCount - 1} onClick={() => { setFindingPage(page => Math.min(findingsPageCount - 1, page + 1)); setExpandedFinding(null); }} className="transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Next</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'report' && <div className="space-y-5 overflow-x-auto p-6 text-purple-gray">
          {schema && <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="label-mini">Schema snapshot</p>
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted">JSON</span>
            </div>
            <CopyableCodeBlock value={truncate(schemaText, 6000)} language="JSON SCHEMA" maxHeight="18rem" />
          </section>}
          {aiAnalysis && <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="label-mini">AI analysis</p>
                {aiAnalysisPocs.length > 0 && <span className="rounded border border-coral/20 bg-coral/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-coral">{aiAnalysisPocs.length} PoC{aiAnalysisPocs.length === 1 ? '' : 's'}</span>}
              </div>
              {aiAnalysisMarkdown && <span className="text-[9px] font-mono uppercase tracking-wider text-muted">Markdown report</span>}
            </div>
            {aiAnalysisMarkdown ? (
              <div className="overflow-x-hidden text-sm leading-relaxed text-purple-gray [overflow-wrap:anywhere]">
                <MarkdownRenderer content={aiAnalysisMarkdown} />
              </div>
            ) : aiAnalysisPocs.length > 0 ? (
              <div className="space-y-3">
                {aiAnalysisPocs.map((poc, index) => <article key={`${poc.finding_id || poc.title || 'poc'}-${index}`} className="rounded-lg border border-white/5 bg-black/25 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white">{poc.title || poc.finding_id || `PoC ${index + 1}`}</span>
                    {poc.severity && <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[9px] font-bold uppercase text-coral">{poc.severity}</span>}
                  </div>
                  {poc.endpoint && <p className="mb-3 break-words font-mono text-[10px] text-coral/70">{poc.endpoint}</p>}
                  {poc.poc ? <MarkdownRenderer content={String(poc.poc)} /> : <CopyableCodeBlock value={formatApiReportValue(poc)} language="JSON" />}
                </article>)}
              </div>
            ) : <CopyableCodeBlock value={truncate(formatApiReportValue(aiAnalysis), 12000)} language="JSON" />}
          </section>}
        </div>}
      </div>

      {showZipNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="dashboard-card w-full max-w-sm animate-in fade-in zoom-in-95 border border-white/5 p-6 shadow-2xl duration-200">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
                <InformationCircleIcon className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white">Visual Summary</h3>
              <p className="mb-2 px-2 text-xs leading-relaxed text-purple-gray">This is a high-level overview. For exploits, raw data, and full context, please download the ZIP archive.</p>
              <div className="mt-2 flex w-full justify-center">
                <button type="button" onClick={handleContinue} className="w-full rounded-xl border border-coral/20 bg-coral/10 py-2.5 text-xs font-bold uppercase tracking-widest text-coral transition-colors hover:border-coral/40 hover:bg-coral/20">Continue</button>
              </div>
              <label className="group mt-3 flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={dontShowAgain} onChange={event => setDontShowAgain(event.target.checked)} className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-black/20 text-coral transition-all focus:ring-0 focus:ring-coral focus:ring-offset-0" />
                <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-muted transition-colors group-hover:text-purple-gray">Don't show again</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PastReportsTab: React.FC<PastReportsTabProps> = ({ onViewScan, onSendToRepeater }) => {
  const { reportId } = useParams<{ reportId?: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<CLIReport | null>(null);

  const {
    reports,
    loading,
    syncing,
    error,
    activeScans,
    deleteTarget,
    deleting,
    stoppingScanId,
    pausingScanId,
    resumingScanId,
    setError,
    setDeleteTarget,
    handleSync,
    handleDelete,
    handleStopScan,
    handlePauseScan,
    handleResumeScan,
  } = usePastReports();

  // URL-driven report selection: auto-select when reportId is in URL.
  // New deep links are engine-qualified (`cli:123` / `api:abc`); legacy bare
  // numeric ids (`123`) still route to the CLI report for backward compatibility.
  useEffect(() => {
    if (reportId && reports.length > 0) {
      const match = reportId.includes(':')
        ? reports.find((r) => `${r.engine ?? 'cli'}:${r.id}` === reportId)
        : reports.find((r) => r.id === reportId && (r.engine ?? 'cli') === 'cli');
      if (match) {
        setSelectedReport(match);
      }
    } else if (!reportId) {
      setSelectedReport(null);
    }
  }, [reportId, reports]);

  const filteredReports = reports.filter((report) =>
    !searchQuery || (report.target_url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectReport = (report: CLIReport) => {
    navigate(`/bugtraceai/reports/${report.engine ?? 'cli'}:${report.id}`);
  };

  const handleBack = () => {
    navigate('/bugtraceai/reports');
  };

  if (selectedReport) {
    return (
      <div className="flex-1 overflow-y-auto">
        {selectedReport.engine === 'api' ? (
          <ApiReportViewerV2 report={selectedReport} onBack={handleBack} onSendToRepeater={onSendToRepeater} />
        ) : (
          <ReportMarkdownViewer
            report={selectedReport}
            onBack={handleBack}
            onSendToRepeater={onSendToRepeater}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-6">
      {/* Super Bar: Compressed Header & Search */}
      <div className="card-premium mb-5 flex items-center justify-between gap-4 !rounded-2xl border-white/10 p-3">
        <div className="flex items-center gap-6 flex-1">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/40" />
            <input
              type="text"
              placeholder="Search reports by domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-premium h-10 w-full pl-9 pr-4 font-mono text-xs placeholder:text-muted/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold text-muted uppercase tracking-tighter">Total Assets</span>
            <span className="text-xs font-black text-white/80">{filteredReports.length}</span>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-mini btn-mini-primary h-10 px-4 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing' : 'Sync'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-[10px] font-bold uppercase tracking-widest p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldExclamationIcon className="h-4 w-4" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="hover:text-white transition-colors underline">Dismiss</button>
        </div>
      )}

      {/* Compressed Active Scans Bar */}
      {activeScans.length > 0 && (
        <div className="space-y-2 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1 mb-2">Ongoing Operations</h3>
          {activeScans.map((scan) => {
            const isPaused = scan.status === 'paused';
            return (
              <div
                key={`${scan.engine}:${scan.id}`}
                className={`group flex items-center justify-between p-3 rounded-xl border backdrop-blur-md transition-all ${isPaused
                  ? 'bg-yellow-500/[0.03] border-yellow-500/20'
                  : 'bg-coral/[0.03] border-coral/20'
                  }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`relative h-2 w-2 rounded-full flex-shrink-0 ${isPaused ? 'bg-yellow-400' : 'bg-coral-hover'
                    }`}>
                    {!isPaused && <div className="absolute inset-0 rounded-full bg-coral-hover animate-ping opacity-40" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-white font-mono font-bold truncate group-hover:text-coral transition-colors">{scan.target_url}</div>
                    <div className="text-[9px] text-muted flex items-center gap-2 mt-0.5">
                      <span className="uppercase font-bold tracking-tighter">{scan.engine === 'api' ? 'API polling' : isPaused ? 'Halted' : 'In Progress'}</span>
                      <span className="px-1.5 py-0.5 rounded border border-white/10 text-coral/80">{scan.engine === 'api' ? 'WEB → API' : 'WEB → CLI'}</span>
                      <span className="w-1 h-1 bg-white/10 rounded-full" />
                      <span className="font-mono">{formatElapsed(scan.elapsed_seconds)} elapsed</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleStopScan(scan.id, scan.engine)}
                    disabled={stoppingScanId === scan.id}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-muted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all disabled:opacity-50"
                    title="Terminate operation"
                  >
                    {stoppingScanId === scan.id ? (
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="7" width="10" height="10" rx="1.5" />
                      </svg>
                    )}
                  </button>

                  {scan.engine === 'cli' && <button
                    onClick={() => isPaused ? handleResumeScan(scan.id) : handlePauseScan(scan.id)}
                    disabled={resumingScanId === scan.id || pausingScanId === scan.id}
                    className={`p-1.5 rounded-lg bg-white/5 border border-white/5 transition-all disabled:opacity-50 ${isPaused ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-yellow-400 hover:bg-yellow-500/10'
                      }`}
                  >
                    {isPaused ? (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="6" width="3" height="12" rx="1" />
                        <rect x="14" y="6" width="3" height="12" rx="1" />
                      </svg>
                    )}
                  </button>}

                  <div className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${isPaused ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-coral/10 text-coral border-coral/20'
                    }`}>
                    {scan.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1 mb-2">Historical Records</h3>
        <ReportsList
          loading={loading}
          reports={reports}
          filteredReports={filteredReports}
          onSelectReport={handleSelectReport}
          onDeleteReport={setDeleteTarget}
        />
      </div>

      {deleteTarget && (
        <DeleteDialog
          target={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
};

export type { CLIReport } from '../../hooks/usePastReports.ts';
