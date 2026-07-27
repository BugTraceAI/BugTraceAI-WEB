// @author: Albert C | @yz9yt | github.com/yz9yt
// services/chatService.ts
// Chat functions. Each function manages conversation history and delegates
// to the chat API client for multi-turn interactions.

import type { ApiOptions, ChatMessage, ExploitContext } from '../types.ts';
import { callOpenRouterChat } from './apiClient.ts';
import {
    createInitialExploitChatPrompt,
    createInitialSqlExploitChatPrompt,
} from './prompts/index.ts';

export const startExploitChat = async (context: ExploitContext, options: ApiOptions): Promise<string> => {
    const prompt = createInitialExploitChatPrompt(context);
    const initialHistory: ChatMessage[] = [{ role: 'user', content: prompt }];
    return callOpenRouterChat(initialHistory, options);
};

export const startSqlExploitChat = async (context: ExploitContext, options: ApiOptions): Promise<string> => {
    const prompt = createInitialSqlExploitChatPrompt(context);
    const initialHistory: ChatMessage[] = [{ role: 'user', content: prompt }];
    return callOpenRouterChat(initialHistory, options);
};

export const continueExploitChat = async (history: ChatMessage[], newUserMessage: string, options: ApiOptions): Promise<string> => {
    const updatedHistory: ChatMessage[] = [...history, { role: 'user', content: newUserMessage }];
    return callOpenRouterChat(updatedHistory, options);
};

export const startGeneralChat = async (systemPrompt: string, userMessage: string, options: ApiOptions): Promise<string> => {
    const initialHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
    ];
    return callOpenRouterChat(initialHistory, options);
};

export const continueGeneralChat = async (systemPrompt: string, history: ChatMessage[], newUserMessage: string, options: ApiOptions): Promise<string> => {
    const fullHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: newUserMessage }
    ];
    return callOpenRouterChat(fullHistory, options);
};
