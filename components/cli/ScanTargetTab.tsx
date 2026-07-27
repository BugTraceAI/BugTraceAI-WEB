// components/cli/ScanTargetTab.tsx
/* eslint-disable max-lines -- CLI scan target tab component.
 * Orchestrates scan configuration, execution, and real-time output display.
 * Manages scan lifecycle from form submission through WebSocket monitoring.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScanConfigForm, ScanConfig } from './ScanConfigForm.tsx';
import { ScanConsole } from './ScanConsole.tsx';
import { ScanDashboard } from './ScanDashboard.tsx';
import { TerminalIcon, TrashIcon, StopIcon, PauseIcon, PlayIcon } from '../Icons.tsx';
import { useScanSocket } from '../../hooks/useScanSocket.ts';
import { cliApi } from '../../lib/cliApi.ts';

interface ScanTargetTabProps {
  onScanStart?: (config: ScanConfig) => void;
}

const DEFAULT_CONFIG: ScanConfig = {
  target_url: '',
  scan_type: 'full',
  safe_mode: null,
  max_depth: 5,
  max_urls: 50,
  resume: false,
  use_vertical: true,
  focused_agents: [],
  param: '',
  url_list: undefined,
  auth: undefined,
};

interface ActiveScan {
  id: number;
  status: string;
  target_url: string;
  elapsed_seconds: number;
}

export const ScanTargetTab: React.FC<ScanTargetTabProps> = ({ onScanStart }) => {
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [scanError, setScanError] = useState<string | null>(null);
  const [runningScan, setRunningScan] = useState<ActiveScan | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const startingRef = useRef(false);
  const wasScanningRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logs, isConnected, isScanning, subscribe, unsubscribe, clearLogs, clearDashboard, pipeline, agents, metrics, findings, agentLevels } = useScanSocket();

  // Hydrate config from router state (e.g. "Load into Scan" from API Discovery)
  useEffect(() => {
    const state = location.state as { url_list?: string[]; target_url?: string } | null;
    if (state?.url_list && state.url_list.length > 0) {
      setConfig(prev => ({
        ...prev,
        url_list: state.url_list,
        target_url: state.target_url ?? prev.target_url,
      }));
      // Clear state so a page refresh doesn't re-apply it
      navigate(location.pathname, { replace: true, state: null });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for running scans on mount
  useEffect(() => {
    const checkActiveScans = async () => {
      try {
        const response = await cliApi.listScans({ status_filter: 'RUNNING' });
        const running = response.scans.find(s => (s.status || '').toLowerCase() === 'running');
        if (running) {
          setRunningScan({
            id: running.scan_id,
            status: 'running',
            target_url: running.target,
            elapsed_seconds: 0,
          });
          // Sync the form config to the RUNNING scan's real values so the target bar shows the
          // truth (crawl depth / URL cap), not the local form defaults. Fixes the mismatch where
          // the bar read "MAX URLS 1" while the scan was actually running with a higher cap.
          setConfig(prev => ({
            ...prev,
            target_url: running.target || prev.target_url,
            max_depth: running.max_depth ?? prev.max_depth,
            max_urls: running.max_urls ?? prev.max_urls,
          }));
          subscribe(running.scan_id);
        }
      } catch {
        // Backend might not be running
      }
    };
    checkActiveScans();
  }, [subscribe]);

  // Clear running scan when scanning finishes
  useEffect(() => {
    const finishedNow = wasScanningRef.current && !isScanning;
    wasScanningRef.current = isScanning;

    if (runningScan && finishedNow) {
      setRunningScan(null);
      setIsStarting(false);
      setIsPaused(false);
      setHasFinished(true);
      return;
    }

    if (runningScan && !isScanning && logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog?.message.includes('[SCAN COMPLETE]') || lastLog?.message.includes('[ERROR]')) {
        setRunningScan(null);
        setIsStarting(false);
        setIsPaused(false);
        setHasFinished(true);
      }
    }
  }, [isScanning, logs, runningScan]);

  const handleConfigChange = (newConfig: ScanConfig) => {
    setConfig(newConfig);
    if (scanError) setScanError(null);
  };

  const handleStartScan = async () => {
    if (startingRef.current || isStarting) return;
    startingRef.current = true;
    setIsStarting(true);

    setScanError(null);

    if (!config.target_url || config.target_url.trim() === '') {
      setScanError('Please enter a target URL.');
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    try {
      new URL(config.target_url);
    } catch {
      setScanError('Invalid URL format. Must start with http:// or https://');
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    try {
      const response = await cliApi.startScan({
        target_url: config.target_url,
        scan_type: config.scan_type,
        safe_mode: config.safe_mode ?? undefined,
        max_depth: config.max_depth,
        max_urls: config.max_urls,
        resume: config.resume,
        use_vertical: config.use_vertical,
        focused_agents: config.focused_agents.length > 0 ? config.focused_agents : undefined,
        param: config.param || undefined,
        url_list: config.url_list,
        auth: config.auth,
      });

      // Clear logs from previous run to avoid "SCAN COMPLETE" check triggering immediately
      clearLogs();

      setRunningScan({
        id: response.scan_id,
        status: 'running',
        target_url: config.target_url,
        elapsed_seconds: 0,
      });

      setHasFinished(false);
      subscribe(response.scan_id);

      if (onScanStart) {
        onScanStart(config);
      }
    } catch (error: any) {
      setScanError(error.message || 'Failed to start scan. Check that the CLI API is running.');
      setIsStarting(false);
    } finally {
      startingRef.current = false;
    }
  };

  const handlePauseToggle = async () => {
    if (!runningScan || controlBusy) return;
    setControlBusy(true);
    setScanError(null);
    try {
      if (isPaused) {
        await cliApi.resumeScan(runningScan.id);
        setIsPaused(false);
      } else {
        await cliApi.pauseScan(runningScan.id);
        setIsPaused(true);
      }
    } catch (error: any) {
      setScanError(error.message || `Failed to ${isPaused ? 'resume' : 'pause'} scan.`);
    } finally {
      setControlBusy(false);
    }
  };

  const handleStopScan = async () => {
    if (!runningScan || controlBusy) return;
    setControlBusy(true);
    setScanError(null);
    try {
      await cliApi.stopScan(runningScan.id);
      // Stopping ends the scan: move straight to the finished state where the only
      // action is Clear. isScanning is forced false on Clear via unsubscribe().
      setIsPaused(false);
      setRunningScan(null);
      setIsStarting(false);
      setHasFinished(true);
    } catch (error: any) {
      setScanError(error.message || 'Failed to stop scan.');
    } finally {
      setControlBusy(false);
    }
  };

  const handleClearView = () => {
    unsubscribe();
    clearDashboard();
    setHasFinished(false);
    setRunningScan(null);
    setIsPaused(false);
    setControlBusy(false);
    setScanError(null);
    setConfig(DEFAULT_CONFIG);
  };

  const isValidUrl = (): boolean => {
    if (!config.target_url || config.target_url.trim() === '') return false;
    try {
      new URL(config.target_url);
      return true;
    } catch {
      return false;
    }
  };

  const scanInProgress = isScanning || !!runningScan || isStarting;

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      {/* Scan in progress banner - compact */}
      {/* Scan in progress banner - removed as it's now inline */}

      {/* Scan config + start button */}
      <div className="card-premium p-4 !rounded-3xl border-white/10">
        <ScanConfigForm
          config={config}
          onChange={handleConfigChange}
          disabled={scanInProgress}
          activeScan={scanInProgress && runningScan ? {
            id: runningScan.id,
            target_url: runningScan.target_url,
            status: runningScan.status
          } : null}
          actionButton={
            hasFinished ? (
              <button
                onClick={handleClearView}
                data-testid="scan-clear-button"
                className="btn-mini btn-mini-secondary h-8 px-5 whitespace-nowrap mt-auto"
              >
                <TrashIcon className="h-3.5 w-3.5 mr-2" />
                Clear
              </button>
            ) : scanInProgress ? (
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={handlePauseToggle}
                  disabled={controlBusy || !runningScan}
                  data-testid="scan-pause-button"
                  className={`btn-mini h-8 px-5 whitespace-nowrap ${
                    isPaused ? 'btn-mini-primary shadow-glow-coral' : 'btn-mini-secondary'
                  } ${controlBusy || !runningScan ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isPaused ? 'Resume scan' : 'Pause scan'}
                >
                  {isPaused ? (
                    <>
                      <PlayIcon className="h-3.5 w-3.5 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <PauseIcon className="h-3.5 w-3.5 mr-2" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  onClick={handleStopScan}
                  disabled={controlBusy || !runningScan}
                  data-testid="scan-stop-button"
                  className={`btn-mini btn-mini-secondary h-8 px-5 whitespace-nowrap !text-error border border-error-border/40 ${
                    controlBusy || !runningScan ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Stop scan"
                >
                  <StopIcon className="h-3.5 w-3.5 mr-2" />
                  Stop
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartScan}
                disabled={!isValidUrl()}
                data-testid="scan-start-button"
                className={`
                btn-mini h-8 px-6 whitespace-nowrap mt-auto
                ${isValidUrl()
                    ? 'btn-mini-primary shadow-glow-coral'
                    : 'btn-mini-secondary opacity-30 grayscale cursor-not-allowed'
                  }
              `}
                title={!isValidUrl() ? 'Please enter a valid target URL' : 'Start security scan'}
              >
                <TerminalIcon className="h-3.5 w-3.5 mr-2" />
                Start Scan
              </button>
            )
          }
        />

        {scanError && (
          <div className="mt-2 px-3 py-2 bg-error-bg border border-error-border rounded-xl flex items-center justify-between gap-3">
            <p className="text-error text-xs">{scanError}</p>
            <button
              onClick={() => setScanError(null)}
              className="text-error/60 hover:text-error text-xs flex-shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Dashboard: pipeline + agents + findings + console */}
      <div className="flex-1 min-h-0">
        <ScanDashboard
          logs={logs}
          onClearLogs={clearLogs}
          isConnected={isConnected}
          isScanning={scanInProgress}
          pipeline={pipeline}
          agents={agents}
          metrics={metrics}
          findings={findings}
          agentLevels={agentLevels}
        />
      </div>
    </div>
  );
};
