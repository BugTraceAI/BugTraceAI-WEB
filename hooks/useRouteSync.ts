// hooks/useRouteSync.ts
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { View, Tool } from '../types';

// Tool → URL slug mappings
const toolToSlug: Partial<Record<Tool, string>> = {
  [Tool.DAST]: 'dast',
  [Tool.SECURITY_HEADERS_ANALYZER]: 'headers',
  [Tool.SAST]: 'sast',
  [Tool.JS_RECON]: 'js-recon',
  [Tool.DOM_XSS_PATHFINDER]: 'dom-xss',
  [Tool.PAYLOAD_FORGE]: 'payload-forge',
  [Tool.SSTI_FORGE]: 'ssti-forge',
  [Tool.OOB_INTERACTION_HELPER]: 'oob-helper',
  [Tool.URL_LIST_FINDER]: 'url-finder',
  [Tool.SUBDOMAIN_FINDER]: 'subdomain-finder',
};

const slugToTool: Record<string, Tool> = {};
for (const [tool, slug] of Object.entries(toolToSlug)) {
  slugToTool[slug as string] = tool as Tool;
}

// Views with sub-tabs: base path, default tool, and available tools
const viewSubTabConfig: Partial<Record<View, { basePath: string; defaultTool: Tool; tools: Tool[] }>> = {
  [View.URL_ANALYSIS]: {
    basePath: '/url-analysis',
    defaultTool: Tool.DAST,
    tools: [Tool.DAST, Tool.SECURITY_HEADERS_ANALYZER],
  },
  [View.CODE_ANALYSIS]: {
    basePath: '/code-analysis',
    defaultTool: Tool.SAST,
    tools: [Tool.SAST, Tool.JS_RECON, Tool.DOM_XSS_PATHFINDER],
  },
  [View.PAYLOAD_TOOLS]: {
    basePath: '/payload-tools',
    defaultTool: Tool.PAYLOAD_FORGE,
    tools: [Tool.PAYLOAD_FORGE, Tool.SSTI_FORGE, Tool.OOB_INTERACTION_HELPER],
  },
  [View.DISCOVERY_TOOLS]: {
    basePath: '/discovery-tools',
    defaultTool: Tool.URL_LIST_FINDER,
    tools: [Tool.URL_LIST_FINDER, Tool.SUBDOMAIN_FINDER],
  },
};

// View → path (base paths for all views)
const viewToPath: Record<View, string> = {
  [View.URL_ANALYSIS]: '/url-analysis',
  [View.CODE_ANALYSIS]: '/code-analysis',
  [View.PAYLOAD_TOOLS]: '/payload-tools',
  [View.DISCOVERY_TOOLS]: '/discovery-tools',
  [View.JWT_ANALYZER]: '/jwt-analyzer',
  [View.EXPLOIT_TOOLS]: '/exploit-tools',
  [View.FILE_UPLOAD_AUDITOR]: '/file-upload-auditor',
  [View.WEB_SEC_AGENT]: '/chat',
  [View.XSS_EXPLOIT_ASSISTANT]: '/xss-assistant',
  [View.SQL_EXPLOIT_ASSISTANT]: '/sql-assistant',
  [View.CLI_FRAMEWORK]: '/bugtraceai',
  [View.HISTORY]: '/history',
};

// Static path → view (for views without sub-tabs + legacy aliases)
const pathToView: Record<string, View> = {
  '/url-analysis': View.URL_ANALYSIS,
  '/code-analysis': View.CODE_ANALYSIS,
  '/payload-tools': View.PAYLOAD_TOOLS,
  '/discovery-tools': View.DISCOVERY_TOOLS,
  '/jwt-analyzer': View.JWT_ANALYZER,
  '/exploit-tools': View.EXPLOIT_TOOLS,
  '/file-upload-auditor': View.FILE_UPLOAD_AUDITOR,
  '/websec': View.WEB_SEC_AGENT,
  '/xss-assistant': View.XSS_EXPLOIT_ASSISTANT,
  '/sql-assistant': View.SQL_EXPLOIT_ASSISTANT,
  '/history': View.HISTORY,
};

