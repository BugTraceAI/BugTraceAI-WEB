import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Shell-escape a string for use inside single-quoted bash -c arguments */
function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

/** Validate a URL is safe for command use (no shell metacharacters) */
function validateSafeUrl(url: string): boolean {
  return /^https?:\/\/[^\s;|&`$(){}]+$/.test(url);
}

/** Run a command inside a Docker container safely via execFile */
async function dockerExec(container: string, cmd: string, timeout = 60000): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('docker', ['exec', '-i', container, 'bash', '-c', cmd], { timeout });
}

// Scan tracking for async operations
const activeScans: Map<number, any> = new Map();
const SCAN_TTL_MS = 3600000; // 1 hour — auto-cleanup completed scans
let scanCounter = 0;

/**
 * Execute BugTraceAI-CLI MCP tool commands
 * This controller interfaces with the bugtrace-cli-mcp container
 */
export const executeBugTraceCommand = asyncHandler(async (req: Request, res: Response) => {
  const { tool, args } = req.body;
  
  if (!tool) {
    res.status(400).json({ success: false, error: 'Tool name is required' });
    return;
  }

  try {
    let result: any;
    
    switch (tool) {
      case 'start_scan':
        result = await handleStartScan(args);
        break;
      case 'get_scan_status':
        result = await handleGetScanStatus(args);
        break;
      case 'query_findings':
        result = await handleQueryFindings(args);
        break;
      case 'stop_scan':
        result = await handleStopScan(args);
        break;
      case 'export_report':
        result = await handleExportReport(args);
        break;
      default:
        result = { error: `Unknown tool: ${tool}` };
    }
    
    sendSuccess(res, {
      success: !result.error,
      result: result
    });
  } catch (error: any) {
    sendSuccess(res, {
      success: false,
      result: { error: error.message }
    });
  }
});

/**
 * Start a new security scan
 */
async function handleStartScan(args: { 
  target_url: string; 
  scan_type?: string; 
  max_depth?: number; 
  max_urls?: number 
}) {
  const { target_url, scan_type = 'full', max_depth = 2, max_urls = 20 } = args;
  
  if (!target_url) {
    return { error: 'target_url is required' };
  }

  // Validate URL format and safety
  try {
    new URL(target_url);
  } catch {
    return { error: 'Invalid URL format. Must be a valid HTTP/HTTPS URL.' };
  }
  if (!validateSafeUrl(target_url)) {
    return { error: 'URL contains invalid characters.' };
  }

  // Validate numeric params
  const safeDepth = Math.max(1, Math.min(10, Number(max_depth) || 2));
  const safeMaxUrls = Math.max(1, Math.min(500, Number(max_urls) || 20));
  const safeType = ['full', 'hunter', 'manager'].includes(scan_type) ? scan_type : 'full';

  scanCounter++;
  const scanId = scanCounter;

  // Build bugtrace CLI command with escaped inputs
  const cmd = `bugtrace scan '${shellEscape(target_url)}' --type ${safeType} --depth ${safeDepth} --max-urls ${safeMaxUrls} --json`;
  
  // Track the scan
  activeScans.set(scanId, {
    id: scanId,
    target_url,
    scan_type,
    status: 'starting',
    command: cmd,
    startedAt: new Date().toISOString()
  });
  
  // Start the scan in background
  executeBackgroundScan(scanId, cmd);
  
  return {
    scan_id: scanId,
    status: 'created',
    target_url,
    scan_type,
    message: `Security scan started for ${target_url}`
  };
}

/**
 * Get scan status
 */
async function handleGetScanStatus(args: { scan_id: number }) {
  const { scan_id } = args;
  
  const scan = activeScans.get(scan_id);
  
  if (!scan) {
    return { error: `Scan ${scan_id} not found` };
  }
  
  return {
    scan_id: scan.id,
    target_url: scan.target_url,
    scan_type: scan.scan_type,
    status: scan.status,
    progress: scan.progress || 0,
    started_at: scan.startedAt,
    completed_at: scan.completedAt,
    findings_count: scan.findings_count,
    error: scan.error
  };
}

/**
 * Query findings from a scan
 */
async function handleQueryFindings(args: { 
  scan_id: number; 
  severity?: string; 
  limit?: number 
}) {
  const { scan_id, severity, limit = 20 } = args;
  
  const scan = activeScans.get(scan_id);
  
  if (!scan) {
    return { error: `Scan ${scan_id} not found` };
  }
  
  if (scan.status !== 'completed') {
    return { 
      error: `Scan ${scan_id} is not completed yet (status: ${scan.status})`,
      scan_status: scan.status
    };
  }
  
  try {
    // Shell command to read findings.json
    const cmd = `cat '${shellEscape(scan.output_dir)}/findings.json' 2>/dev/null || echo "[]"`;
    const { stdout } = await dockerExec('bugtrace-cli-mcp', cmd, 30000);
    
    let findings = JSON.parse(stdout);
    
    if (severity) {
      findings = findings.filter((f: any) => f.severity.toLowerCase() === severity.toLowerCase());
    }
    
    return {
      scan_id,
      target_url: scan.target_url,
      findings: findings.slice(0, limit),
      total: findings.length
    };
  } catch (error: any) {
    return { error: 'Failed to query findings', details: error.message };
  }
}

/**
 * Stop a running scan
 */
async function handleStopScan(args: { scan_id: number }) {
  const { scan_id } = args;
  const scan = activeScans.get(scan_id);
  
  if (!scan) return { error: `Scan ${scan_id} not found` };
  
  const killCmd = `pkill -f 'bugtrace scan' 2>/dev/null || true`;
  await dockerExec('bugtrace-cli-mcp', killCmd, 5000);
  
  scan.status = 'stopped';
  return { scan_id, status: 'stopped' };
}

/**
 * Export report
 */
async function handleExportReport(args: { scan_id: number; section?: string }) {
  const { scan_id, section = 'summary' } = args;
  const scan = activeScans.get(scan_id);
  
  if (!scan) return { error: `Scan ${scan_id} not found` };
  
  const cmd = `cat '${shellEscape(scan.output_dir)}/final_report.md' 2>/dev/null || echo "Report not found"`;
  const { stdout } = await dockerExec('bugtrace-cli-mcp', cmd, 30000);
  return { scan_id, section, report: stdout.substring(0, 5000) };
}

/**
 * Background scan execution
 */
async function executeBackgroundScan(scanId: number, cmd: string) {
  const scan = activeScans.get(scanId);
  if (!scan) return;
  
  try {
    scan.status = 'running';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = `/app/scans/scan_${scanId}_${timestamp}`;
    scan.output_dir = outputDir;
    
    const fullCmd = `mkdir -p '${shellEscape(outputDir)}' && ${cmd} --output '${shellEscape(outputDir)}'`;
    await dockerExec('bugtrace-cli-mcp', fullCmd, 600000);
    scan.status = 'completed';
    scan.completedAt = new Date().toISOString();
    // Auto-cleanup after TTL to prevent memory leak
    setTimeout(() => activeScans.delete(scanId), SCAN_TTL_MS);
  } catch (error: any) {
    scan.status = 'failed';
    scan.error = error.message;
    scan.completedAt = new Date().toISOString();
    setTimeout(() => activeScans.delete(scanId), SCAN_TTL_MS);
  }
}
