// components/cli/ReportViewer.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, TerminalIcon, DocumentTextIcon, ScanIcon, TrashIcon, ShieldCheckIcon } from '../Icons.tsx';
import { ReportContent } from './ReportContent.tsx';

interface Report {
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

interface ReportViewerProps {
  report: Report | null;
  onRescan?: (targetUrl: string) => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report, onRescan }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  const CLI_API_URL = import.meta.env.VITE_CLI_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (report) {
      loadReportData();
    }
  }, [report?.id]);

  const loadReportData = async () => {
    if (!report) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${CLI_API_URL}/api/scans/${report.id}/files/validated_findings.json`
      );

      if (!response.ok) {
        throw new Error('Failed to load report data');
      }

      const data = await response.json();

      const transformedData = {
        target_url: report.target_url,
        scan_date: report.scan_date,
        findings: data.findings || [],
        manual_review: data.manual_review || [],
        severity_counts: report.severity_summary || {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      };

      setReportData(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHTML = () => {
    if (!report) return;
    const reportUrl = `${CLI_API_URL}/api/scans/${report.id}/files/report.html`;
    window.open(reportUrl, '_blank');
  };

  const handleRescan = () => {
    if (!report || !onRescan) return;
    onRescan(report.target_url);
  };

  const downloadFile = (filename: string) => {
    if (!report) return;
    const fileUrl = `${CLI_API_URL}/api/scans/${report.id}/files/${filename}`;
    window.open(fileUrl, '_blank');
  };

  if (!report) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-purple-gray/40">
        <div className="p-6 rounded-2xl bg-purple-deep/20 border border-white/[0.05] shadow-2xl text-center max-w-sm">
          <ScanIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <h3 className="text-white/80 font-bold mb-1">No Report Selected</h3>
          <p className="text-xs leading-relaxed">
            Select an assessment from the history sidebar to view detailed vulnerabilities and findings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-coral/20 border-t-coral animate-spin" />
            <ShieldCheckIcon className="absolute inset-0 m-auto h-5 w-5 text-coral/40" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted animate-pulse">Parsing Intelligence</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl bg-red-500/5 border border-red-500/10">
          <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
          <button
            onClick={loadReportData}
            className="btn-mini bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
          >
            RETRY CORE FETCH
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Premium Toolbar */}
      <div className="flex justify-between items-center px-6 py-4 bg-ui-bg/20 border-b border-ui-border backdrop-blur-3xl">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="label-mini !text-ui-accent mb-0.5">Active Mission</span>
            <h3 className="text-sm font-black text-ui-text-main truncate max-w-md font-mono tracking-tight">
              {report.target_url}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRescan && (
            <button
              onClick={handleRescan}
              className="btn-mini btn-mini-secondary !h-10 !px-4"
              title="Initialize Rescan"
            >
              <TerminalIcon className="h-3.5 w-3.5 mr-2" />
              NEW SCAN
            </button>
          )}

          <button
            onClick={handleOpenHTML}
            className="btn-mini btn-mini-primary !h-10 !px-6 shadow-glow-coral"
          >
            OPEN HTML MASTER REPORT
          </button>
        </div>
      </div>

      {/* Modern Export Bar */}
      <div className="px-6 py-3 bg-ui-input-bg/10 border-b border-ui-border flex items-center justify-between">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 pr-4 border-r border-ui-border">
            <DocumentTextIcon className="h-3.5 w-3.5 text-ui-text-dim" />
            <span className="label-mini !text-[9px]">Export Logs</span>
          </div>

          <div className="flex items-center gap-4">
            {/* JSON Downloads */}
            <div className="flex items-center gap-2">
              {[
                { label: 'Validated JSON', file: 'validated_findings.json', color: 'hover:border-blue-500/40 text-blue-400' },
                { label: 'Raw JSON', file: 'raw_findings.json', color: 'hover:border-blue-400/40 text-blue-300' }
              ].map(btn => (
                <button
                  key={btn.file}
                  onClick={() => downloadFile(btn.file)}
                  className={`btn-mini !py-1 !px-2.5 !h-auto border-ui-border !rounded-lg !text-[8.5px] bg-ui-input-bg/40 ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="w-px h-3 bg-ui-border" />

            {/* Markdown Downloads */}
            <div className="flex items-center gap-2">
              {[
                { label: 'Final MD', file: 'final_report.md', color: 'hover:border-emerald-500/40 text-emerald-400' },
                { label: 'Validated MD', file: 'validated_findings.md', color: 'hover:border-emerald-400/40 text-emerald-300' }
              ].map(btn => (
                <button
                  key={btn.file}
                  onClick={() => downloadFile(btn.file)}
                  className={`btn-mini !py-1 !px-2.5 !h-auto border-ui-border !rounded-lg !text-[8.5px] bg-ui-input-bg/40 ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Report Content with custom scrollbar */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-gradient-to-b from-[#0d0d12] to-black/20">
        {reportData && <ReportContent data={reportData} />}
      </div>
    </div>
  );
};
