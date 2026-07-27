// components/ReportHeader.tsx
import React from 'react';
import { VulnerabilityReport } from '../types.ts';
import { downloadReportAsMarkdown, downloadReportAsJson } from '../utils/reportExporter.ts';
import { DocumentTextIcon, CodeBracketSquareIcon } from './Icons.tsx';

interface ReportHeaderProps {
    report: VulnerabilityReport;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ report }) => {
    
    const handleDownloadMD = () => {
        downloadReportAsMarkdown(report);
    }
    
    const handleDownloadJSON = () => {
        downloadReportAsJson(report);
    }

    return (
        <div className="mb-6 pb-4 border-b border-0">
            <h3 className="text-xl font-semibold text-white">
                Results for: <span className="text-coral-hover font-mono break-all">{report.analyzedTarget}</span>
            </h3>
            <div className="mt-4 pt-4 border-t border-0 flex items-center gap-2">
                 <button
                    onClick={handleDownloadMD}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-900/40 border border-purple-700/80 rounded-lg hover:bg-purple-900/60 transition-colors"
                    title="Download full report in Markdown format"
                >
                    <DocumentTextIcon className="h-4 w-4" />
                    Download as Markdown (.md)
                </button>
                 <button
                    onClick={handleDownloadJSON}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-coral-hover bg-purple-elevated/40 border border-coral/80 rounded-lg hover:bg-purple-elevated/60 transition-colors"
                    title="Download raw report data in JSON format"
                >
                    <CodeBracketSquareIcon className="h-4 w-4" />
                    Download as JSON (.json)
                </button>
            </div>
        </div>
    );
};