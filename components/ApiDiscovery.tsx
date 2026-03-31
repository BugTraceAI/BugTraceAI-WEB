// @author: Albert C | @yz9yt | github.com/yz9yt
// components/ApiDiscovery.tsx
// version 0.1 Beta
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToolLayout } from './ToolLayout.tsx';
import { ScanIcon, ApiRouteIcon, StopIcon, ArrowDownTrayIcon } from './Icons.tsx';
import { useKiterunner, KrRoute, KrScanStatus } from '../hooks/useKiterunner.ts';

// ── Method badge colours ──────────────────────────────────────────────────────
const METHOD_COLORS: Record<string, string> = {
  GET:     'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
  POST:    'bg-blue-900/60 text-blue-300 border-blue-700/50',
  PUT:     'bg-yellow-900/60 text-yellow-300 border-yellow-700/50',
  PATCH:   'bg-orange-900/60 text-orange-300 border-orange-700/50',
  DELETE:  'bg-red-900/60 text-red-300 border-red-700/50',
  HEAD:    'bg-purple-900/60 text-purple-300 border-purple-700/50',
  OPTIONS: 'bg-gray-900/60 text-gray-300 border-gray-700/50',
};

function methodBadge(method: string) {
  return METHOD_COLORS[method.toUpperCase()] ?? 'bg-gray-900/60 text-gray-300 border-gray-700/50';
}

// ── Status code colour ─────────────────────────────────────────────────────────
function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-emerald-400';
  if (code >= 300 && code < 400) return 'text-yellow-400';
  if (code >= 400 && code < 500) return 'text-red-400';
  if (code >= 500) return 'text-red-300';
  return 'text-gray-400';
}

// ── Status label ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<KrScanStatus, string> = {
  idle:       'Ready',
  connecting: 'Connecting to kiterunner-mcp…',
  running:    'Scanning…',
  completed:  'Scan complete',
  failed:     'Scan failed',
  stopped:    'Scan stopped',
};

const STATUS_DOT: Record<KrScanStatus, string> = {
  idle:       'bg-gray-500',
  connecting: 'bg-yellow-400 animate-pulse',
  running:    'bg-coral animate-pulse',
  completed:  'bg-emerald-400',
  failed:     'bg-red-500',
  stopped:    'bg-yellow-500',
};

