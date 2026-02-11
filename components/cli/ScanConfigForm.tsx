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
          <label htmlFor="target-url" className="card-label block text-[10px] uppercase tracking-wider mb-0.5">
            Target URL
          </label>
          {activeScan ? (
            <div className="input-modern font-mono text-xs h-8 flex items-center gap-2 bg-coral/10 border-coral/30 text-coral shadow-[0_0_10px_rgba(255,107,107,0.1)] px-3">
              <div className="h-1.5 w-1.5 rounded-full bg-coral animate-pulse flex-shrink-0" />
              <span className="font-bold tracking-wider">SCANNING</span>
              <span className="opacity-40">|</span>
              <span className="truncate text-white/90" title={activeScan.target_url}>
                {activeScan.target_url}
              </span>
              <span className="ml-auto opacity-50 font-sans text-[10px]">ID: {activeScan.id}</span>
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
              className={`input-modern font-mono text-sm h-8 ${urlError ? 'border-error focus:border-error' : ''}`}
            />
          )}
        </div>

        {/* Scan Type */}
        <div className="w-32 flex-shrink-0">
          <label htmlFor="scan-type" className="card-label block text-[10px] uppercase tracking-wider mb-0.5 whitespace-nowrap">
            Scan Type
          </label>
          <select
            id="scan-type"
            value={config.scan_type}
            onChange={(e) => onChange({ ...config, scan_type: e.target.value })}
            disabled={disabled}
            data-testid="scan-config-scan-type"
            className="input-modern text-sm h-8 !py-1"
          >
            {SCAN_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Max Depth */}
        <div className="w-16 flex-shrink-0">
          <label htmlFor="max-depth" className="card-label block text-[10px] uppercase tracking-wider mb-0.5">
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
            className="input-modern font-mono text-sm h-8"
          />
        </div>

        {/* Max URLs */}
        <div className="w-16 flex-shrink-0">
          <label htmlFor="max-urls" className="card-label block text-[10px] uppercase tracking-wider mb-0.5">
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
            className="input-modern font-mono text-sm h-8"
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
