// components/cli/ScanConfigForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsProvider.tsx';

/**
 * ScanConfig mirrors the CLI API's CreateScanRequest exactly.
 * See: openapi.json → POST /api/scans → requestBody
 */
export interface ScanConfig {
  target_url: string;
  scan_type: string;        // full | hunter | manager | agent name
  safe_mode: boolean | null; // null = use global setting
  max_depth: number;
  max_urls: number;
  resume: boolean;
  use_vertical: boolean;
  focused_agents: string[];
  param: string;            // empty string = not set
}

interface ScanConfigFormProps {
  config: ScanConfig;
  onChange: (config: ScanConfig) => void;
  disabled?: boolean;
  actionButton?: React.ReactNode;
  activeScan?: { id: number; target_url: string; status: string } | null;
}

export const ScanConfigForm: React.FC<ScanConfigFormProps> = ({
  config,
  onChange,
  disabled = false,
  actionButton,
  activeScan,
}) => {
  const [urlError, setUrlError] = useState<string>('');
  const [providerInfo, setProviderInfo] = useState<{ provider: string; name: string; api_key_configured: boolean } | null>(null);
  const { cliUrl } = useSettings();

  useEffect(() => {
    if (!cliUrl) return;
    fetch(`${cliUrl}/api/provider`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setProviderInfo)
      .catch(() => setProviderInfo(null));
  }, [cliUrl]);

  const handleUrlChange = (value: string) => {
    if (value && value.trim() !== '') {
      try {
        new URL(value);
        setUrlError('');
      } catch {
        setUrlError('Invalid URL format');
      }
    } else {
      setUrlError('');
    }
    onChange({ ...config, target_url: value });
  };

  const handleNumberChange = (field: 'max_depth' | 'max_urls', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    const limits = { max_depth: { min: 1, max: 10 }, max_urls: { min: 1, max: 5000 } };
    const clamped = Math.min(Math.max(numValue, limits[field].min), limits[field].max);
    onChange({ ...config, [field]: clamped });
  };


  return (
    <div className="space-y-2">
      {/* Compact inline form - all fields in one row */}
      <div className="flex items-end gap-3">
        {/* Target URL - takes most space */}
        <div className="flex-1 min-w-0">
          <label htmlFor="target-url" className="label-mini block mb-1 ml-1">
            Target URL
          </label>
          {activeScan ? (
            <div className="input-premium font-mono text-xs h-8 flex items-center gap-2 border-coral/30 text-coral bg-coral/5 px-3">
              <div className="h-1.5 w-1.5 rounded-full bg-coral animate-pulse flex-shrink-0" />
              <span className="font-bold tracking-wider">SCANNING</span>
              <span className="opacity-40">|</span>
              <span className="truncate text-white/90" title={activeScan.target_url}>
                {activeScan.target_url}
              </span>
              <span className="ml-auto opacity-30 font-sans text-[9px]">ID: {activeScan.id}</span>
            </div>
          ) : (
            <input
              id="target-url"
              type="text"
              value={config.target_url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={disabled}
              placeholder="https://example.com"
              data-testid="scan-target-url-input"
              className={`input-premium font-mono text-sm h-8 px-3 w-full ${urlError ? 'border-error animate-shake' : ''}`}
            />
          )}
        </div>

        {/* Active provider badge */}
        {providerInfo && (
          <div className="flex-shrink-0 flex flex-col items-center justify-end">
            <span className="label-mini block mb-1">Provider</span>
            <div className="h-8 px-2.5 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center gap-1.5 cursor-default"
                 title={`Active CLI provider: ${providerInfo.name}`}>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${providerInfo.api_key_configured ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-[11px] text-ui-text-muted whitespace-nowrap">{providerInfo.name}</span>
            </div>
          </div>
        )}

        {/* Max Depth (1-10) */}
        <div className="w-20 flex-shrink-0">
          <label htmlFor="max-depth" className="label-mini block mb-1 ml-1">
            Depth
          </label>
          <input
            id="max-depth"
            type="number"
            min="1"
            max="10"
            value={config.max_depth}
            onChange={(e) => handleNumberChange('max_depth', e.target.value)}
            onBlur={() => { if (config.max_depth < 1) onChange({ ...config, max_depth: 1 }); }}
            disabled={disabled}
            data-testid="scan-config-max-depth"
            className="input-premium font-mono text-center text-sm h-8 w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          />
        </div>

        {/* Max URLs (1-5000) */}
        <div className="w-24 flex-shrink-0">
          <label htmlFor="max-urls" className="label-mini block mb-1 ml-1">
            Max URLs
          </label>
          <input
            id="max-urls"
            type="number"
            min="1"
            max="5000"
            value={config.max_urls}
            onChange={(e) => handleNumberChange('max_urls', e.target.value)}
            onBlur={() => { if (config.max_urls < 1) onChange({ ...config, max_urls: 1 }); }}
            disabled={disabled}
            data-testid="scan-config-max-urls"
            className="input-premium font-mono text-center text-sm h-8 w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          />
        </div>

        {/* Action Button */}
        {actionButton && (
          <div className="flex-shrink-0">
            {actionButton}
          </div>
        )}
      </div>

      {urlError && (
        <p className="text-xs text-error flex items-center gap-1">
          <span>!</span> {urlError}
        </p>
      )}
    </div>
  );
};
