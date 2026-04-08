// components/cli/ScanConfigForm.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import yaml from 'js-yaml';
import { useSettings } from '../../contexts/SettingsProvider.tsx';

/**
 * Auth config structure from YAML file
 */
export interface AuthConfig {
  login_url: string;
  login_type?: string;
  credentials: {
    username: string;
    password: string;
    totp_secret?: string;
  };
  login_flow?: string[];
  success_condition?: {
    type: string;
    value: string;
  };
}

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
  url_list?: string[];      // Pre-defined URL list (from file upload)
  auth?: AuthConfig;        // Auth config from YAML file (TOTP/2FA login)
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
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: 'url-list' | 'swagger'; count: number } | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [swaggerUrlInput, setSwaggerUrlInput] = useState('');
  const [isFetchingSwagger, setIsFetchingSwagger] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authFileInputRef = useRef<HTMLInputElement>(null);
  const { cliUrl, authConfigEnabled } = useSettings();

  // Auth config state
  const [authConfigFile, setAuthConfigFile] = useState<{ name: string; config: AuthConfig } | null>(null);
  const [authConfigError, setAuthConfigError] = useState<string>('');
  const [isAuthDragging, setIsAuthDragging] = useState(false);

  useEffect(() => {
    if (!cliUrl) return;
    fetch(`${cliUrl}/api/provider`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setProviderInfo)
      .catch(() => setProviderInfo(null));
  }, [cliUrl]);

  const getUrlOrigin = useCallback((value: string): string | null => {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  }, []);

  const getUrlHost = useCallback((value: string): string | null => {
    try {
      return new URL(value).host;
    } catch {
      return null;
    }
  }, []);

  // Parse URL list file (one URL per line, comments with #)
  const parseUrlList = useCallback((content: string, targetUrl: string): string[] => {
    const baseUrl = getUrlOrigin(targetUrl);
    const targetHost = getUrlHost(targetUrl);
    if (!baseUrl || !targetHost) return [];

    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .flatMap(url => {
        // If URL is relative, prepend target base URL
        if (url.startsWith('/')) return [`${baseUrl}${url}`];
        // If URL already has protocol, keep only same-host entries
        if (url.startsWith('http://') || url.startsWith('https://')) {
          try {
            return new URL(url).host === targetHost ? [url] : [];
          } catch {
            return [];
          }
        }
        // Otherwise, assume it's a path
        return [`${baseUrl}/${url}`];
      });
  }, [getUrlHost, getUrlOrigin]);

  // Parse Swagger/OpenAPI JSON file
  const parseSwagger = useCallback((content: string, targetUrl: string): string[] => {
    // Remove trailing slash and any swagger.json/openapi.json from target
    let baseUrl = targetUrl.replace(/\/$/, '').replace(/\/(swagger|openapi)\.json$/i, '');
    const urls: string[] = [];
    try {
      const spec = JSON.parse(content);
      const isOpenApi3 = spec.openapi?.startsWith('3.');
      let basePath = '';

      // Get base path from servers (OpenAPI 3.x) or basePath (Swagger 2.0)
      if (isOpenApi3 && spec.servers?.[0]?.url) {
        const serverUrl = spec.servers[0].url.replace(/\/$/, '');
        if (serverUrl.startsWith('http')) {
          // Full URL - use as base, ignore targetUrl
          baseUrl = serverUrl;
        } else if (serverUrl.startsWith('/')) {
          // Relative path - only use if not already in baseUrl
          if (!baseUrl.endsWith(serverUrl)) {
            basePath = serverUrl;
          }
        }
      } else if (spec.basePath) {
        const bp = spec.basePath.replace(/\/$/, '');
        // Only add if not already in baseUrl
        if (!baseUrl.endsWith(bp)) {
          basePath = bp;
        }
      }

      // Process paths
      const paths = spec.paths || {};
      for (const [path, methods] of Object.entries(paths)) {
        if (typeof methods !== 'object') continue;

        // Skip documentation endpoints
        if (path.match(/\/(swagger|openapi|api-docs)(\.json|\.yaml)?$/i)) continue;

        for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

          let url = `${baseUrl}${basePath}${path}`;

          // Replace path parameters with example values
          const params = operation.parameters || [];
          for (const param of params) {
            if (param.in === 'path') {
              const value = param.example || param.default || (param.schema?.type === 'integer' ? '1' : 'test');
              url = url.replace(`{${param.name}}`, String(value));
            }
          }

          // Add query parameters
          const queryParams = params.filter((p: any) => p.in === 'query');
          if (queryParams.length > 0) {
            const qs = queryParams.map((p: any) => {
              const value = p.example || p.default || (p.schema?.type === 'integer' ? '1' : 'test');
              return `${p.name}=${encodeURIComponent(String(value))}`;
            }).join('&');
            url = `${url}?${qs}`;
          }

          urls.push(url);
        }
      }
    } catch (e) {
      console.error('Failed to parse Swagger file:', e);
    }
    return urls;
  }, []);

  // Extract target URL from Swagger spec
  const extractSwaggerTarget = useCallback((spec: any): string | null => {
    try {
      const isOpenApi3 = spec.openapi?.startsWith('3.');

      if (isOpenApi3 && spec.servers?.[0]?.url) {
        const serverUrl = spec.servers[0].url;
        // If it's a full URL, use it (strip trailing slash and swagger.json)
        if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
          return serverUrl.replace(/\/$/, '').replace(/\/(swagger|openapi)\.json$/i, '');
        }
      }

      // Swagger 2.0: host + schemes + basePath
      if (spec.host) {
        const scheme = spec.schemes?.[0] || 'https';
        const basePath = spec.basePath || '';
        return `${scheme}://${spec.host}${basePath}`.replace(/\/$/, '');
      }
    } catch (e) {
      console.error('Failed to extract target from Swagger:', e);
    }
    return null;
  }, []);

  // Extract target URL from first URL in list
  const extractUrlListTarget = useCallback((content: string): string | null => {
    try {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      for (const line of lines) {
        if (line.startsWith('http://') || line.startsWith('https://')) {
          const url = new URL(line);
          return `${url.protocol}//${url.host}`;
        }
      }
    } catch (e) {
      console.error('Failed to extract target from URL list:', e);
    }
    return null;
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setFileError('');

    // Validate file extension
    const isJson = file.name.toLowerCase().endsWith('.json');
    const isTxt = file.name.toLowerCase().endsWith('.txt');
    if (!isJson && !isTxt) {
      setFileError('Invalid file type. Only .txt or .json files allowed.');
      return;
    }

    // Validate MIME type
    const validMimes = [
      'application/json',
      'text/json',
      'text/plain',
      'text/x-log',
      '', // Some browsers don't set MIME for .txt
    ];
    if (file.type && !validMimes.includes(file.type)) {
      setFileError(`Invalid MIME type: ${file.type}. Expected text or JSON.`);
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError('File too large. Maximum 5MB allowed.');
      return;
    }

    try {
      const content = await file.text();

      // Basic content validation - check it's not binary/garbage
      if (/[\x00-\x08\x0E-\x1F]/.test(content.slice(0, 1000))) {
        setFileError('Invalid file content. File appears to be binary.');
        return;
      }

      let urls: string[] = [];
      let autoTargetUrl = config.target_url;

      if (isJson) {
        // Validate JSON structure
        let spec;
        try {
          spec = JSON.parse(content);
        } catch {
          setFileError('Invalid JSON file. Could not parse.');
          return;
        }

        // Validate it looks like Swagger/OpenAPI
        if (!spec.paths && !spec.swagger && !spec.openapi) {
          setFileError('Not a valid Swagger/OpenAPI file. Missing "paths", "swagger", or "openapi" field.');
          return;
        }

        const extractedTarget = extractSwaggerTarget(spec);
        if (extractedTarget && !config.target_url) {
          autoTargetUrl = extractedTarget;
        }

        if (!autoTargetUrl) {
          setFileError('This Swagger file uses relative paths. Set a Target URL first or use a spec with an absolute server URL.');
          return;
        }

        urls = parseSwagger(content, autoTargetUrl);
        if (urls.length === 0) {
          setFileError('No endpoints found in Swagger/OpenAPI file.');
          return;
        }
        setUploadedFile({ name: file.name, type: 'swagger', count: urls.length });
      } else {
        // Validate TXT contains URL-like content
        const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        if (lines.length === 0) {
          setFileError('Empty file or only comments.');
          return;
        }

        // Check at least one line looks like a URL or path
        const hasValidLine = lines.some(l =>
          l.trim().startsWith('http://') ||
          l.trim().startsWith('https://') ||
          l.trim().startsWith('/')
        );
        if (!hasValidLine) {
          setFileError('No valid URLs found. Lines should start with http://, https://, or /');
          return;
        }

        const hasRelativeLine = lines.some(l => {
          const value = l.trim();
          return value.startsWith('/') || (!value.startsWith('http://') && !value.startsWith('https://'));
        });

        const extractedTarget = extractUrlListTarget(content);
        if (extractedTarget && !config.target_url) {
          autoTargetUrl = extractedTarget;
        }

        if (hasRelativeLine && !autoTargetUrl) {
          setFileError('Relative paths require a Target URL first. Set the target and re-import the file.');
          return;
        }

        urls = parseUrlList(content, autoTargetUrl || '');
        if (urls.length === 0) {
          setFileError('No valid URLs found in file for the selected target domain.');
          return;
        }
        setUploadedFile({ name: file.name, type: 'url-list', count: urls.length });
      }

      // Update config with auto-detected target URL, parsed URLs, and auto-set max_urls
      onChange({
        ...config,
        target_url: autoTargetUrl,
        url_list: urls,
        max_urls: urls.length,
      });
    } catch (e) {
      setFileError('Failed to read file. Make sure it\'s valid JSON or text.');
    }
  }, [config, onChange, parseSwagger, parseUrlList, extractSwaggerTarget, extractUrlListTarget]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [disabled, handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const clearUploadedFile = useCallback(() => {
    setUploadedFile(null);
    setFileError('');
    setSwaggerUrlInput('');
    onChange({ ...config, url_list: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [config, onChange]);

  // Fetch Swagger from URL
  const handleSwaggerUrlFetch = useCallback(async () => {
    if (!swaggerUrlInput.trim()) return;

    setFileError('');
    setIsFetchingSwagger(true);

    let url: URL;
    try {
      url = new URL(swaggerUrlInput.trim());
    } catch {
      setFileError('Invalid URL format. Please enter a full URL (e.g. https://api.example.com/swagger.json).');
      setIsFetchingSwagger(false);
      return;
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json') && !contentType.includes('text')) {
        setFileError(`Invalid content type: ${contentType}. Expected JSON.`);
        setIsFetchingSwagger(false);
        return;
      }

      const content = await response.text();

      // Validate JSON
      let spec;
      try {
        spec = JSON.parse(content);
      } catch {
        setFileError('Invalid JSON response. Could not parse.');
        setIsFetchingSwagger(false);
        return;
      }

      // Validate it's a Swagger/OpenAPI spec
      if (!spec.paths && !spec.swagger && !spec.openapi) {
        setFileError('Not a valid Swagger/OpenAPI spec. Missing "paths", "swagger", or "openapi" field.');
        setIsFetchingSwagger(false);
        return;
      }

      // Extract target URL from Swagger
      let autoTargetUrl = config.target_url;
      const extractedTarget = extractSwaggerTarget(spec);
      if (extractedTarget && !config.target_url) {
        autoTargetUrl = extractedTarget;
      }

      const urls = parseSwagger(content, autoTargetUrl || url.origin);
      if (urls.length === 0) {
        setFileError('No endpoints found in Swagger/OpenAPI spec.');
        setIsFetchingSwagger(false);
        return;
      }

      setUploadedFile({ name: swaggerUrlInput.trim(), type: 'swagger', count: urls.length });
      onChange({
        ...config,
        target_url: autoTargetUrl || url.origin,
        url_list: urls,
        max_urls: urls.length,
      });
    } catch (e: any) {
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        setFileError('CORS blocked. Try downloading the file and uploading it instead.');
      } else {
        setFileError(`Failed to fetch Swagger: ${e.message}`);
      }
    } finally {
      setIsFetchingSwagger(false);
    }
  }, [swaggerUrlInput, config, onChange, parseSwagger, extractSwaggerTarget]);

  // Parse and validate auth config YAML
  const parseAuthConfigYaml = useCallback((content: string): AuthConfig | null => {
    try {
      const parsed = yaml.load(content) as any;
      if (!parsed) return null;

      // Extract authentication section (support both root and nested)
      const auth = parsed.authentication || parsed;

      // Validate required fields
      if (!auth.login_url) {
        setAuthConfigError('Missing required field: login_url');
        return null;
      }
      if (!auth.credentials) {
        setAuthConfigError('Missing required field: credentials');
        return null;
      }
      if (!auth.credentials.username && !auth.credentials.email) {
        setAuthConfigError('Missing required field: credentials.username or credentials.email');
        return null;
      }
      if (!auth.credentials.password) {
        setAuthConfigError('Missing required field: credentials.password');
        return null;
      }

      // Build sanitized config
      const authConfig: AuthConfig = {
        login_url: auth.login_url,
        login_type: auth.login_type || 'form',
        credentials: {
          username: auth.credentials.username || auth.credentials.email || '',
          password: auth.credentials.password || '',
          totp_secret: auth.credentials.totp_secret,
        },
        login_flow: auth.login_flow,
        success_condition: auth.success_condition,
      };

      return authConfig;
    } catch (e: any) {
      setAuthConfigError(`Invalid YAML: ${e.message}`);
      return null;
    }
  }, []);

  // Handle auth config file upload
  const handleAuthConfigUpload = useCallback(async (file: File) => {
    setAuthConfigError('');

    // Validate file extension
    const isYaml = file.name.toLowerCase().endsWith('.yaml') || file.name.toLowerCase().endsWith('.yml');
    if (!isYaml) {
      setAuthConfigError('Invalid file type. Only .yaml or .yml files allowed.');
      return;
    }

    // Validate file size (max 100KB)
    if (file.size > 100 * 1024) {
      setAuthConfigError('File too large. Maximum 100KB allowed.');
      return;
    }

    try {
      const content = await file.text();
      const authConfig = parseAuthConfigYaml(content);

      if (authConfig) {
        setAuthConfigFile({ name: file.name, config: authConfig });
        onChange({ ...config, auth: authConfig });
      }
    } catch {
      setAuthConfigError('Failed to read file.');
    }
  }, [config, onChange, parseAuthConfigYaml]);

  // Auth config drag handlers
  const handleAuthDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsAuthDragging(true);
  }, [disabled]);

  const handleAuthDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAuthDragging(false);
  }, []);

  const handleAuthDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAuthDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleAuthConfigUpload(files[0]);
    }
  }, [disabled, handleAuthConfigUpload]);

  const handleAuthFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleAuthConfigUpload(files[0]);
    }
  }, [handleAuthConfigUpload]);

  const clearAuthConfig = useCallback(() => {
    setAuthConfigFile(null);
    setAuthConfigError('');
    onChange({ ...config, auth: undefined });
    if (authFileInputRef.current) authFileInputRef.current.value = '';
  }, [config, onChange]);

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

    if (uploadedFile && value !== config.target_url) {
      setUploadedFile(null);
      setFileError('Imported URLs were cleared because the target changed. Re-import the file to rebuild the list.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onChange({ ...config, target_url: value, url_list: undefined });
      return;
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
            <div>
              <input
                id="target-url"
                type="text"
                value={config.target_url}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={disabled || uploadedFile !== null}
                placeholder="https://example.com"
                data-testid="scan-target-url-input"
                className={`input-premium font-mono text-sm h-8 px-3 w-full disabled:opacity-50 disabled:cursor-not-allowed ${urlError ? 'border-error animate-shake' : ''}`}
                title={uploadedFile ? 'Clear imported URLs first to change target' : ''}
              />
            </div>
          )}
        </div>

        {/* Import URLs button (compact) */}
        {!activeScan && (
          <div className="flex-shrink-0 relative">
            <label className="label-mini block mb-1 ml-1">Import</label>
            {uploadedFile ? (
              <div
                className="h-8 px-2 rounded-md bg-green-500/10 border border-green-500/30 flex items-center gap-1.5 cursor-pointer text-[10px]"
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                title={`${uploadedFile.count} URLs from ${uploadedFile.name}`}
              >
                <span className="text-green-400">{uploadedFile.count}</span>
                <span className="text-white/50">URLs</span>
                <button
                  onClick={(e) => { e.stopPropagation(); clearUploadedFile(); }}
                  className="ml-1 text-white/30 hover:text-error"
                >
                  x
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                disabled={disabled}
                className="h-8 px-3 rounded-md bg-white/[0.04] border border-white/[0.08] hover:border-coral/30 hover:bg-coral/5 text-[10px] text-white/60 hover:text-coral transition-all disabled:opacity-50"
                title="Import URLs from file or Swagger"
              >
                + URLs
              </button>
            )}

          </div>
        )}

        {/* Import modal - using Portal to render at body level */}
        {showImportDropdown && !disabled && createPortal(
          <>
            <div className="fixed inset-0 bg-black/50" style={{ zIndex: 9998 }} onClick={() => setShowImportDropdown(false)} />
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-4"
              style={{ zIndex: 9999 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => { handleDrop(e); setShowImportDropdown(false); }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-white/80">Import URLs</span>
                <button onClick={() => setShowImportDropdown(false)} className="text-white/40 hover:text-white">x</button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json"
                onChange={(e) => { handleFileInputChange(e); setShowImportDropdown(false); }}
                className="hidden"
              />

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all mb-3
                  ${isDragging ? 'border-coral bg-coral/10' : 'border-white/20 hover:border-white/30 bg-white/[0.02]'}
                `}
              >
                <div className="text-xs text-white/60">
                  Drop <span className="text-blue-400">.txt</span> or <span className="text-orange-400">.json</span> here
                </div>
                <div className="text-[10px] text-white/40 mt-1">or click to browse</div>
              </div>

              <div className="text-[10px] text-white/30 text-center mb-2">or fetch from URL</div>

              {/* Swagger URL input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={swaggerUrlInput}
                  onChange={(e) => setSwaggerUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleSwaggerUrlFetch(); setShowImportDropdown(false); } }}
                  placeholder="https://api.example.com/swagger.json"
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-2 text-xs text-white/80 placeholder:text-white/30 focus:outline-none focus:border-coral/50"
                />
                <button
                  onClick={() => { handleSwaggerUrlFetch(); setShowImportDropdown(false); }}
                  disabled={isFetchingSwagger || !swaggerUrlInput.trim()}
                  className="px-3 py-2 text-xs bg-coral/20 text-coral rounded hover:bg-coral/30 disabled:opacity-30"
                >
                  {isFetchingSwagger ? '...' : 'Fetch'}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Auth Config YAML upload (when enabled in config) */}
        {authConfigEnabled && !activeScan && (
          <div className="flex-shrink-0 relative">
            <label className="label-mini block mb-1 ml-1">Auth</label>
            <input
              ref={authFileInputRef}
              type="file"
              accept=".yaml,.yml"
              onChange={handleAuthFileInputChange}
              className="hidden"
            />
            {authConfigFile ? (
              <div
                className="h-8 px-2 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center gap-1.5 cursor-pointer text-[10px]"
                title={`Auth config: ${authConfigFile.name} (${authConfigFile.config.credentials.totp_secret ? 'TOTP' : 'Basic'})`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                <span className="text-purple-300 truncate max-w-[60px]">{authConfigFile.name.replace(/\.(yaml|yml)$/i, '')}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); clearAuthConfig(); }}
                  className="ml-1 text-white/30 hover:text-error"
                >
                  x
                </button>
              </div>
            ) : (
              <div
                onClick={() => authFileInputRef.current?.click()}
                onDragOver={handleAuthDragOver}
                onDragLeave={handleAuthDragLeave}
                onDrop={handleAuthDrop}
                className={`h-8 px-3 rounded-md border border-dashed cursor-pointer text-[10px] flex items-center justify-center transition-all ${
                  isAuthDragging
                    ? 'border-purple-400 bg-purple-500/10 text-purple-300'
                    : 'border-white/[0.15] bg-white/[0.02] text-white/40 hover:border-purple-400/50 hover:text-purple-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Drop auth-config.yaml for authenticated scanning with TOTP"
              >
                + YAML
              </div>
            )}
          </div>
        )}

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

      {fileError && (
        <p className="text-xs text-error flex items-center gap-1">
          <span>!</span> {fileError}
        </p>
      )}

      {authConfigError && (
        <p className="text-xs text-error flex items-center gap-1">
          <span>!</span> {authConfigError}
        </p>
      )}
    </div>
  );
};
