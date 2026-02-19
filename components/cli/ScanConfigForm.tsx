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
    if (isNaN(numValue)) return;
    const limits = { max_depth: { min: 1, max: 10 }, max_urls: { min: 1, max: 5000 } };
    const clamped = Math.min(Math.max(numValue, limits[field].min), limits[field].max);
    onChange({ ...config, [field]: clamped });
  };


  return (
    <div className="space-y-2">
      {/* Row 1: Target URL (full width on mobile) */}
      <div>
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

      {/* Row 2: Depth + Max URLs + Action Button */}
      <div className="flex items-end gap-3">
        {/* Max Depth (1-10) with +/- buttons */}
        <div className="flex-1 sm:flex-none sm:w-32">
          <label htmlFor="max-depth" className="label-mini block mb-1 ml-1">
            Depth
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNumberChange('max_depth', String(config.max_depth - 1))}
              disabled={disabled || config.max_depth <= 1}
              className="input-premium h-8 w-8 flex items-center justify-center text-sm font-bold shrink-0 disabled:opacity-30"
            >−</button>
            <input
              id="max-depth"
              type="number"
              inputMode="numeric"
              min="1"
              max="10"
              value={config.max_depth}
              onChange={(e) => handleNumberChange('max_depth', e.target.value)}
              onBlur={() => { if (config.max_depth < 1) onChange({ ...config, max_depth: 1 }); }}
              disabled={disabled}
              data-testid="scan-config-max-depth"
              className="input-premium font-mono text-center text-sm h-8 w-full min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
            <button
              type="button"
              onClick={() => handleNumberChange('max_depth', String(config.max_depth + 1))}
              disabled={disabled || config.max_depth >= 10}
              className="input-premium h-8 w-8 flex items-center justify-center text-sm font-bold shrink-0 disabled:opacity-30"
            >+</button>
          </div>
        </div>

        {/* Max URLs (1-5000) with +/- buttons */}
        <div className="flex-1 sm:flex-none sm:w-40">
          <label htmlFor="max-urls" className="label-mini block mb-1 ml-1">
            Max URLs
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNumberChange('max_urls', String(Math.max(1, config.max_urls - 10)))}
              disabled={disabled || config.max_urls <= 1}
              className="input-premium h-8 w-8 flex items-center justify-center text-sm font-bold shrink-0 disabled:opacity-30"
            >−</button>
            <input
              id="max-urls"
              type="number"
              inputMode="numeric"
              min="1"
              max="5000"
              value={config.max_urls}
              onChange={(e) => handleNumberChange('max_urls', e.target.value)}
              onBlur={() => { if (config.max_urls < 1) onChange({ ...config, max_urls: 1 }); }}
              disabled={disabled}
              data-testid="scan-config-max-urls"
              className="input-premium font-mono text-center text-sm h-8 w-full min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
            <button
              type="button"
              onClick={() => handleNumberChange('max_urls', String(config.max_urls + 10))}
              disabled={disabled || config.max_urls >= 5000}
              className="input-premium h-8 w-8 flex items-center justify-center text-sm font-bold shrink-0 disabled:opacity-30"
            >+</button>
          </div>
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
