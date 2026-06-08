// @author: Albert C | @yz9yt | github.com/yz9yt
// components/ApiDiscovery.tsx
// version 0.1 Beta
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToolLayout } from './ToolLayout.tsx';
import { ScanIcon, ApiRouteIcon, StopIcon, ArrowDownTrayIcon, HistoryIcon, TrashIcon, ArrowPathIcon } from './Icons.tsx';
import { useKiterunner, KrRoute, KrSavedScan, KrScanStatus } from '../hooks/useKiterunner.ts';

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
  connecting: 'Connecting to api-routes-mcp…',
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

const SAVED_STATUS_STYLES: Record<KrSavedScan['status'], string> = {
  completed: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  failed: 'bg-red-900/50 text-red-300 border-red-700/50',
  stopped: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
};

function formatTimestamp(value: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'scan';
}

function labelForWordlist(wordlist: string) {
  switch (wordlist) {
    case 'api':
    case 'api-endpoints.txt':
      return 'api-endpoints';
    case 'raft':
    case 'raft-medium-directories.txt':
      return 'raft-medium';
    case 'actions':
    case 'actions.txt':
      return 'actions';
    case 'small':
    case 'routes-small.kite':
      return 'routes-small';
    case 'large':
    case 'routes-large.kite':
      return 'routes-large';
    default:
      return wordlist;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export const ApiDiscovery: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [target, setTarget] = useState('');
  const [wordlist, setWordlist] = useState('api');
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
    warning,
    warningDetail,
    isReady,
    activeScanId,
    activeStartedAt,
    activeTarget,
    activeWordlist,
    scanHistory,
    removeSavedScan,
    clearSavedScans,
    showSavedScan,
  } = useKiterunner();

  useEffect(() => {
    if (activeTarget) setTarget(activeTarget);
    if (activeWordlist) {
      if (activeWordlist === 'api-endpoints.txt') setWordlist('api');
      else if (activeWordlist === 'raft-medium-directories.txt') setWordlist('raft');
      else if (activeWordlist === 'actions.txt') setWordlist('actions');
      else if (activeWordlist === 'routes-small.kite') setWordlist('small');
      else if (activeWordlist === 'routes-large.kite') setWordlist('large');
      else setWordlist(activeWordlist);
    }
  }, [activeTarget, activeWordlist]);

  const isRunning = scanStatus === 'running';
  const isDone = scanStatus === 'completed' || scanStatus === 'stopped';
  const canScan = isReady && !isRunning && target.trim().length > 0;
  const showCurrentResults = routes.length > 0 && scanStatus !== 'idle' && scanStatus !== 'connecting';

  const handleScan = useCallback(() => {
    const t = target.trim();
    if (!t) return;
    startScan(t, wordlist);
    setActiveTab('current');
  }, [target, wordlist, startScan]);

  const handleDownload = useCallback((scanRoutes: KrRoute[], targetHint: string, scanId?: number) => {
    const blob = new Blob([JSON.stringify(scanRoutes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTarget = sanitizeFilenamePart(targetHint);
    const suffix = scanId ? `scan-${scanId}` : new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    a.download = `api-discovery-${safeTarget}-${suffix}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleLoadIntoScan = useCallback((urls = urlList, nextTarget = target.trim()) => {
    navigate('/bugtraceai/scan', {
      state: { url_list: urls, target_url: nextTarget },
    });
  }, [navigate, urlList, target]);

  const handleOpenSavedScan = useCallback((scan: KrSavedScan) => {
    showSavedScan(scan);
    setTarget(scan.target);
    setFilterStatus('');
    setActiveTab('current');
  }, [showSavedScan]);

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
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-5">
        <button
          onClick={() => setActiveTab('current')}
          className={`group py-2.5 px-4 label-mini rounded-xl transition-all duration-300 flex items-center gap-2 border ${activeTab === 'current'
            ? 'border-ui-accent/40 text-ui-accent bg-ui-accent/8'
            : 'border-white/5 text-ui-text-dim hover:text-ui-text-main hover:bg-white/5'
            }`}
        >
          <ApiRouteIcon className="h-4 w-4" />
          Current Scan
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`group py-2.5 px-4 label-mini rounded-xl transition-all duration-300 flex items-center gap-2 border ${activeTab === 'history'
            ? 'border-ui-accent/40 text-ui-accent bg-ui-accent/8'
            : 'border-white/5 text-ui-text-dim hover:text-ui-text-main hover:bg-white/5'
            }`}
        >
          <HistoryIcon className="h-4 w-4" />
          Old Scans
          {scanHistory.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/10 text-[10px] text-white">
              {scanHistory.length}
            </span>
          )}
        </button>
        {activeTab === 'history' && scanHistory.length > 0 && (
          <button
            onClick={clearSavedScans}
            className="ml-auto btn-mini !py-2 px-4 !rounded-lg !text-xs flex items-center gap-1.5 border border-red-700/40 text-red-300 hover:bg-red-900/30 transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Clear All
          </button>
        )}
      </div>

      {activeTab === 'current' ? (
        <>
          {/* ── Input row ────────────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
              onChange={(e) => setWordlist(e.target.value)}
              disabled={isRunning}
              className="input-premium !py-3 px-4 !rounded-xl !text-sm !bg-ui-bg cursor-pointer"
            >
              <optgroup label="Text wordlists (brute)">
                <option value="api">api-endpoints (~160 paths, fast)</option>
                <option value="raft">raft-medium (~30k, legacy/CMS)</option>
                <option value="actions">actions (verb fuzzing)</option>
              </optgroup>
              <optgroup label="Kite wordlists (structured)">
                <option value="small">routes-small (~5 MB)</option>
                <option value="large">routes-large (~90 MB)</option>
              </optgroup>
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

          {/* ── Status bar ───────────────────────────────────────────────────── */}
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[scanStatus]}`} />
              <span className="text-xs text-purple-gray">
                {STATUS_LABELS[scanStatus]}
                {isRunning && routesFound > 0 && (
                  <span className="ml-2 text-coral font-medium">{routesFound} routes found</span>
                )}
              </span>
              {activeScanId && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-white/70 border border-white/5">
                  Scan #{activeScanId}
                </span>
              )}
              <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-white/70 border border-white/5">
                {labelForWordlist(activeWordlist ?? wordlist)}
              </span>
              {activeStartedAt && (
                <span className="text-[11px] text-white/50">
                  Started {formatTimestamp(activeStartedAt)}
                </span>
              )}
            </div>
            {isRunning && progress > 0 && (
              <div className="flex-1 max-w-xs h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-coral to-purple-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* ── Error ────────────────────────────────────────────────────────── */}
          {error && (
            <div className="mt-3 p-3 bg-red-900/40 border border-red-700/50 text-red-200 rounded-lg text-xs font-mono">
              {error}
            </div>
          )}

          {/* ── SPA / catch-all warning ─────────────────────────────────────── */}
          {warning === 'spa_catchall' && (
            <div className="mt-3 p-4 bg-yellow-900/30 border border-yellow-600/50 text-yellow-200 rounded-lg text-sm">
              <div className="font-semibold mb-1">⚠ SPA / Catch-all detected — 0 routes found</div>
              <div className="text-yellow-300/80 text-xs leading-relaxed">
                {warningDetail ?? 'Target returns HTTP 200 for every path. Scan the actual backend API URL instead.'}
              </div>
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────────── */}
          {showCurrentResults && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-purple-gray">
                  <span className="text-white font-semibold">{routes.length}</span>{' '}
                  {isRunning ? 'routes discovered so far' : 'routes discovered'}
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
                  onClick={() => handleDownload(routes, activeTarget ?? target, activeScanId ?? undefined)}
                  className="btn-mini !py-2 px-5 !rounded-lg !text-xs flex items-center gap-1.5 border border-white/10 hover:border-coral/40 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  Download JSON
                </button>
                <button
                  onClick={() => handleLoadIntoScan(urlList, activeTarget ?? target.trim())}
                  disabled={urlList.length === 0}
                  className="btn-mini btn-mini-primary !py-2 px-5 !rounded-lg !text-xs flex items-center gap-1.5"
                >
                  <ScanIcon className="h-3.5 w-3.5" />
                  Load into Scan
                </button>
              </div>

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
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {scanHistory.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-10 text-center text-purple-gray text-sm">
              No saved scans yet. Completed, stopped, and recovered scans will appear here.
            </div>
          ) : (
            scanHistory.map((scan) => (
              <div key={scan.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${SAVED_STATUS_STYLES[scan.status]}`}>
                        {scan.status.toUpperCase()}
                      </span>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-white/70 border border-white/5">
                        {labelForWordlist(scan.wordlist)}
                      </span>
                      <span className="text-[11px] text-white/40">Scan #{scan.scanId}</span>
                    </div>
                    <div className="mt-2 font-mono text-sm text-white break-all">{scan.target}</div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-purple-gray">
                      <span>Started: {formatTimestamp(scan.startedAt)}</span>
                      <span>Finished: {formatTimestamp(scan.finishedAt)}</span>
                      <span>{scan.routesFound} routes saved</span>
                    </div>
                    {scan.error && (
                      <div className="mt-2 text-xs text-red-300 font-mono">{scan.error}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      onClick={() => handleOpenSavedScan(scan)}
                      className="btn-mini !py-2 px-4 !rounded-lg !text-xs flex items-center gap-1.5 border border-white/10 hover:border-ui-accent/30 transition-colors"
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" />
                      Open
                    </button>
                    <button
                      onClick={() => handleDownload(scan.routes, scan.target, scan.scanId)}
                      className="btn-mini !py-2 px-4 !rounded-lg !text-xs flex items-center gap-1.5 border border-white/10 hover:border-coral/40 transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                      Download
                    </button>
                    <button
                      onClick={() => handleLoadIntoScan(scan.urlList, scan.target)}
                      disabled={scan.urlList.length === 0}
                      className="btn-mini btn-mini-primary !py-2 px-4 !rounded-lg !text-xs flex items-center gap-1.5"
                    >
                      <ScanIcon className="h-3.5 w-3.5" />
                      Load into Scan
                    </button>
                    <button
                      onClick={() => removeSavedScan(scan.id)}
                      className="btn-mini !py-2 px-4 !rounded-lg !text-xs flex items-center gap-1.5 border border-red-700/40 text-red-300 hover:bg-red-900/30 transition-colors"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </ToolLayout>
  );
};
