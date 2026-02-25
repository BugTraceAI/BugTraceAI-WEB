// components/settings/SystemStatusTab.tsx
// CLI/backend health checks, database stats
import React, { useState } from 'react';
import { Spinner } from '../Spinner.tsx';
import {
  testCliConnection,
  testBackendConnection,
  type CliConnectionResult,
  type BackendHealthResult,
} from '../../services/cliConnector.ts';

interface SystemStatusTabProps {
  cliUrl: string;
  setCliUrl: (url: string) => void;
  cliConnected: boolean;
  setCli: (cli: { connected: boolean; status: string; version?: string; dockerAvailable?: boolean }) => void;
}

export const SystemStatusTab: React.FC<SystemStatusTabProps> = ({
  cliUrl, setCliUrl, cliConnected, setCli,
}) => {
  const [isTestingBackend, setIsTestingBackend] = useState(false);
  const [isTestingCli, setIsTestingCli] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendHealthResult | null>(null);
  const [cliStatus, setCliStatus] = useState<CliConnectionResult | null>(null);
  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '5432',
    database: 'bugtraceai_web',
    user: 'bugtraceai',
  });

  const handleTestBackend = async () => {
    setIsTestingBackend(true);
    try {
      const result = await testBackendConnection();
      setBackendStatus(result);
      if (result.database.host) {
        setDbConfig({
          host: result.database.host,
          port: result.database.port || '5432',
          database: result.database.database || 'bugtraceai_web',
          user: result.database.user || 'bugtraceai',
        });
      }
    } catch {
      setBackendStatus({
        connected: false,
        status: 'unreachable',
        database: { connected: false },
        error: 'Unexpected error',
      });
    } finally {
      setIsTestingBackend(false);
    }
  };

  const handleTestCli = async () => {
    setIsTestingCli(true);
    try {
      const result = await testCliConnection(cliUrl);
      setCliStatus(result);
      if (result.connected) {
        setCli({
          connected: true,
          status: result.status,
          version: result.version,
          dockerAvailable: result.dockerAvailable,
        });
      } else {
        setCli({
          connected: false,
          status: result.status,
          version: undefined,
          dockerAvailable: undefined,
        });
      }
    } catch {
      setCliStatus({
        connected: false,
        status: 'unreachable',
        error: 'Unexpected error',
      });
      setCli({ connected: false, status: 'unreachable', version: undefined, dockerAvailable: undefined });
    } finally {
      setIsTestingCli(false);
    }
  };

  const handleTestAll = async () => {
    await Promise.all([handleTestBackend(), handleTestCli()]);
  };

  return (
    <div className="space-y-4">
      {/* Test All Button */}
      <button
        onClick={handleTestAll}
        disabled={isTestingBackend || isTestingCli}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-coral bg-coral/20 border border-coral/40 rounded-lg hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {(isTestingBackend || isTestingCli) ? <Spinner /> : 'Test All Connections'}
      </button>

      {/* Backend Section */}
      <div className="p-3 rounded-lg border border-purple-light/50 bg-purple-deep/30 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-off-white">WEB Backend</p>
          <button
            onClick={handleTestBackend}
            disabled={isTestingBackend}
            className="px-3 py-1 text-xs font-medium text-coral bg-coral/20 border border-coral/30 rounded hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            {isTestingBackend ? <Spinner /> : 'Test'}
          </button>
        </div>

        {backendStatus && (
          <div className={`p-2 rounded border ${backendStatus.connected
            ? 'bg-green-900/20 border-green-500/30'
            : 'bg-red-900/20 border-red-500/30'
            }`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-purple-gray">Status</p>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${backendStatus.connected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
                }`}>
                {backendStatus.connected ? 'Online' : 'Offline'}
              </span>
            </div>
            {backendStatus.connected ? (
              <div className="text-xs text-purple-gray mt-1 flex gap-4">
                <span>Env: <span className="text-off-white">{backendStatus.environment}</span></span>
                <span>Uptime: <span className="text-off-white">{Math.floor(backendStatus.uptime || 0)}s</span></span>
                <span>Latency: <span className="text-off-white">{backendStatus.latencyMs}ms</span></span>
              </div>
            ) : (
              <p className="text-xs text-red-300 mt-1">{backendStatus.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Database Section */}
      <div className="p-3 rounded-lg border border-purple-light/50 bg-purple-deep/30 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-off-white">PostgreSQL Database</p>
          {backendStatus?.database && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${backendStatus.database.connected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
              }`}>
              {backendStatus.database.connected ? 'Connected' : 'Disconnected'}
            </span>
          )}
        </div>

        {/* Database Config Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted mb-1">Host</label>
            <input
              type="text"
              value={dbConfig.host}
              onChange={(e) => setDbConfig(prev => ({ ...prev, host: e.target.value }))}
              placeholder="localhost"
              className="w-full text-xs input-premium px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Port</label>
            <input
              type="text"
              value={dbConfig.port}
              onChange={(e) => setDbConfig(prev => ({ ...prev, port: e.target.value }))}
              placeholder="5432"
              className="w-full text-xs input-premium px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Database</label>
            <input
              type="text"
              value={dbConfig.database}
              onChange={(e) => setDbConfig(prev => ({ ...prev, database: e.target.value }))}
              placeholder="bugtraceai_web"
              className="w-full text-xs input-premium px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">User</label>
            <input
              type="text"
              value={dbConfig.user}
              onChange={(e) => setDbConfig(prev => ({ ...prev, user: e.target.value }))}
              placeholder="bugtraceai"
              className="w-full text-xs input-premium px-2 py-1"
            />
          </div>
        </div>


        {/* Database Stats */}
        {backendStatus?.database?.connected && backendStatus.database.stats && (
          <div className="p-2 rounded border bg-green-900/20 border-green-500/30">
            <p className="text-xs font-medium text-purple-gray mb-1">Statistics</p>
            <div className="text-xs text-purple-gray grid grid-cols-2 gap-x-4">
              <span>Sessions: <span className="text-off-white">{backendStatus.database.stats.chatSessions}</span></span>
              <span>Messages: <span className="text-off-white">{backendStatus.database.stats.chatMessages}</span></span>
              <span>Reports: <span className="text-off-white">{backendStatus.database.stats.analysisReports}</span></span>
              <span>CLI Reports: <span className="text-off-white">{backendStatus.database.stats.cliReports}</span></span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted">
          Database config is set via backend .env file. Changes here are for reference only.
        </p>
      </div>

      {/* CLI Section */}
      <div className="p-3 rounded-lg border border-purple-light/50 bg-purple-deep/30 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-off-white">BugTraceAI CLI</p>
          <button
            onClick={handleTestCli}
            disabled={isTestingCli || !cliUrl}
            className="px-3 py-1 text-xs font-medium text-coral bg-coral/20 border border-coral/30 rounded hover:bg-coral/30 disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            {isTestingCli ? <Spinner /> : 'Test'}
          </button>
        </div>

        {/* CLI URL Input */}
        <div>
          <label htmlFor="cliUrl" className="block text-xs text-muted mb-1">
            CLI API URL
          </label>
          <input
            id="cliUrl"
            type="url"
            value={cliUrl}
            onChange={(e) => {
              setCliUrl(e.target.value);
              setCliStatus(null);
            }}
            placeholder="http://localhost:8000"
            className="w-full text-sm input-premium px-3 py-1.5"
          />
        </div>

        {cliStatus && (
          <div className={`p-2 rounded border ${cliStatus.connected
            ? 'bg-green-900/20 border-green-500/30'
            : 'bg-yellow-900/20 border-yellow-500/30'
            }`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-purple-gray">Status</p>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${cliStatus.connected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                {cliStatus.connected ? 'Connected' : 'Not Available'}
              </span>
            </div>
            {cliStatus.connected ? (
              <div className="text-xs text-purple-gray mt-1 space-y-1">
                <div className="flex gap-4">
                  <span>Version: <span className="text-off-white">{cliStatus.version}</span></span>
                  <span>Latency: <span className="text-off-white">{cliStatus.latencyMs}ms</span></span>
                </div>
                <div className="flex gap-4">
                  <span>Docker: <span className={cliStatus.dockerAvailable ? 'text-green-400' : 'text-yellow-400'}>
                    {cliStatus.dockerAvailable ? 'Available' : 'Not Available'}
                  </span></span>
                  <span>Active Scans: <span className="text-off-white">{cliStatus.activeScans || 0}</span></span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-yellow-300 mt-1">
                {cliStatus.error || 'CLI not running. Vulnerability scanning features disabled.'}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted">
          The CLI is optional and enables vulnerability scanning. When connected, you'll see a red pulse on the logo.
        </p>
      </div>
    </div>
  );
};
