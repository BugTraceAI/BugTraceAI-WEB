// hooks/useBugTraceAgent.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, Vulnerability } from '../types.ts';
import { callOpenRouterChatWithTools } from '../services/apiClient.ts';
import { useApiOptions } from './useApiOptions.ts';

const BUGTRACE_SYSTEM_PROMPT = `You are a BugTraceAI Security Expert Agent with access to advanced vulnerability scanning capabilities.
You have access to the BugTraceAI-CLI scanning framework through the following tools:

- \`start_scan\`: Start a comprehensive security scan on a target URL
- \`get_scan_status\`: Check the progress and status of a running scan
- \`query_findings\`: Query vulnerability findings from a completed scan
- \`stop_scan\`: Stop a running scan gracefully
- \`export_report\`: Export a scan report (summary, critical findings, or full report)

When the user asks you to scan a target:
1. Use start_scan to begin scanning
2. Use get_scan_status to monitor progress
3. Use query_findings to retrieve vulnerabilities
4. Use export_report to get a formatted report

Always explain what you're doing and interpret the results professionally.
Provide actionable remediation advice for any vulnerabilities found.`;

const BUGTRACE_TOOLS = [
  {
    type: "function",
    function: {
      name: "start_scan",
      description: "Start a new security scan on a target URL. The scan runs in the background - use get_scan_status to monitor progress.",
      parameters: {
        type: "object",
        properties: {
          target_url: {
            type: "string",
            description: "The URL to scan (must be valid HTTP/HTTPS URL)"
          },
          scan_type: {
            type: "string",
            enum: ["full", "hunter", "manager"],
            description: "Type of scan: full (default), hunter (aggressive), or manager (passive)"
          },
          max_depth: {
            type: "integer",
            description: "Maximum crawl depth (default: 2, range: 1-5)"
          },
          max_urls: {
            type: "integer",
            description: "Maximum URLs to scan (default: 20, range: 1-100)"
          }
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
      name: "query_findings",
      description: "Query vulnerability findings from a completed or running scan.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "integer",
            description: "The ID of the scan to query"
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info"],
            description: "Filter by severity level (optional)"
          },
          vuln_type: {
            type: "string",
            description: "Filter by vulnerability type - xss, sqli, csrf, etc. (optional)"
          },
          limit: {
            type: "integer",
            description: "Maximum findings to return (default: 20)"
          }
        },
        required: ["scan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "stop_scan",
      description: "Stop a running scan gracefully.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "integer",
            description: "The ID of the scan to stop"
          }
        },
        required: ["scan_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_report",
      description: "Export a scan report. Use 'summary' for brief overview, 'critical' for critical/high findings, or 'full' for complete report.",
      parameters: {
        type: "object",
        properties: {
          scan_id: {
            type: "integer",
            description: "The ID of the scan to export"
          },
          section: {
            type: "string",
            enum: ["summary", "critical", "full"],
            description: "Report section: summary (default), critical, or full"
          }
        },
        required: ["scan_id"]
      }
    }
  }
];

export const useBugTraceAgent = (onShowApiKeyWarning: () => void) => {
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
                        { role: 'system', content: BUGTRACE_SYSTEM_PROMPT },
                        ...apiHistory,
                        { role: 'user', content: lastMessage.content }
                    ];

                    let keepPrompting = true;

                    while (keepPrompting) {
                        const messageObj = await callOpenRouterChatWithTools(currentHistory, BUGTRACE_TOOLS, apiOptions!);
                        
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
                                let actionMsg = `🔄 Executing ${toolName}...`;
                                if (toolName === 'start_scan') {
                                    actionMsg = `🚀 Starting security scan on \`${args.target_url}\`...`;
                                } else if (toolName === 'get_scan_status') {
                                    actionMsg = `📊 Checking scan #${args.scan_id} status...`;
                                } else if (toolName === 'query_findings') {
                                    actionMsg = `🔍 Querying findings from scan #${args.scan_id}...`;
                                } else if (toolName === 'export_report') {
                                    actionMsg = `📄 Exporting report for scan #${args.scan_id}...`;
                                } else if (toolName === 'stop_scan') {
                                    actionMsg = `⏹️ Stopping scan #${args.scan_id}...`;
                                }
                                
                                setMessages(prev => [...prev, { role: 'model', content: actionMsg }]);
                                
                                try {
                                    const res = await fetch('/api/bugtrace/execute', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ 
                                            tool: toolName,
                                            args: args 
                                        })
                                    });
                                    const data = await res.json();
                                    
                                    let toolOutput = data.result || "Operation completed.";
                                    
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
        const message = `Please scan ${analyzedTarget} for vulnerabilities`;
        sendMessage(message);
    }, [sendMessage]);

    const startReportAnalysisWithAgent = useCallback((reportText: string, analysisType: string) => {
        const message = `Analyze this security report and provide insights:\n\n${reportText.substring(0, 2000)}...`;
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