// ── Component ─────────────────────────────────────────────────────────────────
export const ApiDiscovery: React.FC = () => {
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [wordlist, setWordlist] = useState<'small' | 'large'>('small');
  const [filterStatus, setFilterStatus] = useState('');

  const {
    startScan,
    stopScan,
    scanStatus,
    progress,
    routesFound,
    routes,
    urlList,
    error,
    isReady,
  } = useKiterunner();

  const isRunning = scanStatus === 'running';
  const isDone = scanStatus === 'completed' || scanStatus === 'stopped';
  const canScan = isReady && !isRunning && target.trim().length > 0;

  const handleScan = useCallback(() => {
    const t = target.trim();
    if (!t) return;
    startScan(t, wordlist);
  }, [target, wordlist, startScan]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(routes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-discovery-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [routes]);

  const handleLoadIntoScan = useCallback(() => {
    navigate('/bugtraceai/scan', {
      state: { url_list: urlList, target_url: target.trim() },
    });
  }, [navigate, urlList, target]);

  // Filter routes by status prefix
  const filteredRoutes = filterStatus
    ? routes.filter((r) => String(r.status).startsWith(filterStatus))
    : routes;

  return (
    <ToolLayout
      icon={<ApiRouteIcon className="h-8 w-8 text-coral" />}
      title="API Discovery"
      description="Brute-force API routes using Kiterunner — human-in-the-loop by design."
    >
      {/* ── Input row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          type="url"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canScan && handleScan()}
          placeholder="https://api.example.com"
          className="input-premium flex-1 !py-3 px-5 !rounded-xl !text-sm"
          disabled={isRunning}
        />

        <select
          value={wordlist}
          onChange={(e) => setWordlist(e.target.value as 'small' | 'large')}
          disabled={isRunning}
          className="input-premium !py-3 px-4 !rounded-xl !text-sm bg-transparent cursor-pointer"
        >
          <option value="small">routes-small (~5 MB)</option>
          <option value="large">routes-large (~90 MB)</option>
        </select>

        {!isRunning ? (
          <button
            onClick={handleScan}
            disabled={!canScan}
            className="btn-mini btn-mini-primary !py-3 px-8 !rounded-xl !text-sm group whitespace-nowrap"
          >
            <ScanIcon className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
            Scan
          </button>
        ) : (
          <button
            onClick={stopScan}
            className="btn-mini !py-3 px-8 !rounded-xl !text-sm group whitespace-nowrap border border-red-700/50 text-red-300 hover:bg-red-900/30 transition-colors"
          >
            <StopIcon className="h-4 w-4 mr-2" />
            Stop
          </button>
        )}
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="mt-4 flex items-center gap-3">
        <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[scanStatus]}`} />
        <span className="text-xs text-purple-gray">
          {STATUS_LABELS[scanStatus]}
          {isRunning && routesFound > 0 && (
            <span className="ml-2 text-coral font-medium">{routesFound} routes found</span>
          )}
        </span>
        {isRunning && progress > 0 && (
          <div className="flex-1 max-w-xs h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-coral to-purple-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/40 border border-red-700/50 text-red-200 rounded-lg text-xs font-mono">
          {error}
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {isDone && routes.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Action buttons + filter */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-purple-gray">
              <span className="text-white font-semibold">{routes.length}</span> routes discovered
            </span>
            <div className="flex-1" />
            <input
              type="text"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              placeholder="Filter by status (e.g. 2)"
              className="input-premium !py-2 px-4 !rounded-lg !text-xs w-48"
            />
            <button
              onClick={handleDownload}
              className="btn-mini !py-2 px-5 !rounded-lg !text-xs flex items-center gap-1.5 border border-white/10 hover:border-coral/40 transition-colors"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              Download JSON
            </button>
            <button
              onClick={handleLoadIntoScan}
              disabled={urlList.length === 0}
              className="btn-mini btn-mini-primary !py-2 px-5 !rounded-lg !text-xs flex items-center gap-1.5"
            >
              <ScanIcon className="h-3.5 w-3.5" />
              Load into Scan
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/3">
                  <th className="px-4 py-2.5 text-purple-gray font-medium w-20">Method</th>
                  <th className="px-4 py-2.5 text-purple-gray font-medium w-16">Status</th>
                  <th className="px-4 py-2.5 text-purple-gray font-medium">URL</th>
                  <th className="px-4 py-2.5 text-purple-gray font-medium w-20 text-right">Words</th>
                  <th className="px-4 py-2.5 text-purple-gray font-medium w-20 text-right">Lines</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((route: KrRoute, i: number) => (
                  <tr
                    key={`${route.method}-${route.url}-${i}`}
                    className="border-b border-white/3 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${methodBadge(route.method)}`}>
                        {route.method}
                      </span>
                    </td>
                    <td className={`px-4 py-2 font-mono font-semibold ${statusColor(route.status)}`}>
                      {route.status}
                    </td>
                    <td className="px-4 py-2 font-mono text-white/80 break-all">
                      <a
                        href={route.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-coral transition-colors"
                      >
                        {route.url}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-right text-white/50">{route.words}</td>
                    <td className="px-4 py-2 text-right text-white/50">{route.lines}</td>
                  </tr>
                ))}
                {filteredRoutes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-purple-gray text-xs">
                      No routes match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isDone && routes.length === 0 && !error && (
        <div className="mt-8 text-center text-purple-gray text-sm">
          No API routes discovered. Try a different wordlist or target.
        </div>
      )}
    </ToolLayout>
  );
};
