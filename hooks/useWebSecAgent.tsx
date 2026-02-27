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
  BUGTRACE_SYSTEM_PROMPT, BUGTRACE_TOOLS
} from './useWebSecAgentConfig.ts';

interface ApiHistoryItem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

const getAgentConfig = (agent: AgentType) => {
    switch (agent) {
        case 'kali': return { prompt: KALI_SYSTEM_PROMPT, tools: KALI_TOOLS, endpoint: '/api/kali/execute', label: 'Kali' };
        case 'recon': return { prompt: RECON_SYSTEM_PROMPT, tools: RECON_TOOLS, endpoint: '/api/recon/execute', label: 'ReconFTW' };
        case 'bugtrace': return { prompt: BUGTRACE_SYSTEM_PROMPT, tools: BUGTRACE_TOOLS, endpoint: '/api/bugtrace/execute', label: 'BugTrace' };
        default: return { prompt: KALI_SYSTEM_PROMPT, tools: KALI_TOOLS, endpoint: '/api/kali/execute', label: 'Kali' };
    }
};
export const useWebSecAgent = (onShowApiKeyWarning: () => void, activeAgent: AgentType = 'web') => {
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
                    setMessages(prev => [...prev, { role: 'model', content: "Error: API Key is not configured. Please set it in the settings." }]);
                    setIsLoading(false);
                    isResponding.current = false;
                    onShowApiKeyWarning();
                    return;
                }
                try {
                    if (activeAgent !== 'web') {
                        const { prompt: systemPrompt, tools, endpoint: apiEndpoint, label: agentLabel } = getAgentConfig(activeAgent);

                        let currentHistory: ApiHistoryItem[] = [
                            { role: 'system' as const, content: systemPrompt },
                            ...apiHistory,
                            { role: 'user' as const, content: lastMessage.content }
                        ];
                        let keepPrompting = true;
                        while (keepPrompting) {
                            const messageObj = await callOpenRouterChatWithTools(currentHistory, tools, apiOptions!);
                            
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

                                for (const toolCall of messageObj.tool_calls) {
                                    const toolName = toolCall.function.name;
                                    const args = JSON.parse(toolCall.function.arguments);
                                    
                                    setMessages(prev => {
                                        const last = prev[prev.length - 1];
                                        const statusMsg = `\n\n> Executing ${agentLabel} Action: ${toolName}...`;
                                        if (last && last.role === 'model') {
                                            const updated = [...prev];
                                            updated[updated.length - 1] = { ...last, content: last.content + statusMsg };
                                            return updated;
                                        }
                                        return [...prev, { role: 'model', content: statusMsg }];
                                    });
                                    
                                    try {
                                        let payload: Record<string, unknown>;
                                        if (activeAgent === 'kali') {
                                            payload = { command: args.command };
                                        } else {
                                            payload = { tool: toolName, args: args };
                                        }

                                        const res = await fetch(apiEndpoint, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                        });
                                        const data = await res.json();
                                        
                                        const toolOutput = typeof data.result === 'object' 
                                            ? JSON.stringify(data.result, null, 2) 
                                            : (data.result || "Action completed.");
                                        
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
                        }
                        setApiHistory(currentHistory.slice(1));
                    } else {
                        const historyForApi = messages.slice(0, -1);
                        const responseText = historyForApi.length === 0
                            ? await startGeneralChat(getWebSecAgentSystemPrompt(), lastMessage.content, apiOptions!)
                            : await continueGeneralChat(getWebSecAgentSystemPrompt(), historyForApi, lastMessage.content, apiOptions!);
                        
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            if (last && last.role === 'model') {
                                const updated = [...prev];
                                updated[updated.length - 1] = { ...last, content: last.content + '\n\n' + responseText };
                                return updated;
                            }
                            return [...prev, { role: 'model', content: responseText }];
                        });
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
    }, [messages, apiOptions, isApiKeySet, onShowApiKeyWarning, activeAgent, apiHistory]);
    
    const sendMessage = useCallback((message: string) => {
        if (isLoading || !message.trim()) return;
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
    return {
        messages,
        isLoading,
        sendMessage,
        resetMessages,
        startAnalysisWithAgent,
        startReportAnalysisWithAgent,
    };
};
