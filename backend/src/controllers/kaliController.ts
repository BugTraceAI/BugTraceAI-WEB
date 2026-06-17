import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const executeKaliCommand = asyncHandler(async (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command) {
    res.status(400).json({ success: false, error: 'Command is required' });
    return;
  }

  // To prevent extremely long delays or interactive prompts hanging the backend
  const timeoutMs = 60000; // 60 seconds

  try {
    // Execute command in the kali-mcp-server docker container
    // Using execFile to avoid host shell injection — command runs inside container's bash
    const { stdout, stderr } = await execFileAsync(
      'docker', ['exec', '-i', 'kali-mcp-server', 'bash', '-c', command],
      { timeout: timeoutMs }
    );
    
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