interface UseRouteSyncProps {
  activeView: View;
  activeSubTab: Tool;
  onNavigate: (view: View) => void;
  onSubTabChange: (tool: Tool) => void;
}

export const useRouteSync = ({ activeView, activeSubTab, onNavigate, onSubTabChange }: UseRouteSyncProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // URL → state sync
  useEffect(() => {
    const pathname = location.pathname;

    // Dynamic routes: chat sessions
    if (pathname.startsWith('/chat/') || pathname === '/chat') {
      if (activeView !== View.WEB_SEC_AGENT) {
        onNavigate(View.WEB_SEC_AGENT);
      }
      return;
    }

    // Dynamic routes: CLI framework tabs
    if (pathname.startsWith('/bugtraceai')) {
      if (activeView !== View.CLI_FRAMEWORK) {
        onNavigate(View.CLI_FRAMEWORK);
      }
      return;
    }

    // Sub-tab routes: /base-path/slug
    for (const [view, config] of Object.entries(viewSubTabConfig)) {
      const typedView = view as View;
      if (pathname.startsWith(config!.basePath + '/')) {
        const slug = pathname.slice(config!.basePath.length + 1);
        const tool = slugToTool[slug];
        if (tool && config!.tools.includes(tool)) {
          if (activeView !== typedView) {
            onNavigate(typedView);
          }
          if (activeSubTab !== tool) {
            onSubTabChange(tool);
          }
          return;
        }
      }
      // Bare base path → redirect to default tool
      if (pathname === config!.basePath) {
        const defaultSlug = toolToSlug[config!.defaultTool];
        navigate(`${config!.basePath}/${defaultSlug}`, { replace: true });
        return;
      }
    }

    // `/` → redirect to /bugtraceai
    if (pathname === '/') {
      navigate('/bugtraceai', { replace: true });
      return;
    }

    // Static paths
    const view = pathToView[pathname];
    if (view !== undefined && view !== activeView) {
      onNavigate(view);
    }
  }, [location.pathname]);

  // State → URL sync
  useEffect(() => {
    const currentPath = location.pathname;

    // Don't auto-navigate for dynamic routes
    if (activeView === View.WEB_SEC_AGENT && currentPath.startsWith('/chat')) {
      return;
    }
    if (activeView === View.CLI_FRAMEWORK && currentPath.startsWith('/bugtraceai')) {
      return;
    }

    // Views with sub-tabs: navigate to /basePath/slug
    const config = viewSubTabConfig[activeView];
    if (config) {
      const slug = toolToSlug[activeSubTab];
      if (slug && config.tools.includes(activeSubTab)) {
        const targetPath = `${config.basePath}/${slug}`;
        if (currentPath !== targetPath) {
          navigate(targetPath, { replace: false });
        }
        return;
      }
    }

    // Views without sub-tabs
    const path = viewToPath[activeView];
    if (path && currentPath !== path && !currentPath.startsWith(path + '/')) {
      navigate(path, { replace: false });
    }
  }, [activeView, activeSubTab]);

  return {
    navigateToView: (view: View, tool?: Tool) => {
      const config = viewSubTabConfig[view];
      if (config) {
        const selectedTool = tool && config.tools.includes(tool) ? tool : config.defaultTool;
        const slug = toolToSlug[selectedTool];
        navigate(`${config.basePath}/${slug}`);
        onSubTabChange(selectedTool);
      } else {
        const path = viewToPath[view];
        if (path) {
          navigate(path);
        }
      }
      onNavigate(view);
    },
    navigateToSubTab: (tool: Tool) => {
      for (const config of Object.values(viewSubTabConfig)) {
        if (config!.tools.includes(tool)) {
          const slug = toolToSlug[tool];
          if (slug) {
            navigate(`${config!.basePath}/${slug}`);
          }
          break;
        }
      }
      onSubTabChange(tool);
    },
  };
};
