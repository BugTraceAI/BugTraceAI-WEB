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
        <mark key={i} className="bg-yellow-400/50 text-inherit px-0.5 rounded">
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
      className="p-3 cursor-pointer hover:bg-purple-medium/50 rounded-lg transition-colors border-b border-0 last:border-b-0"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-white">
          {result.session_title}
        </span>
        <span className="text-xs text-coral bg-coral-hover/10 px-2 py-0.5 rounded">
          {result.match_count} {result.match_count === 1 ? 'match' : 'matches'}
        </span>
      </div>
      <p className="text-xs text-muted mt-1 line-clamp-2">
        {highlightText(result.snippet, searchQuery)}
      </p>
    </div>
  );
};
