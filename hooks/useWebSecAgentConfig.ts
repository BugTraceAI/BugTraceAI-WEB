// hooks/useWebSecAgentConfig.ts

// Agent Configurations
export const KALI_SYSTEM_PROMPT = `You are a Kali Linux Expert Security Agent operating via BugTraceAI. 
You have access to a fully containerized Kali Linux environment through the \`run_kali_command\` tool.
When the user asks you to perform an action (like a scan, reconnaissance, or exploitation), you MUST use the \`run_kali_command\` tool to run the appropriate terminal commands (e.g., nmap, subfinder, sqlmap).
Always explain what you are going to run before running it, and interpret the results concisely. Use markdown for all terminal output.`;

export const KALI_TOOLS = [
  {
    type: "function",
    function: {
      name: "run_kali_command",
      description: "Execute a command in the containerized Kali Linux environment. Use this to run security tools like nmap, ffuf, nuclei, sqlmap, etc.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The bash command to execute." }
        },
        required: ["command"]
      }
    }
  }
];

export const RECON_SYSTEM_PROMPT = `You are a ReconFTW Automation Agent operating via BugTraceAI.
You have access to a specialized reconnaissance container running ReconFTW.
You have tools to start full scans, passive recons, subdomain enumeration, and more.
Always explains your methodology and provide summaries of discovered endpoints and findings.
Most scans run in the background - you should check status occasionally if the user asks.`;

export const RECON_TOOLS = [
  {
    type: "function",
    function: {
      name: "start_recon",
      description: "Start a full reconnaissance scan. Mode can be: full, passive, subdomains, vulns, osint, webs, hosts.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Target domain (e.g., target.com)" },
          mode: { type: "string", enum: ["full", "passive", "subdomains", "vulns", "osint", "webs", "hosts"] },
          deep_scan: { type: "boolean", description: "Enable deep scanning mode" }
        },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "quick_recon",
      description: "Fast passive reconnaissance on a target.",
      parameters: {
        type: "object",
        properties: { target: { type: "string" } },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_scan_status",
      description: "Check the status of an active or past scan.",
      parameters: {
        type: "object",
        properties: { scan_id: { type: "number" } },
        required: ["scan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_results",
      description: "List available scan results in the output directory.",
      parameters: {
        type: "object",
        properties: { target: { type: "string", description: "Optional filter by target name" } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_findings",
      description: "Retrieve specific findings (subdomains, vulns, etc.) from a completed scan.",
      parameters: {
        type: "object",
        properties: {
          scan_id: { type: "number" },
          finding_type: { type: "string", enum: ["all", "subdomains", "webs", "vulnerabilities", "urls", "emails"] },
          limit: { type: "number" }
        },
        required: ["scan_id"]
      }
    }
  }
];

export const BUGTRACE_SYSTEM_PROMPT = `You are a BugTraceAI Security Expert Agent with access to advanced vulnerability scanning.
You have access to the BugTraceAI-CLI scanning framework through specialized tools.
Always explain what you're scanning and interpret the results professionally.
Provide actionable remediation advice for any vulnerabilities found.`;

export const BUGTRACE_TOOLS = [
  {
    type: "function",
    function: {
      name: "start_scan",
      description: "Start a new security scan on a target URL.",
      parameters: {
        type: "object",
        properties: {
          target_url: { type: "string" },
          scan_type: { type: "string", enum: ["full", "hunter", "manager"] },
          max_depth: { type: "integer" },
          max_urls: { type: "integer" }
        },
        required: ["target_url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_scan_status",
      description: "Get the current status and progress of a scan.",
      parameters: {
        type: "object",
        properties: { scan_id: { type: "number" } },
        required: ["scan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_findings",
      description: "Query vulnerability findings from a scan.",
      parameters: {
        type: "object",
        properties: {
          scan_id: { type: "number" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
          limit: { type: "integer" }
        },
        required: ["scan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_report",
      description: "Export a scan report summary or full details.",
      parameters: {
        type: "object",
        properties: {
          scan_id: { type: "number" },
          section: { type: "string", enum: ["summary", "critical", "full"] }
        },
        required: ["scan_id"]
      }
    }
  }
];
