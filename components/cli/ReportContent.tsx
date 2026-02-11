// components/cli/ReportContent.tsx
/* eslint-disable max-lines -- CLI report content component (245 lines).
 * Renders structured security scan report with executive summary and findings.
 * Includes severity breakdown, metadata display, and detailed finding cards.
 * Report structure follows security report standards - splitting would fragment report presentation.
 */
import React from 'react';
import { ShieldCheckIcon } from '../Icons.tsx';

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

const getSeverityColor = (severity: string) => {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'bg-red-900 text-red-100 border-red-700';
  if (s === 'high') return 'bg-red-600 text-white border-red-500';
  if (s === 'medium') return 'bg-orange-500 text-white border-orange-400';
  if (s === 'low') return 'bg-blue-600 text-white border-blue-500';
  return 'bg-gray-600 text-white border-0';
};

const getSeverityBadgeColor = (severity: string) => {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'bg-red-900 text-red-100';
  if (s === 'high') return 'bg-red-600 text-white';
  if (s === 'medium') return 'bg-orange-500 text-white';
  if (s === 'low') return 'bg-blue-600 text-white';
  return 'bg-gray-600 text-white';
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export const ReportContent: React.FC<ReportContentProps> = ({ data }) => {
  const { target_url, scan_date, findings, severity_counts } = data;

  return (
    <div className="min-h-screen bg-gray-50 text-purple-deep">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-deep to-purple-medium text-white py-8 px-6 border-b-4 border-coral">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheckIcon className="h-10 w-10 text-coral" />
            <h1 className="text-3xl font-bold">BugTraceAI Security Assessment</h1>
          </div>
          <p className="text-coral-hover text-lg font-mono">{target_url}</p>
          <p className="text-purple-gray text-sm mt-2">
            Scan Date: {new Date(scan_date).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Summary */}
      {severity_counts && (
        <div className="bg-white border-b border-gray-200 py-6 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-lg font-bold text-off-white mb-4">Severity Summary</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-red-900 text-white p-4 rounded-lg border-2 border-red-700">
                <div className="text-3xl font-bold">{severity_counts.critical || 0}</div>
                <div className="text-sm uppercase tracking-wide">Critical</div>
              </div>
              <div className="bg-red-600 text-white p-4 rounded-lg border-2 border-red-500">
                <div className="text-3xl font-bold">{severity_counts.high || 0}</div>
                <div className="text-sm uppercase tracking-wide">High</div>
              </div>
              <div className="bg-orange-500 text-white p-4 rounded-lg border-2 border-orange-400">
                <div className="text-3xl font-bold">{severity_counts.medium || 0}</div>
                <div className="text-sm uppercase tracking-wide">Medium</div>
              </div>
              <div className="bg-blue-600 text-white p-4 rounded-lg border-2 border-blue-500">
                <div className="text-3xl font-bold">{severity_counts.low || 0}</div>
                <div className="text-sm uppercase tracking-wide">Low</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      <div className="max-w-5xl mx-auto py-8 px-6">
        <h2 className="text-2xl font-bold text-off-white mb-6">
          Findings ({findings.length})
        </h2>

        <div className="space-y-6">
          {findings.map((finding, idx) => (
            <div
              key={finding.id || idx}
              className="bg-white rounded-lg border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Finding Header */}
              <div className={`p-4 border-b-2 ${getSeverityColor(finding.severity)} rounded-t-lg`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${getSeverityBadgeColor(finding.severity)}`}>
                      {finding.severity}
                    </span>
                    {finding.cvss_score && (
                      <span className="text-xs font-bold bg-purple-medium text-white px-2 py-1 rounded">
                        CVSS {finding.cvss_score}
                      </span>
                    )}
                    {finding.validated !== undefined && (
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        finding.validated
                          ? 'bg-green-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}>
                        {finding.validated ? '✅ VERIFIED' : '⚠️ POTENTIAL'}
                      </span>
                    )}
                    <h3 className="font-bold text-lg flex-1">
                      {finding.title || finding.type || 'Finding'}
                    </h3>
                  </div>
                  <div className="text-xs font-mono text-white bg-white/20 px-3 py-1 rounded truncate max-w-md">
                    {finding.url || finding.metadata?.url || target_url}
                  </div>
                </div>
              </div>

              {/* Finding Body */}
              <div className="p-6 space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-bold text-purple-gray uppercase mb-2 tracking-wider">
                    Description
                  </h4>
                  <div className="bg-purple-deep rounded p-3 relative group">
                    <code className="text-green-400 text-xs break-all leading-relaxed whitespace-pre-wrap font-mono">
                      {finding.description}
                    </code>
                    <button
                      onClick={() => copyToClipboard(finding.description)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-purple-gray hover:text-white text-xs px-2 py-1"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {/* Reproduction Steps */}
                {finding.reproduction?.steps && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 tracking-wider">
                      👣 Reproduction Steps
                    </h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-purple-gray">
                      {finding.reproduction.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Payload */}
                {finding.payload && (
                  <div>
                    <h4 className="text-xs font-bold text-purple-gray uppercase mb-2 tracking-wider">
                      Payload
                    </h4>
                    <div className="bg-purple-deep rounded p-3 relative group">
                      <code className="text-yellow-400 text-xs break-all leading-relaxed font-mono">
                        {finding.payload}
                      </code>
                      <button
                        onClick={() => copyToClipboard(finding.payload || '')}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-purple-gray hover:text-white text-xs px-2 py-1"
                        title="Copy"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                )}

                {/* Impact & Remediation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {finding.impact && (
                    <div>
                      <h4 className="text-xs font-bold text-red-400 uppercase mb-2 tracking-wider">
                        Risk Impact
                      </h4>
                      <p className="text-sm text-muted">{finding.impact}</p>
                    </div>
                  )}
                  {finding.remediation && (
                    <div>
                      <h4 className="text-xs font-bold text-blue-500 uppercase mb-2 tracking-wider">
                        Remediation
                      </h4>
                      <p className="text-sm text-muted">{finding.remediation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {findings.length === 0 && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8 text-center">
            <ShieldCheckIcon className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-800 mb-2">No Vulnerabilities Found</h3>
            <p className="text-green-600">
              The scan completed successfully with no security issues detected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
