// hooks/useReconSecAgent.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, Vulnerability } from '../types.ts';
import { callOpenRouterChatWithTools } from '../services/apiClient.ts';
import { useApiOptions } from './useApiOptions.ts';

const RECON_SYSTEM_PROMPT = `You are a ReconFTW Expert Security Agent operating via BugTraceAI. 
You have access to the powerful reconFTW framework through the following tools:

- \`start_recon\`: Start a full reconnaissance scan (subdomains, vulns, OSINT)
- \`quick_recon\`: Fast passive reconnaissance only
- \`subdomain_enum\`: Enumerate subdomains for a target
- \`vulnerability_scan\`: Scan for web vulnerabilities (XSS, SQLi, SSRF, etc.)
- \`osint_scan\`: Gather OSINT (emails, leaks, GitHub secrets)
- \`get_scan_status\`: Check the status of a running scan
- \`list_results\`: List all available scan results
- \`get_findings\`: Get findings from a completed scan

When the user asks you to perform reconnaissance, use the appropriate tool.
Always explain what you are going to do before running a scan.
Scan results may take time - inform the user and use get_scan_status to check progress.
Use markdown formatting for all output.`;

const RECON_TOOLS = [
  {
    type: "function",
    function: {
      name: "start_recon",
      description: "Start a comprehensive reconnaissance scan on a target domain. Includes subdomain enumeration, vulnerability scanning, and OSINT gathering.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target domain (e.g., 'example.com') or IP/CIDR range"
          },
          mode: {
            type: "string",
            enum: ["full", "passive", "subdomains", "vulns", "osint", "webs", "hosts"],
            description: "Scan mode: full (default), passive, subdomains, vulns, osint, webs, hosts"
          },
          deep_scan: {
            type: "boolean",
            description: "Enable deep scanning mode (more thorough but slower)"
          }
        },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "quick_recon",
      description: "Perform quick passive reconnaissance on a target. Fast scan using only passive sources.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target domain to scan"
          }
        },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "subdomain_enum",
      description: "Enumerate subdomains for a target domain using passive sources, DNS bruteforcing, and permutations.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target domain (e.g., 'example.com')"
          },
          brute_force: {
            type: "boolean",
            description: "Enable DNS bruteforcing (slower but more thorough)"
          }
        },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "vulnerability_scan",
      description: "Scan for web vulnerabilities including XSS, SSRF, SQLi, LFI, SSTI, and more.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target domain or URL"
          }
        },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "osint_scan",
      description: "Gather Open Source Intelligence including emails, credential leaks, GitHub secrets, and cloud storage.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target domain"
          }
        },
        required: ["target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_scan_status",
      description: "Check the status and progress of a running or completed scan.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "integer",
            description: "The ID of the scan to check"
          }
        },
        required: ["scan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_results",
      description: "List all available scan results from previous reconnaissance scans.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Filter by target domain (optional)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_findings",
      description: "Get findings from a completed scan. Can filter by finding type.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "integer",
            description: "The ID of the scan"
          },
          finding_type: {
            type: "string",
            enum: ["all", "subdomains", "webs", "vulnerabilities", "emails", "urls"],
            description: "Type of findings to retrieve (default: all)"
          },
          limit: {
            type: "integer",
            description: "Maximum number of findings to return (default: 50)"
          }
        },
        required: ["scan_id"]
      }
    }
  }
];

