// hooks/useWebSecAgent.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMessage, Vulnerability, AgentType } from '../types.ts';
import { startGeneralChat, continueGeneralChat } from '../services/Service.ts';
import { getWebSecAgentSystemPrompt } from '../services/systemPrompts.ts';
import { useApiOptions } from './useApiOptions.ts';
import { callOpenRouterChatWithTools } from '../services/apiClient.ts';
import {
  KALI_SYSTEM_PROMPT, KALI_TOOLS,
  RECON_SYSTEM_PROMPT, RECON_TOOLS,
  BUGTRACE_SYSTEM_PROMPT, BUGTRACE_TOOLS,
  CURL_TOOL
} from './useWebSecAgentConfig.ts';

interface ApiHistoryItem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

const getAgentConfig = (agent: AgentType) => {
    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    switch (agent) {
        case 'kali': return { prompt: KALI_SYSTEM_PROMPT, tools: KALI_TOOLS, endpoint: `${baseUrl}/kali/execute`, label: 'Kali' };
        case 'recon': return { prompt: RECON_SYSTEM_PROMPT, tools: RECON_TOOLS, endpoint: `${baseUrl}/recon/execute`, label: 'ReconFTW' };
        case 'bugtrace': return { prompt: BUGTRACE_SYSTEM_PROMPT, tools: BUGTRACE_TOOLS, endpoint: `${baseUrl}/bugtrace/execute`, label: 'BugTrace' };
        default: return { prompt: KALI_SYSTEM_PROMPT, tools: KALI_TOOLS, endpoint: `${baseUrl}/kali/execute`, label: 'Kali' };
    }
};
export const useWebSecAgent = (onShowApiKeyWarning: () => void, activeAgent: AgentType = 'web', curlEnabled: boolean = true) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [apiHistory, setApiHistory] = useState<ApiHistoryItem[]>([]);
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
                    setMessages(prev => prev.slice(0, -1)); // revert user message so they can retry after setting key
                    setIsLoading(false);
                    isResponding.current = false;
                    onShowApiKeyWarning();
                    return;
                }
                try {
                    // Use tool-calling path for non-web agents, OR for web agent when cURL is enabled
                    const useToolPath = activeAgent !== 'web' || curlEnabled;

                    if (useToolPath) {
                        const agentLabel = activeAgent === 'web' ? 'WebSec' : getAgentConfig(activeAgent).label;
                        const systemPrompt = activeAgent === 'web' ? getWebSecAgentSystemPrompt() : getAgentConfig(activeAgent).prompt;
                        const apiEndpoint = activeAgent === 'web' ? '' : getAgentConfig(activeAgent).endpoint;
                        const rawTools = activeAgent === 'web' ? [CURL_TOOL] : getAgentConfig(activeAgent).tools;
                        const tools = curlEnabled ? rawTools : rawTools.filter((t: any) => t.function?.name !== 'run_curl');

                        let currentHistory: ApiHistoryItem[] = [
                            { role: 'system' as const, content: systemPrompt },
                            ...apiHistory,
                            { role: 'user' as const, content: lastMessage.content }
                        ];
                        if (!apiOptions) {
                            throw new Error('API key was removed. Please configure it in Settings.');
                        }
                        let keepPrompting = true;
                        let toolCallCount = 0;
                        while (keepPrompting) {
                            const messageObj = await callOpenRouterChatWithTools(currentHistory, tools, apiOptions);
                            
                            if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
                                currentHistory.push({
                                    role: 'assistant',
                                    content: messageObj.content || null,
                                    tool_calls: messageObj.tool_calls
                                });

                                if (messageObj.content) {
                                    setMessages(prev => {
                                        const last = prev[prev.length - 1];
                                        if (last && last.role === 'model') {
                                            const updated = [...prev];
                                            updated[updated.length - 1] = { ...last, content: last.content + '\n\n' + messageObj.content };
                                            return updated;
                                        }
                                        return [...prev, { role: 'model', content: messageObj.content }];
                                    });
                                }

                                // Show a single "Executing" status for all tool calls in this batch
                                const toolNames = messageObj.tool_calls.map((tc: any) => tc.function.name);
                                const statusMsg = toolNames.length === 1
                                    ? `\n\n> Executing ${agentLabel} Action: ${toolNames[0]}...`
                                    : `\n\n> Executing ${agentLabel} Actions: ${toolNames.join(', ')}...`;
                                setMessages(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.role === 'model') {
                                        const updated = [...prev];
                                        updated[updated.length - 1] = { ...last, content: last.content + statusMsg };
                                        return updated;
                                    }
                                    return [...prev, { role: 'model', content: statusMsg }];
                                });

                                for (const toolCall of messageObj.tool_calls) {
                                    const toolName = toolCall.function.name;
                                    const args = JSON.parse(toolCall.function.arguments);
                                    
                                    try {
                                        let targetUrl: string;
                                        let payload: Record<string, unknown>;

                                        if (toolName === 'run_curl') {
                                            const baseUrl = import.meta.env.VITE_API_URL || '/api';
                                            targetUrl = `${baseUrl}/tools/curl`;
                                            payload = args;
                                        } else if (activeAgent === 'kali') {
                                            targetUrl = apiEndpoint;
                                            payload = { command: args.command };
                                        } else {
                                            targetUrl = apiEndpoint;
                                            payload = { tool: toolName, args: args };
                                        }

                                        const res = await fetch(targetUrl, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        });
                                        if (!res.ok) {
                                            throw new Error(`HTTP ${res.status}: Tool endpoint returned an error`);
                                        }
                                        let data: any;
                                        try {
                                            data = await res.json();
                                        } catch {
                                            throw new Error('Invalid response from tool endpoint (not JSON)');
                                        }

                                        // Extract result from sendSuccess wrapper: { data: { success, result } }
                                        const result = data?.data?.result ?? data?.result;
                                        const success = data?.data?.success ?? data?.success ?? true;

                                        let toolOutput: string;
                                        if (!success) {
                                            toolOutput = `[TOOL_ERROR] ${toolName} failed:\n${typeof result === 'object' ? JSON.stringify(result, null, 2) : (result || 'Unknown error')}`;
                                        } else {
                                            toolOutput = typeof result === 'object'
                                                ? JSON.stringify(result, null, 2)
                                                : (result || '(No output)');
                                        }

                                        currentHistory.push({
                                            role: 'tool',
                                            name: toolName,
                                            tool_call_id: toolCall.id,
                                            content: toolOutput
                                        });
                                    } catch (e: unknown) {
                                        const error = e as Error;
                                        currentHistory.push({
                                            role: 'tool',
                                            name: toolName,
                                            tool_call_id: toolCall.id,
                                            content: `Execution failed: ${error.message}`
                                        });
                                    }
                                }
                            } else {
                                currentHistory.push({ role: 'assistant', content: messageObj.content });
                                setMessages(prev => [...prev, { role: 'model', content: messageObj.content }]);
                                keepPrompting = false;
                            }
                            
                            // Safety circuit breaker (allow max 5 consecutive tool hops to prevent infinite loops)
                            if (++toolCallCount >= 5) {
                                const circuitBreakerMsg = "--- Circuit Breaker: Max tool execution depth reached. Stopped to prevent recursive loop. ---";
                                currentHistory.push({ role: 'assistant', content: circuitBreakerMsg });
                                setMessages(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.role === 'model') {
                                        const updated = [...prev];
                                        updated[updated.length - 1] = { ...last, content: last.content + '\n\n' + circuitBreakerMsg };
                                        return updated;
                                    }
                                    return [...prev, { role: 'model', content: circuitBreakerMsg }];
                                });
                                keepPrompting = false;
                            }
                        }
                        setApiHistory(currentHistory.slice(1));
                    } else {
                        // Web agent without cURL — uses simpler chat API without tools
                        if (!apiOptions) {
                            throw new Error('API key was removed. Please configure it in Settings.');
                        }
                        const historyForApi = messages.slice(0, -1);
                        const responseText = historyForApi.length === 0
                            ? await startGeneralChat(getWebSecAgentSystemPrompt(), lastMessage.content, apiOptions)
                            : await continueGeneralChat(getWebSecAgentSystemPrompt(), historyForApi, lastMessage.content, apiOptions);
                        
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            if (last && last.role === 'model') {
                                const updated = [...prev];
                                updated[updated.length - 1] = { ...last, content: last.content + '\n\n' + responseText };
                                return updated;
                            }
                            return [...prev, { role: 'model', content: responseText }];
                        });
                        
                        // FIX: Update apiHistory for web agent to maintain conversation context
                        // Map ChatMessage roles to ApiHistoryItem roles ('model' -> 'assistant')
                        const newHistory: ApiHistoryItem[] = [
                            ...historyForApi.map(msg => ({
                                role: (msg.role === 'model' ? 'assistant' : msg.role) as 'user' | 'system' | 'assistant',
                                content: msg.content
                            })),
                            { role: 'assistant', content: responseText }
                        ];
                        setApiHistory(newHistory);
                    }
                } catch (e: unknown) {
                    const error = e as Error;
                    const errorMessage = error.message || "Failed to get response.";
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

    }, [messages, apiOptions, isApiKeySet, onShowApiKeyWarning, activeAgent, apiHistory, curlEnabled]);
    
    const sendMessage = useCallback((message: string) => {
        if (isLoading || isResponding.current || !message.trim()) return;
        const newUserMessage: ChatMessage = { role: 'user', content: message };
        setMessages(prev => [...prev, newUserMessage]);
    }, [isLoading]);

    const startAnalysisWithAgent = useCallback((vulnerability: Vulnerability, analyzedTarget: string) => {
        const contextPrompt = `I need to analyze this vulnerability. Please provide a detailed breakdown, suggest exploitation techniques, and offer mitigation advice.\n\n**Vulnerability:** ${vulnerability.vulnerability}\n**Severity:** ${vulnerability.severity}\n**Target:** ${analyzedTarget}\n**Description:** ${vulnerability.description}\n**Payload/Pattern:** \`\`\`\n${vulnerability.vulnerableCode}\n\`\`\``;
        setMessages([{ role: 'user', content: contextPrompt }]);
    }, []);

    const startReportAnalysisWithAgent = useCallback((reportText: string, analysisType: string) => {
        const contextPrompt = `I need to analyze this report from a "${analysisType}" scan. Please provide a detailed breakdown, suggest next steps for manual testing, and offer mitigation advice.\n\n**Report:**\n${reportText}`;
        setMessages([{ role: 'user', content: contextPrompt }]);
    }, []);
    const resetMessages = useCallback(() => {
        setMessages([]);
        setApiHistory([]);
        setIsLoading(false);
        isResponding.current = false;
    }, []);

    const syncHistory = useCallback((dbMessages: any[]) => {
        const mapped = dbMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            content: m.content
        }));
        setMessages(mapped);

        const mappedApi = dbMessages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.name && { name: m.name }),
            ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
            ...(m.tool_calls && { tool_calls: m.tool_calls }),
        }));
        setApiHistory(mappedApi);
    }, []);

    return {
        messages,
        isLoading,
        sendMessage,
        resetMessages,
        syncHistory,
        startAnalysisWithAgent,
        startReportAnalysisWithAgent,
    };
};
