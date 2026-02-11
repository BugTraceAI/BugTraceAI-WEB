// @author: Albert C | @yz9yt | github.com/yz9yt
// components/UrlListFinder.tsx
// version 0.1 Beta
import React, { useState } from 'react';
import { ScanIcon, ListBulletIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';

export const UrlListFinder: React.FC = () => {
    const [urlInput, setUrlInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleOpenUrlList = () => {
        const cleanedUrl = urlInput.trim();
        if (!cleanedUrl) {
            setError('Please enter a URL.');
            return;
        }
        if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
            setError('Invalid format. URL must start with http:// or https://');
            return;
        }
        
        setError(null);
        
        // Use the full user-provided URL to respect the protocol
        const waybackUrl = `https://web.archive.org/cdx/search/cdx?url=${cleanedUrl}/*&output=txt&fl=original&collapse=urlkey`;
        window.open(waybackUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <ToolLayout
            icon={<ListBulletIcon className="h-8 w-8 text-coral" />}
            title="URL List Finder"
            description="Discover URLs for a target domain using the extensive index of the Wayback Machine."
        >
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <div className="relative flex-grow w-full max-w-lg">
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full pl-4 pr-12 py-3 bg-purple-medium/60 border-0 rounded-lg text-white placeholder-text-tertiary focus:ring-2 focus:ring-coral/50 focus:border-coral focus:outline-none transition-all duration-300"
                        onKeyDown={(e) => e.key === 'Enter' && handleOpenUrlList()}
                    />
                </div>
                <button
                    onClick={handleOpenUrlList}
                    disabled={!urlInput.trim()}
                    className="group w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-3 bg-coral-active hover:bg-coral text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-coral/20 hover:shadow-coral/40"
                >
                    <ScanIcon className="h-5 w-5 mr-2" />
                    <span className="relative">Open URL List</span>
                </button>
            </div>
            {error && (
                <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg font-mono max-w-3xl mx-auto">{error}</div>
            )}
        </ToolLayout>
    );
};