export const useReconSecAgent = (onShowApiKeyWarning: () => void) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [apiHistory, setApiHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { apiOptions, isApiKeySet } = useApiOptions();
    const isResponding = useRef(false);

    useEffect(() => {
        const processMessageQueue = async () => {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.role === 'user' && !isResponding.current) {
                isResponding.current = true;
                setIsLoading(true);

                if (!isApiKeySet) {
                    setMessages(prev => [...prev, { role: 'model', content: "Error: API Key is not configured. Please set it in the settings." }]);
                    setIsLoading(false);
                    isResponding.current = false;
                    onShowApiKeyWarning();
                    return;
                }

                try {
                    let currentHistory = [
                        { role: 'system', content: RECON_SYSTEM_PROMPT },
                        ...apiHistory,
                        { role: 'user', content: lastMessage.content }
                    ];

                    let keepPrompting = true;

                    while (keepPrompting) {
                        const messageObj = await callOpenRouterChatWithTools(currentHistory, RECON_TOOLS, apiOptions!);
                        
                        if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
                            currentHistory.push({
                                role: 'assistant',
                                content: messageObj.content || null,
                                tool_calls: messageObj.tool_calls
                            });

                            if (messageObj.content) {
                                setMessages(prev => [...prev, { role: 'model', content: messageObj.content }]);
                            }

                            for (const toolCall of messageObj.tool_calls) {
                                const args = JSON.parse(toolCall.function.arguments);
                                const toolName = toolCall.function.name;
                                
                                // Show action message
                                let actionMsg = `🔍 Running ${toolName}...`;
                                if (toolName === 'start_recon' || toolName === 'quick_recon') {
                                    actionMsg = `🚀 Starting reconnaissance on \`${args.target}\`...`;
                                } else if (toolName === 'subdomain_enum') {
                                    actionMsg = `🌐 Enumerating subdomains for \`${args.target}\`...`;
                                } else if (toolName === 'vulnerability_scan') {
                                    actionMsg = `🔎 Scanning for vulnerabilities on \`${args.target}\`...`;
                                } else if (toolName === 'osint_scan') {
                                    actionMsg = `🕵️ Gathering OSINT for \`${args.target}\`...`;
                                } else if (toolName === 'get_scan_status') {
                                    actionMsg = `📊 Checking scan #${args.scan_id} status...`;
                                } else if (toolName === 'get_findings') {
                                    actionMsg = `📋 Retrieving findings from scan #${args.scan_id}...`;
                                }
                                
                                setMessages(prev => [...prev, { role: 'model', content: actionMsg }]);
                                
                                try {
                                    const res = await fetch('/api/recon/execute', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                            tool: toolName,
                                            args: args 
                                        })
                                    });
                                    const data = await res.json();
                                    
                                    let toolOutput = data.result || "Operation completed.";
                                    
                                    // Format the output for better readability
                                    if (typeof toolOutput === 'object') {
                                        toolOutput = JSON.stringify(toolOutput, null, 2);
                                    }
                                    
                                    currentHistory.push({
                                        role: 'tool',
                                        name: toolName,
                                        tool_call_id: toolCall.id,
                                        content: toolOutput
                                    });
                                } catch (e: any) {
                                    currentHistory.push({
                                        role: 'tool',
                                        name: toolName,
                                        tool_call_id: toolCall.id,
                                        content: `Execution failed: ${e.message}`
                                    });
                                }
                            }
                        } else {
                            currentHistory.push({ role: 'assistant', content: messageObj.content });
                            setMessages(prev => [...prev, { role: 'model', content: messageObj.content }]);
                            keepPrompting = false;
                        }
                    }

                    setApiHistory(currentHistory.slice(1));

                } catch (e: any) {
                    const errorMessage = e.message || "Failed to get response.";
                    if (errorMessage !== "Request cancelled.") {
                        setMessages(prev => [...prev, { role: 'model', content: `Error: ${errorMessage}` }]);
                    } else {
                        setMessages(prev => prev.slice(0, -1));
                    }
                } finally {
                    setIsLoading(false);
                    isResponding.current = false;
                }
            }
        };

        processMessageQueue();

    }, [messages, apiOptions, isApiKeySet, onShowApiKeyWarning, apiHistory]);
    
    const sendMessage = useCallback((message: string) => {
        if (isLoading || !message.trim()) return;
        setMessages(prev => [...prev, { role: 'user', content: message }]);
    }, [isLoading]);

    const startAnalysisWithAgent = useCallback((vulnerability: Vulnerability, analyzedTarget: string) => {
        // Start recon on the target
        const message = `Please perform a reconnaissance scan on ${analyzedTarget}`;
        sendMessage(message);
    }, [sendMessage]);

    const startReportAnalysisWithAgent = useCallback((reportText: string, analysisType: string) => {
        // Analyze the report
        const message = `Please analyze this security report and provide insights:\n\n${reportText.substring(0, 2000)}...`;
        sendMessage(message);
    }, [sendMessage]);

    const resetMessages = useCallback(() => {
        setMessages([]);
        setApiHistory([]);
        isResponding.current = false;
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        resetMessages,
        startAnalysisWithAgent,
        startReportAnalysisWithAgent,
    };
};
