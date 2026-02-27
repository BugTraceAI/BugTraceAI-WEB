import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const executeKaliCommand = asyncHandler(async (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command) {
    res.status(400).json({ success: false, error: 'Command is required' });
    return;
  }

  // To prevent extremely long delays or interactive prompts hanging the backend
  const timeoutMs = 60000; // 60 seconds

  try {
    // Escaping single quotes safely for bash -c
    const escapedCmd = command.replace(/'/g, "'\\''");
    
    // Execute command in the kali-mcp-server docker container
    // Using simple bash execution to avoid complex MCP JSON-RPC setup for this quick integration
    const dockerCmd = `docker exec -i kali-mcp-server bash -c '${escapedCmd}'`;
    
    // We wrap it in a timeout because some tools hang
    const { stdout, stderr } = await execAsync(dockerCmd, { timeout: timeoutMs });
    
    // Helper function to truncate strings, keeping head and tail
    const truncateString = (str: string, maxLength: number) => {
      if (str.length <= maxLength) return str;
      const head = str.slice(0, maxLength / 2);
      const tail = str.slice(str.length - (maxLength / 2));
      return `${head}\n... [OUTPUT TRUNCATED BY BUGTRACEAI: OUTPUT TOO LONG] ...\n${tail}`;
    };

    let result = '';
    const MAX_OUTPUT_LENGTH = 4000;
    
    if (stdout.trim()) result += `---- [stdout] ----\n${truncateString(stdout.trim(), MAX_OUTPUT_LENGTH)}\n`;
    if (stderr.trim()) result += `---- [stderr] ----\n${truncateString(stderr.trim(), MAX_OUTPUT_LENGTH)}\n`;
    if (!result) result = "(Command completed with no output)";
    
    sendSuccess(res, {
      success: true,
      result: result
    });
  } catch (error: any) {
    // If there is an exit code or execution error (timeout, command not found, etc.)
    let errorMsg = error.message;
    if (error.stdout) errorMsg += `\n[stdout]\n${error.stdout}`;
    if (error.stderr) errorMsg += `\n[stderr]\n${error.stderr}`;
    if (error.code === 124) errorMsg += `\nError: Command timed out after ${timeoutMs/1000} seconds.`;

    sendSuccess(res, {
      success: false,
      result: `---- [execution error] ----\n${errorMsg}`
    });
  }
});
