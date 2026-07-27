// components/chat/SearchResult.tsx
import React from 'react';

interface SearchResultData {
  session_id: string;
  session_title: string;
  session_type: 'websec' | 'xss' | 'sql';
  match_count: number;
  snippet: string;
  message_id: string;
}

interface SearchResultProps {
  result: SearchResultData;
  searchQuery: string;
  onClick: () => void;
}

export const SearchResult: React.FC<SearchResultProps> = ({
  result,
  searchQuery,
  onClick,
}) => {
  /**
   * Highlight matching text in search results
   * Escapes special regex characters and uses case-insensitive matching
   */
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-ui-accent/20 text-ui-accent px-0.5 rounded-sm font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      onClick={onClick}
      data-testid="search-result"
      className="p-3 cursor-pointer hover:bg-ui-accent/5 rounded-xl transition-all border border-transparent hover:border-ui-accent/20 mb-1 last:mb-0"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-[13px] text-ui-text-main group-hover:text-ui-accent transition-colors">
          {result.session_title}
        </span>
        <span className="label-mini !text-[9px] text-ui-accent bg-ui-accent/10 px-2 py-0.5 rounded-lg border border-ui-accent/20 shadow-[0_0_10px_rgba(255,127,80,0.1)]">
          {result.match_count} {result.match_count === 1 ? 'match' : 'matches'}
        </span>
      </div>
      <p className="text-[11px] text-ui-text-dim leading-relaxed line-clamp-2">
        {highlightText(result.snippet, searchQuery)}
      </p>
    </div>
  );
};
