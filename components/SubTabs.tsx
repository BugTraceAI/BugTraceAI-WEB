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
    <div className="flex items-center gap-1 border-b border-white/5 mb-6">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setTool(tool.id)}
          className={`
            py-2.5 px-5 font-medium text-sm rounded-none transition-all duration-500 flex items-center gap-2 border-b-2 -mb-px
            ${activeTool === tool.id
              ? 'border-b-coral text-coral-hover bg-coral/10'
              : 'border-b-transparent text-purple-gray hover:text-white hover:border-b-purple-elevated/50'
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