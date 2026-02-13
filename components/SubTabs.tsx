// components/SubTabs.tsx
import React from 'react';
import { Tool } from '../types.ts';

interface SubTab {
  id: Tool;
  name: string;
}

interface SubTabsProps {
  activeTool: Tool;
  setTool: (tool: Tool) => void;
  tools: SubTab[];
}

export const SubTabs: React.FC<SubTabsProps> = ({ activeTool, setTool, tools }) => {
  return (
    <div className="flex items-center gap-2 mb-8 bg-ui-input-bg/40 p-1.5 rounded-2xl border border-ui-border self-start">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setTool(tool.id)}
          className={`
            h-9 px-5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 flex items-center gap-2
            ${activeTool === tool.id
              ? 'bg-ui-accent text-ui-bg shadow-glow-coral'
              : 'text-ui-text-dim hover:text-ui-text-main hover:bg-ui-accent/10'
            }
          `}
          aria-current={activeTool === tool.id ? 'page' : undefined}
        >
          {tool.name}
        </button>
      ))}
    </div>
  );
};