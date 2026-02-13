// components/cli/ScanTargetTab.tsx
/* eslint-disable max-lines -- CLI scan target tab component.
 * Orchestrates scan configuration, execution, and real-time output display.
 * Manages scan lifecycle from form submission through WebSocket monitoring.
 */
import React, { useState, useEffect, useRef } from 'react';
import { ScanConfigForm, ScanConfig } from './ScanConfigForm.tsx';
import { ScanConsole } from './ScanConsole.tsx';
import { ScanDashboard } from './ScanDashboard.tsx';
import { TerminalIcon, TrashIcon } from '../Icons.tsx';
import { useScanSocket } from '../../hooks/useScanSocket.ts';
import { cliApi } from '../../lib/cliApi.ts';

interface ScanTargetTabProps {
  onScanStart?: (config: ScanConfig) => void;
}

const DEFAULT_CONFIG: ScanConfig = {
  target_url: '',
  scan_type: 'full',
  safe_mode: null,
  max_depth: 1,
  max_urls: 1,
  resume: false,
  use_vertical: true,
  focused_agents: [],
  param: '',
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
  const startingRef = useRef(false);
  const { logs, isConnected, isScanning, subscribe, clearLogs, pipeline, agents, metrics, findings } = useScanSocket();

  // Check for running scans on mount
  useEffect(() => {
    const checkActiveScans = async () => {
      try {
        const response = await cliApi.listScans({ status_filter: 'RUNNING' });
        const scans: ActiveScan[] = response.scans.map(s => ({
          id: s.scan_id,
          status: s.status.toLowerCase(),
          target_url: s.target,
          elapsed_seconds: 0,
        }));
        const running = scans.find(s => s.status === 'running');
        if (running) {
          setRunningScan(running);
          subscribe(running.id);
        }
      } catch {
        // Backend might not be running
      }
    };
    checkActiveScans();
  }, [subscribe]);

  // Clear running scan when scanning finishes
  useEffect(() => {
    if (runningScan && !isScanning && logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog?.message.includes('[SCAN COMPLETE]') || lastLog?.message.includes('[ERROR]')) {
        setRunningScan(null);
        setIsStarting(false);
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

  const handleClearView = () => {
    clearLogs();
    setHasFinished(false);
    setRunningScan(null);
    // Note: useScanSocket state should ideally clear here too
    // For now we rely on the parent/hook to handle the reset if possible
    window.location.reload(); // Quickest way to clear all hook-based scan state
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
                className="btn-mini btn-mini-secondary h-8 px-5 whitespace-nowrap mt-auto"
              >
                <TrashIcon className="h-3.5 w-3.5 mr-2" />
                Clear System
              </button>
            ) : (
              <button
                onClick={handleStartScan}
                disabled={!isValidUrl() || scanInProgress}
                data-testid="scan-start-button"
                className={`
                btn-mini h-8 px-6 whitespace-nowrap mt-auto
                ${isValidUrl() && !scanInProgress
                    ? 'btn-mini-primary shadow-glow-coral'
                    : 'btn-mini-secondary opacity-30 grayscale cursor-not-allowed'
                  }
              `}
                title={
                  scanInProgress
                    ? 'A scan is already in progress'
                    : !isValidUrl()
                      ? 'Please enter a valid target URL'
                      : 'Start security scan'
                }
              >
                {scanInProgress ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white mr-2" />
                    Scanning
                  </>
                ) : (
                  <>
                    <TerminalIcon className="h-3.5 w-3.5 mr-2" />
                    Start Scan
                  </>
                )}
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
        />
      </div>
    </div>
  );
};
