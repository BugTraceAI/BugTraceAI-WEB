// components/cli/ReportContent.tsx
import React, { useState } from 'react';
import { ShieldCheckIcon, ChevronDownIcon, ChevronUpIcon, ClipboardDocumentListIcon } from '../Icons.tsx';

interface Finding {
  id: string;
  title: string;
  type: string;
  severity: string;
  description: string;
  url?: string;
  parameter?: string;
  payload?: string;
  cvss_score?: number;
  cvss_vector?: string;
  cwe?: string;
  cve?: string | null;
  impact?: string;
  remediation?: string;
  reproduction?: {
    steps?: string[];
    curl?: string;
  };
  metadata?: any;
  validated?: boolean;
}

interface ReportData {
  target_url: string;
  scan_date: string;
  findings: Finding[];
  manual_review?: Finding[];
  severity_counts?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface ReportContentProps {
  data: ReportData;
}

const severityStyles: Record<string, { badge: string; border: string; glow: string }> = {
  critical: {
    badge: 'bg-red-500 text-white',
    border: 'border-red-500/30',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]'
  },
  high: {
    badge: 'bg-orange-500 text-white',
    border: 'border-orange-500/30',
    glow: 'shadow-[0_0_15px_rgba(249,115,22,0.1)]'
  },
  medium: {
    badge: 'bg-yellow-500 text-black',
    border: 'border-yellow-500/30',
    glow: ''
  },
  low: {
    badge: 'bg-blue-500 text-white',
    border: 'border-blue-500/30',
    glow: ''
  },
  info: {
    badge: 'bg-gray-500 text-white',
    border: 'border-gray-500/30',
    glow: ''
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export const ReportContent: React.FC<ReportContentProps> = ({ data }) => {
  const { target_url, scan_date, findings, manual_review, severity_counts } = data;
  const [openFindings, setOpenFindings] = useState<Record<string, boolean>>({});
  const [showManualReview, setShowManualReview] = useState(false);

  const toggleFinding = (id: string) => {
    setOpenFindings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFindings = findings.filter(f => f.type?.toLowerCase() !== 'unknown');

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Slim Header & Summary Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-coral/10 border border-coral/20">
              <ShieldCheckIcon className="h-6 w-6 text-coral" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Security Assessment</h1>
              <p className="text-xs text-muted font-mono">{target_url}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Generated At</div>
            <div className="text-xs text-white/80 font-mono">{new Date(scan_date).toLocaleString()}</div>
          </div>
        </div>

        {/* Severity Summary Super Bar */}
        {severity_counts && (
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <div className="flex-1 grid grid-cols-4 gap-2">
              {[
                { label: 'Critical', count: severity_counts.critical, color: 'bg-red-500' },
                { label: 'High', count: severity_counts.high, color: 'bg-orange-500' },
                { label: 'Medium', count: severity_counts.medium, color: 'bg-yellow-500 text-black' },
                { label: 'Low', count: severity_counts.low, color: 'bg-blue-500' }
              ].map(sev => (
                <div key={sev.label} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border border-white/5 ${sev.count > 0 ? 'bg-white/[0.05]' : 'opacity-40'}`}>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-muted">{sev.label}</span>
                  <span className={`text-xs font-black px-1.5 rounded ${sev.count > 0 ? sev.color : 'text-muted'}`}>{sev.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compressed Accordion Findings */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
            Findings List ({filteredFindings.length})
          </h2>
        </div>

        <div className="space-y-2">
          {filteredFindings.map((finding, idx) => {
            const id = finding.id || `f-${idx}`;
            const isOpen = openFindings[id];
            const style = severityStyles[(finding.severity || '').toLowerCase()] || severityStyles.info;

            return (
              <div
                key={id}
                className={`
                  rounded-xl border transition-all duration-200 overflow-hidden
                  ${isOpen ? 'bg-white/[0.04] ' + style.border : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'}
                  ${style.glow && isOpen ? style.glow : ''}
                `}
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleFinding(id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className={`
                      text-[9px] font-black uppercase px-2 py-0.5 rounded min-w-[65px] text-center
                      ${style.badge}
                    `}>
                      {finding.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white/90 truncate block">
                        {finding.title || finding.type}
                      </span>
                      <span className="text-[10px] text-muted font-mono truncate block opacity-60">
                        {finding.url || target_url}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    {finding.validated && (
                      <span className="text-[9px] font-bold text-emerald-400 border border-emerald-400/30 px-1.5 py-0.5 rounded-full bg-emerald-400/5">
                        VERIFIED
                      </span>
                    )}
                    {isOpen ? <ChevronUpIcon className="h-4 w-4 text-muted" /> : <ChevronDownIcon className="h-4 w-4 text-muted" />}
                  </div>
                </button>

                {/* Accordion Body */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="h-px bg-white/[0.05] mb-4" />

                    {/* Description */}
                    <div>
                      <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Description</h4>
                      <p className="text-sm text-white/70 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/5">
                        {finding.description}
                      </p>
                    </div>

                    {/* CVSS / CWE / CVE */}
                    {(finding.cvss_score || finding.cwe || finding.cve) && (
                      <div className="flex flex-wrap items-center gap-3">
                        {finding.cvss_score != null && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">CVSS</span>
                            <span className={`text-sm font-black ${finding.cvss_score >= 9 ? 'text-red-400' :
                              finding.cvss_score >= 7 ? 'text-orange-400' :
                                finding.cvss_score >= 4 ? 'text-yellow-400' : 'text-blue-400'
                              }`}>
                              {finding.cvss_score.toFixed(1)}
                            </span>
                            {finding.cvss_vector && (
                              <code className="text-[9px] font-mono text-muted/60 hidden md:inline">{finding.cvss_vector}</code>
                            )}
                          </div>
                        )}
                        {finding.cwe && (
                          <a
                            href={`https://cwe.mitre.org/data/definitions/${finding.cwe.replace('CWE-', '')}.html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                          >
                            {finding.cwe}
                          </a>
                        )}
                        {finding.cve && (
                          <a
                            href={`https://nvd.nist.gov/vuln/detail/${finding.cve}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                          >
                            {finding.cve}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Payload & Parameters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {finding.parameter && (
                        <div>
                          <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Target Parameter</h4>
                          <code className="text-xs font-mono text-coral bg-coral/5 px-2 py-1 rounded border border-coral/10">
                            {finding.parameter}
                          </code>
                        </div>
                      )}
                      {finding.payload && (
                        <div className="md:col-span-2">
                          <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center justify-between">
                            Exploit Payload
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(finding.payload!); }}
                              className="text-[9px] text-muted hover:text-white flex items-center gap-1 transition-colors"
                            >
                              <ClipboardDocumentListIcon className="h-3 w-3" /> Copy
                            </button>
                          </h4>
                          <div className="bg-black/40 p-3 rounded-lg border border-white/10 relative group">
                            <code className="text-xs font-mono text-yellow-400 break-all whitespace-pre-wrap">
                              {finding.payload}
                            </code>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Impact & Remediation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {finding.impact && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                          <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Risk Impact</h4>
                          <p className="text-xs text-red-100/60 leading-relaxed">{finding.impact}</p>
                        </div>
                      )}
                      {finding.remediation && (
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                          <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Remediation</h4>
                          <p className="text-xs text-blue-100/60 leading-relaxed">{finding.remediation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Review Section */}
      {manual_review && manual_review.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowManualReview(!showManualReview)}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">REVIEW</span>
              <h2 className="text-sm font-bold uppercase tracking-widest text-amber-400/80">
                Manual Review ({manual_review.length})
              </h2>
            </div>
            <span className="text-xs text-muted">
              {showManualReview ? 'Hide' : 'Show'}
            </span>
          </button>

          {showManualReview && (
            <div className="space-y-2 opacity-80">
              {manual_review.filter(f => f.type?.toLowerCase() !== 'unknown').map((finding, idx) => {
                const id = finding.id || `mr-${idx}`;
                const isOpen = openFindings[id];
                const style = severityStyles[finding.severity?.toLowerCase()] || severityStyles.info;

                return (
                  <div
                    key={id}
                    className={`
                      rounded-xl border transition-all duration-200 overflow-hidden border-dashed
                      ${isOpen ? 'bg-white/[0.03] ' + style.border : 'bg-white/[0.01] border-amber-500/20 hover:bg-white/[0.03]'}
                    `}
                  >
                    <button
                      onClick={() => toggleFinding(id)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded min-w-[65px] text-center ${style.badge}`}>
                          {finding.severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-white/70 truncate block">
                            {finding.title || finding.type}
                          </span>
                          <span className="text-[10px] text-muted font-mono truncate block opacity-60">
                            {finding.url || target_url}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <span className="text-[9px] font-bold text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded-full bg-amber-400/5">
                          NEEDS REVIEW
                        </span>
                        {isOpen ? <ChevronUpIcon className="h-4 w-4 text-muted" /> : <ChevronDownIcon className="h-4 w-4 text-muted" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="h-px bg-white/[0.05] mb-4" />
                        {finding.description && (
                          <div>
                            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Description</h4>
                            <p className="text-sm text-white/70 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/5">
                              {finding.description}
                            </p>
                          </div>
                        )}
                        {finding.parameter && (
                          <div>
                            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Target Parameter</h4>
                            <code className="text-xs font-mono text-coral bg-coral/5 px-2 py-1 rounded border border-coral/10">
                              {finding.parameter}
                            </code>
                          </div>
                        )}
                        {finding.payload && (
                          <div>
                            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Payload</h4>
                            <div className="bg-black/40 p-3 rounded-lg border border-white/10">
                              <code className="text-xs font-mono text-yellow-400 break-all whitespace-pre-wrap">
                                {finding.payload}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
