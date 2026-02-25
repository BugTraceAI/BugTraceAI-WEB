// components/settings/DangerZoneTab.tsx
// Danger zone tab extracted from SettingsModal.tsx.
// Handles data clearing with multi-step confirmation.

import React, { useState } from 'react';
import { Spinner } from '../Spinner.tsx';

interface ClearResult {
    success: boolean;
    message: string;
    deleted?: {
        chatSessions?: number;
        chatMessages?: number;
        analysisReports?: number;
        cliReports?: number;
        cliScans?: number;
    };
}

interface DangerZoneTabProps {
    onClearAll: () => Promise<ClearResult>;
}

export const DangerZoneTab: React.FC<DangerZoneTabProps> = ({ onClearAll }) => {
    const [dangerConfirmation, setDangerConfirmation] = useState('');
    const [showDangerConfirm, setShowDangerConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [clearResult, setClearResult] = useState<ClearResult | null>(null);

    const handleClearAll = async () => {
        setShowDangerConfirm(false);
        setIsClearing(true);
        try {
            const result = await onClearAll();
            setClearResult(result);
            setDangerConfirmation('');
        } catch (err: any) {
            setClearResult({ success: false, message: err.message || 'Unknown error' });
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Warning Header */}
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
                <div className="flex items-start gap-3">
                    <svg className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <div>
                        <h3 className="text-red-400 font-semibold">Danger Zone</h3>
                        <p className="text-sm text-red-300/80 mt-1">
                            Actions in this section are <strong>irreversible</strong>. All your chat history, analysis reports, and CLI scan data will be permanently deleted.
                        </p>
                    </div>
                </div>
            </div>

            {/* Clear All Data Section */}
            <div className="p-4 rounded-lg border border-red-500/30 bg-purple-deep/30 space-y-4">
                <div>
                    <h4 className="text-off-white font-medium">Clear All Data</h4>
                    <p className="text-sm text-muted mt-1">
                        This will delete all chat sessions, messages, analysis reports, and CLI reports from the database.
                    </p>
                </div>

                {/* Confirmation Input */}
                <div>
                    <label htmlFor="danger-confirm" className="block text-xs text-muted mb-2">
                        Type <code className="bg-red-500/20 px-1.5 py-0.5 rounded text-red-400">Delete All</code> to confirm
                    </label>
                    <input
                        id="danger-confirm"
                        type="text"
                        value={dangerConfirmation}
                        onChange={(e) => {
                            setDangerConfirmation(e.target.value);
                            setClearResult(null);
                        }}
                        placeholder="Type 'Delete All' here"
                        className="w-full px-3 py-2 bg-purple-deep/50 border border-red-500/30 rounded-lg text-white placeholder-red-300/30 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:outline-none transition-colors"
                    />
                </div>

                {/* Delete Button */}
                <button
                    onClick={() => setShowDangerConfirm(true)}
                    disabled={dangerConfirmation !== 'Delete All' || isClearing}
                    className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all ${dangerConfirmation === 'Delete All' && !isClearing
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-red-900/30 text-red-400/50 cursor-not-allowed'
                        }`}
                >
                    {isClearing ? (
                        <span className="flex items-center justify-center gap-2">
                            <Spinner />
                            Clearing...
                        </span>
                    ) : (
                        'Delete All Data'
                    )}
                </button>

                {/* Result Message */}
                {clearResult && (
                    <div className={`p-3 rounded-lg ${clearResult.success
                        ? 'bg-green-900/20 border border-green-500/30'
                        : 'bg-red-900/20 border border-red-500/30'
                        }`}>
                        <p className={`text-sm ${clearResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {clearResult.message}
                        </p>
                        {clearResult.deleted && (
                            <div className="text-xs text-muted mt-2 grid grid-cols-2 gap-x-4">
                                <span>Chat Sessions: <span className="text-off-white">{clearResult.deleted.chatSessions || 0}</span></span>
                                <span>Messages: <span className="text-off-white">{clearResult.deleted.chatMessages || 0}</span></span>
                                <span>Analysis Reports: <span className="text-off-white">{clearResult.deleted.analysisReports || 0}</span></span>
                                <span>CLI Reports: <span className="text-off-white">{clearResult.deleted.cliReports || 0}</span></span>
                                {(clearResult.deleted.cliScans ?? 0) > 0 && (
                                    <span>CLI Scans: <span className="text-off-white">{clearResult.deleted.cliScans}</span></span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Confirmation Dialog */}
            {showDangerConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowDangerConfirm(false)}>
                    <div className="bg-purple-medium border border-red-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-4">
                            <div className="p-2 rounded-full bg-red-500/20">
                                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-red-400">Are you sure?</h3>
                                <p className="text-sm text-muted mt-2">
                                    This action <strong className="text-red-400">cannot be undone</strong>. All your data will be permanently deleted from the database.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowDangerConfirm(false)}
                                className="flex-1 px-4 py-2 bg-purple-light/50 border border-purple-elevated/50 text-off-white font-medium rounded-lg hover:bg-purple-light/70 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearAll}
                                disabled={isClearing}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isClearing ? 'Deleting...' : 'Yes, Delete Everything'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
