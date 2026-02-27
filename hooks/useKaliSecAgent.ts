// hooks/useKaliSecAgent.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, Vulnerability } from '../types.ts';
import { callOpenRouterChatWithTools } from '../services/apiClient.ts';
import { useApiOptions } from './useApiOptions.ts';

const KALI_SYSTEM_PROMPT = `You are a Kali Linux Expert Security Agent operating via BugTraceAI. 
You have access to a fully containerized Kali Linux environment through the \`run_kali_command\` tool.
When the user asks you to perform an action (like a scan, reconnaissance, or exploitation), you MUST use the \`run_kali_command\` tool to run the appropriate terminal commands (e.g., nmap, subfinder, sqlmap).
Always explain what you are going to run before running it, and interpret the results concisely. Use markdown for all terminal output.`;

const KALI_TOOLS = [
  {
    type: "function",
    function: {
      name: "run_kali_command",
      description: "Execute a command in the containerized Kali Linux environment. Use this to run security tools like nmap, ffuf, nuclei, sqlmap, etc. The output is pure text stdout/stderr.",
      parameters: {
        type: "object",
        properties: {
          command: { 
            type: "string",
            description: "The bash command to execute."
          }
        },
        required: ["command"]
      }
    }
  }
];

export const useKaliSecAgent = (onShowApiKeyWarning: () => void) => {
    // We store raw histories for the API, but `messages` for UI
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
                        { role: 'system', content: KALI_SYSTEM_PROMPT },
                        ...apiHistory,
                        { role: 'user', content: lastMessage.content }
                    ];

                    let keepPrompting = true;

                    while (keepPrompting) {
                        const messageObj = await callOpenRouterChatWithTools(currentHistory, KALI_TOOLS, apiOptions!);
                        
                        if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
                            // Add the assistant's tool call to history
                            currentHistory.push({
                                role: 'assistant',
                                content: messageObj.content || null,
                                tool_calls: messageObj.tool_calls
                            });

                            if (messageObj.content) {
                                setMessages(prev => [...prev, { role: 'model', content: messageObj.content }]);
                            }

                            // Process tools
                            for (const toolCall of messageObj.tool_calls) {
                                if (toolCall.function.name === 'run_kali_command') {
                                    const args = JSON.parse(toolCall.function.arguments);
                                    
                                    // Let UI know we are running
                                    setMessages(prev => [...prev, { role: 'model', content: `> Running: \`${args.command}\`...` }]);
                                    
                                    try {
                                        const res = await fetch('/api/kali/execute', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ command: args.command })
                                        });
                                        const data = await res.json();
                                        
                                        const toolOutput = data.result || "Command executed without output.";
                                        
                                        currentHistory.push({
                                            role: 'tool',
                                            name: toolCall.function.name,
                                            tool_call_id: toolCall.id,
                                            content: toolOutput
                                        });
                                    } catch (e: any) {
                                        currentHistory.push({
                                            role: 'tool',
                                            name: toolCall.function.name,
                                            tool_call_id: toolCall.id,
                                            content: `Execution failed: ${e.message}`
                                        });
                                    }
                                }
                            }
                        } else {
                            // Normal response
                            currentHistory.push({ role: 'assistant', content: messageObj.content });
                            setMessages(prev => [...prev, { role: 'model', content: messageObj.content }]);
                            keepPrompting = false;
                        }
                    }

                    // Update apiHistory (without the system prompt, but with all tool calls and responses!)
                    setApiHistory(currentHistory.slice(1));

                } catch (e: any) {
                    const errorMessage = e.message || "Failed to get response.";
                    if (errorMessage !== "Request cancelled.") {
                        setMessages(prev => [...prev, { role: 'model', content: `Error: ${errorMessage}` }]);
                    } else {
                        setMessages(prev => prev.slice(0, -1)); // remove user message on cancel
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
        // Implement Context analysis here if needed
    }, []);

    const startReportAnalysisWithAgent = useCallback((reportText: string, analysisType: string) => {
        // Implement Report analysis here if needed
    }, []);

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
