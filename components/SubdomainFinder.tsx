// @author: Albert C | @yz9yt | github.com/yz9yt
// components/SubdomainFinder.tsx
// version 0.1 Beta
import React, { useState } from 'react';
import { ScanIcon, ShareIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';

export const SubdomainFinder: React.FC = () => {
    const [domainInput, setDomainInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleOpenSubdomainList = () => {
        const cleanedDomain = domainInput.trim();
        if (!cleanedDomain) {
            setError('Please enter a domain name.');
            return;
        }
        if (cleanedDomain.includes('://') || cleanedDomain.includes('/')) {
            setError('Invalid format. Please enter a domain name only (e.g., example.com), not a full URL.');
            return;
        }
        
        setError(null);
        
        const crtShUrl = `https://crt.sh/json?q=${cleanedDomain}`;
        window.open(crtShUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <ToolLayout
            icon={<ShareIcon className="h-8 w-8 text-coral" />}
            title="Subdomain Finder"
            description="Discover subdomains using Certificate Transparency logs from crt.sh."
        >
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <div className="relative flex-grow w-full max-w-lg">
                    <input
                        type="text"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder="example.com"
                        className="input-premium w-full !py-3.5 px-6 !rounded-2xl !text-base"
                        onKeyDown={(e) => e.key === 'Enter' && handleOpenSubdomainList()}
                    />
                </div>
                <button
                    onClick={handleOpenSubdomainList}
                    disabled={!domainInput.trim()}
                    className="btn-mini btn-mini-primary w-full sm:w-auto !py-4 px-10 !rounded-2xl !text-sm group"
                >
                    <ScanIcon className="h-5 w-5 mr-3 group-hover:rotate-12 transition-transform" />
                    Open Subdomain List
                </button>
            </div>
            {error && (
                <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg font-mono max-w-3xl mx-auto">{error}</div>
            )}
        </ToolLayout>
    );
};