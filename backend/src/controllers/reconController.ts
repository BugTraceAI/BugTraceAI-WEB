import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Scan tracking for async operations
const activeScans: Map<number, any> = new Map();
let scanCounter = 0;

/**
 * Execute reconFTW MCP tool commands
 * This controller interfaces with the reconftw-mcp container
 */
export const executeReconCommand = asyncHandler(async (req: Request, res: Response) => {
  const { tool, args } = req.body;
  
  if (!tool) {
    res.status(400).json({ success: false, error: 'Tool name is required' });
    return;
  }

  try {
    let result: any;
    
    switch (tool) {
      case 'start_recon':
        result = await handleStartRecon(args);
        break;
      case 'quick_recon':
        result = await handleQuickRecon(args);
        break;
      case 'subdomain_enum':
        result = await handleSubdomainEnum(args);
        break;
      case 'vulnerability_scan':
        result = await handleVulnerabilityScan(args);
        break;
      case 'osint_scan':
        result = await handleOsintScan(args);
        break;
      case 'get_scan_status':
        result = await handleGetScanStatus(args);
        break;
      case 'list_results':
        result = await handleListResults(args);
        break;
      case 'get_findings':
        result = await handleGetFindings(args);
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
 * Start a new full reconnaissance scan
 */
async function handleStartRecon(args: { target: string; mode?: string; deep_scan?: boolean }) {
  const { target, mode = 'full', deep_scan = false } = args;
  
  if (!target) {
    return { error: 'target is required' };
  }
  
  scanCounter++;
  const scanId = scanCounter;
  
  const flags = deep_scan ? '-a' : '-r';
  const cmd = `./reconftw.sh -d ${target} ${flags}`;
  
  activeScans.set(scanId, {
    id: scanId,
    target,
    mode,
    status: 'starting',
    command: cmd,
    startedAt: new Date().toISOString()
  });
  
  executeBackgroundRecon(scanId, cmd);
  
  return {
    scan_id: scanId,
    status: 'created',
    target,
    message: `ReconFTW scan started for ${target}`
  };
}

/**
 * Quick passive reconnaissance
 */
async function handleQuickRecon(args: { target: string }) {
  const { target } = args;
  if (!target) return { error: 'target is required' };
  
  const cmd = `./reconftw.sh -d ${target} -r -p`; // passive
  const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
  
  const { stdout } = await execAsync(dockerCmd, { timeout: 60000 });
  return { result: stdout };
}

/**
 * Subdomain enumeration only
 */
async function handleSubdomainEnum(args: { target: string }) {
  const { target } = args;
  if (!target) return { error: 'target is required' };
  
  const cmd = `./reconftw.sh -d ${target} -s`;
  const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
  
  const { stdout } = await execAsync(dockerCmd, { timeout: 120000 });
  return { result: stdout };
}

/**
 * Vulnerability scanning
 */
async function handleVulnerabilityScan(args: { target: string }) {
  const { target } = args;
  if (!target) return { error: 'target is required' };
  
  const cmd = `./reconftw.sh -d ${target} -v`;
  const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
  
  const { stdout } = await execAsync(dockerCmd, { timeout: 300000 });
  return { result: stdout };
}

/**
 * OSINT scanning
 */
async function handleOsintScan(args: { target: string }) {
  const { target } = args;
  if (!target) return { error: 'target is required' };
  
  const cmd = `./reconftw.sh -d ${target} -o`;
  const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
  
  const { stdout } = await execAsync(dockerCmd, { timeout: 120000 });
  return { result: stdout };
}

/**
 * Get scan status
 */
async function handleGetScanStatus(args: { scan_id: number }) {
  const { scan_id } = args;
  const scan = activeScans.get(scan_id);
  
  if (!scan) return { error: `Scan ${scan_id} not found` };
  
  return scan;
}

/**
 * List available results
 */
async function handleListResults(args: { target?: string }) {
  const { target } = args;
  const filter = target ? `| grep ${target}` : '';
  const cmd = `ls -R /opt/reconftw/output ${filter} || echo "No results found"`;
  const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
  
  const { stdout } = await execAsync(dockerCmd, { timeout: 10000 });
  return { result: stdout };
}

/**
 * Get findings from a scan
 */
async function handleGetFindings(args: { scan_id: number; finding_type?: string; limit?: number }) {
  const { scan_id, finding_type = 'all', limit = 50 } = args;
  const scan = activeScans.get(scan_id);
  
  if (!scan) return { error: `Scan ${scan_id} not found` };
  
  // Logic to read files from reconftw-mcp output directory
  // Example: cat /opt/reconftw/output/domain.com/subdomains.txt
  const target = scan.target;
  let filePath = `/opt/reconftw/output/${target}/`;
  
  switch (finding_type) {
    case 'subdomains': filePath += 'subdomains/subdomains.txt'; break;
    case 'webs': filePath += 'webs/webs.txt'; break;
    case 'vulnerabilities': filePath += 'vulns/nuclei_output.txt'; break;
    default: filePath += 'subdomains/subdomains.txt';
  }
  
  const cmd = `cat ${filePath} 2>/dev/null | head -n ${limit} || echo "No findings found for ${finding_type}"`;
  const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
  
  const { stdout } = await execAsync(dockerCmd, { timeout: 30000 });
  return {
    scan_id,
    target,
    finding_type,
    result: stdout
  };
}

/**
 * Execute a recon scan in the background
 */
async function executeBackgroundRecon(scanId: number, cmd: string) {
  const scan = activeScans.get(scanId);
  if (!scan) return;
  
  try {
    scan.status = 'running';
    const dockerCmd = `docker exec -i reconftw-mcp bash -c '${cmd}'`;
    await execAsync(dockerCmd, { timeout: 3600000 }); // 1 hour timeout
    scan.status = 'completed';
    scan.completedAt = new Date().toISOString();
  } catch (error: any) {
    scan.status = 'failed';
    scan.error = error.message;
    scan.completedAt = new Date().toISOString();
  }
}
