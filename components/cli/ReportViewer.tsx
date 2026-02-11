// components/cli/ReportViewer.tsx
import React, { useState, useEffect } from 'react';
import { ArrowPathIcon, TerminalIcon } from '../Icons.tsx';
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

  // Load report data when report changes
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
      // Load the validated_findings.json file which has all the data
      const response = await fetch(
        `${CLI_API_URL}/api/scans/${report.id}/files/validated_findings.json`
      );

      if (!response.ok) {
        throw new Error('Failed to load report data');
      }

      const data = await response.json();

      // Transform data to match our ReportContent interface
      const transformedData = {
        target_url: report.target_url,
        scan_date: report.scan_date,
        findings: data.findings || [],
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

  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-purple-gray">
        <div className="text-center">
          <TerminalIcon className="h-16 w-16 mx-auto mb-4 text-coral" />
          <p className="text-lg">Select a report to view</p>
          <p className="text-sm text-muted mt-2">
            Choose a report from the list on the left
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 text-coral animate-spin mx-auto mb-2" />
          <p className="text-sm text-purple-gray">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadReportData}
            className="px-4 py-2 bg-coral-active hover:bg-coral-active text-white rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const downloadFile = (filename: string) => {
    if (!report) return;
    const fileUrl = `${CLI_API_URL}/api/scans/${report.id}/files/${filename}`;
    window.open(fileUrl, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="flex justify-between items-center p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white truncate max-w-md" title={report.target_url}>
            {report.target_url || 'Unknown target'}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onRescan && (
            <button
              onClick={handleRescan}
              data-testid="report-viewer-rescan"
              className="px-3 py-1.5 bg-coral-active hover:bg-coral-active text-white rounded text-sm transition-colors flex items-center gap-2"
              title="Re-scan this target"
            >
              <TerminalIcon className="h-4 w-4" />
              Re-scan Target
            </button>
          )}

          <button
            onClick={handleOpenHTML}
            data-testid="report-viewer-open-html"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            title="Open full HTML report in new tab"
          >
            Open Full Report
          </button>
        </div>
      </div>

      {/* Download Section */}
      <div className="bg-gray-100 border-b border-gray-300 py-3 px-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-600 uppercase mr-2">Download:</span>

          {/* JSON Downloads */}
          <button
            onClick={() => downloadFile('validated_findings.json')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
            title="Validated findings in JSON format"
          >
            📄 Validated JSON
          </button>

          <button
            onClick={() => downloadFile('raw_findings.json')}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
            title="Raw findings in JSON format"
          >
            📄 Raw JSON
          </button>

          <button
            onClick={() => downloadFile('engagement_data.json')}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
            title="Complete engagement data"
          >
            📄 Full Data JSON
          </button>

          {/* Markdown Downloads */}
          <button
            onClick={() => downloadFile('final_report.md')}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
            title="Final report in Markdown"
          >
            📝 Final Report MD
          </button>

          <button
            onClick={() => downloadFile('validated_findings.md')}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
            title="Validated findings in Markdown"
          >
            📝 Validated MD
          </button>

          <button
            onClick={() => downloadFile('raw_findings.md')}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
            title="Raw findings in Markdown"
          >
            📝 Raw MD
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto">
        {reportData && <ReportContent data={reportData} />}
      </div>
    </div>
  );
};
