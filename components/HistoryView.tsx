// @author: Albert C | @yz9yt | github.com/yz9yt
// components/HistoryView.tsx
// version 0.1 Beta
import React from 'react';
import { VulnerabilityReport } from '../types.ts';
import { HistoryIcon, TrashIcon, LinkIcon, CodeBracketIcon } from './Icons.tsx';

interface HistoryViewProps {
    history: VulnerabilityReport[];
    onSelectReport: (report: VulnerabilityReport) => void;
    onClearHistory: () => void;
    selectedReportId?: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onSelectReport, onClearHistory, selectedReportId }) => {
    const handleClear = () => {
        if (window.confirm('Are you sure you want to clear all analysis history? This action cannot be undone.')) {
            onClearHistory();
        }
    }

    return (
        <div className="bg-purple-medium/50 backdrop-blur-xl p-6 sm:p-8 rounded-xl border-0 shadow-xl animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <HistoryIcon className="h-8 w-8 text-coral" />
                    <div>
                        <h3 className="text-2xl font-bold text-white">Analysis History</h3>
                        <p className="text-purple-gray text-sm">Select a previous report to view its details.</p>
                    </div>
                </div>
                {history.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="btn-mini btn-mini-secondary !text-red-400 !border-red-500/20 hover:!bg-red-500/10 px-4"
                        title="Clear all history"
                    >
                        <TrashIcon className="h-3.5 w-3.5 mr-2" />
                        Clear History
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {history.length > 0 ? (
                    history.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onSelectReport(item)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-300 border ${selectedReportId === item.id
                                    ? 'bg-ui-accent/10 border-ui-accent/40 shadow-lg shadow-ui-accent/5'
                                    : 'bg-ui-input-bg/40 border-ui-border hover:bg-ui-input-bg/60 hover:border-ui-accent/30'
                                }`}
                        >
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-ui-bg border border-ui-border flex items-center justify-center">
                                {item.analyzedTarget.startsWith('http') ? <LinkIcon className="h-5 w-5 text-ui-text-dim" /> : <CodeBracketIcon className="h-5 w-5 text-ui-text-dim" />}
                            </div>
                            <div className="flex-grow overflow-hidden">
                                <p className="truncate text-base font-semibold text-white">{item.analyzedTarget}</p>
                                <p className="text-xs text-muted">
                                    {new Date(item.id || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex-shrink-0 ml-4">
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-black/20 text-purple-gray">
                                    {item.vulnerabilities.length} {item.vulnerabilities.length === 1 ? 'Finding' : 'Findings'}
                                </span>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="text-center py-16 text-muted">
                        <HistoryIcon className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-semibold">No history yet.</p>
                        <p>Run an analysis to see your reports here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};