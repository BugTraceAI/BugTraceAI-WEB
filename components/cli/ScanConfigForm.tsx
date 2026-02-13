// components/cli/ScanConfigForm.tsx
import React, { useState } from 'react';

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

const SCAN_TYPES = [
  { value: 'full', label: 'Full Scan' },
  { value: 'hunter', label: 'Hunter' },
  { value: 'manager', label: 'Manager' },
];


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
    if (!isNaN(numValue)) {
      onChange({ ...config, [field]: numValue });
    }
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

        {/* Scan Type */}
        <div className="w-32 flex-shrink-0">
          <label htmlFor="scan-type" className="label-mini block mb-1 ml-1 whitespace-nowrap">
            Scan Type
          </label>
          <select
            id="scan-type"
            value={config.scan_type}
            onChange={(e) => onChange({ ...config, scan_type: e.target.value })}
            disabled={disabled}
            data-testid="scan-config-scan-type"
            className="input-premium text-xs h-8 px-2 w-full appearance-none cursor-pointer"
          >
            {SCAN_TYPES.map(t => (
              <option key={t.value} value={t.value} className="bg-purple-deep">{t.label}</option>
            ))}
          </select>
        </div>

        {/* Max Depth */}
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
            disabled={disabled}
            data-testid="scan-config-max-depth"
            className="input-premium font-mono text-center text-sm h-8 w-full"
          />
        </div>

        {/* Max URLs */}
        <div className="w-24 flex-shrink-0">
          <label htmlFor="max-urls" className="label-mini block mb-1 ml-1">
            Max URLs
          </label>
          <input
            id="max-urls"
            type="number"
            min="1"
            max="500"
            value={config.max_urls}
            onChange={(e) => handleNumberChange('max_urls', e.target.value)}
            disabled={disabled}
            data-testid="scan-config-max-urls"
            className="input-premium font-mono text-center text-sm h-8 w-full"
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
