// components/SubTabs.tsx
import React from 'react';
import { Tool } from '../types.ts';
import { SlidingSegmentedControl } from './cli/SlidingSegmentedControl.tsx';

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
  // Keep every tab in a group the same width. Longer tool names get a little
  // extra room, but the active indicator and typography remain shared.
  const longestLabel = Math.max(...tools.map(tool => tool.name.length), 0);
  const itemWidth = Math.min(176, Math.max(104, Math.ceil(longestLabel * 7 + 34)));

  return (
    <div className="mb-4 px-1" role="navigation" aria-label="Analysis tool navigation">
      <SlidingSegmentedControl
        value={activeTool}
        onChange={value => setTool(value as Tool)}
        ariaLabel="Analysis tool navigation"
        testIdPrefix="analysis-tool"
        itemWidth={itemWidth}
        options={tools.map(tool => ({ value: tool.id, label: tool.name }))}
      />
    </div>
  );
};
