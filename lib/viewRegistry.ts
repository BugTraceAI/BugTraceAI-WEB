// lib/viewRegistry.ts
// Pure data: view and tool group definitions extracted from App.tsx.
// No React, no JSX — just typed configuration.

import { View, Tool } from '../types.ts';

export interface ToolDef {
    id: Tool;
    name: string;
}

export interface ViewGroupDef {
    view: View;
    tools: ToolDef[];
}

/** Sub-tab tool groups for tabbed views. */
export const VIEW_TOOL_GROUPS: ViewGroupDef[] = [
    {
        view: View.URL_ANALYSIS,
        tools: [
            { id: Tool.DAST, name: 'DAST' },
            { id: Tool.SECURITY_HEADERS_ANALYZER, name: 'Headers Analyzer' },
        ],
    },
    {
        view: View.CODE_ANALYSIS,
        tools: [
            { id: Tool.SAST, name: 'SAST' },
            { id: Tool.JS_RECON, name: 'JS Recon' },
            { id: Tool.DOM_XSS_PATHFINDER, name: 'DOM XSS Pathfinder' },
        ],
    },
    {
        view: View.PAYLOAD_TOOLS,
        tools: [
            { id: Tool.PAYLOAD_FORGE, name: 'Payload Forge' },
            { id: Tool.SSTI_FORGE, name: 'SSTI Forge' },
            { id: Tool.OOB_INTERACTION_HELPER, name: 'OOB Helper' },
        ],
    },
    {
        view: View.DISCOVERY_TOOLS,
        tools: [
            { id: Tool.URL_LIST_FINDER, name: 'URL Finder' },
            { id: Tool.SUBDOMAIN_FINDER, name: 'Subdomain Finder' },
        ],
    },
];

/** Get tools array for a given view. Returns empty array for non-tabbed views. */
export const getToolsForView = (view: View): ToolDef[] => {
    const group = VIEW_TOOL_GROUPS.find(g => g.view === view);
    return group?.tools ?? [];
};

/** Get the default sub-tab tool for a tabbed view. */
export const getDefaultTool = (view: View): Tool | null => {
    const tools = getToolsForView(view);
    return tools.length > 0 ? tools[0].id : null;
};

/** Check if a view has sub-tabs. */
export const isTabledView = (view: View): boolean =>
    VIEW_TOOL_GROUPS.some(g => g.view === view);
