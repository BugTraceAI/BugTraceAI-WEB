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
                        className="input-premium w-full !py-3.5 px-6 !rounded-2xl !text-base"
                        onKeyDown={(e) => e.key === 'Enter' && handleOpenUrlList()}
                    />
                </div>
                <button
                    onClick={handleOpenUrlList}
                    disabled={!urlInput.trim()}
                    className="btn-mini btn-mini-primary w-full sm:w-auto !py-4 px-10 !rounded-2xl !text-sm group"
                >
                    <ScanIcon className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />
                    Open URL List
                </button>
            </div>
            {error && (
                <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg font-mono max-w-3xl mx-auto">{error}</div>
            )}
        </ToolLayout>
    );
};