// components/chat/ChatSearchBar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useChatOperations } from '../../hooks/useChatOperations';
import { SearchResult } from './SearchResult';

interface SearchResultData {
  session_id: string;
  session_title: string;
  session_type: 'websec' | 'xss' | 'sql';
  match_count: number;
  snippet: string;
  message_id: string;
}

interface ChatSearchBarProps {
  onResultSelect: (sessionId: string) => void;
}

export const ChatSearchBar: React.FC<ChatSearchBarProps> = ({ onResultSelect }) => {
  const { searchChats } = useChatOperations();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Debounced search effect
   * Waits 300ms after user stops typing before executing search
   * Only searches if query is at least 2 characters
   */
  useEffect(() => {
    const debounceTimer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setIsSearching(true);
        try {
          const searchResults = await searchChats(query);

          // Transform backend response to flat list of results
          const flatResults: SearchResultData[] = [];
          searchResults.forEach((result) => {
            // Take the first match from each session
            if (result.matches.length > 0) {
              const firstMatch = result.matches[0];
              flatResults.push({
                session_id: result.session_id,
                session_title: result.session_title,
                session_type: result.session_type as 'websec' | 'xss' | 'sql',
                match_count: result.match_count,
                snippet: firstMatch.snippet,
                message_id: firstMatch.message_id,
              });
            }
          });

          setResults(flatResults);
          setShowResults(true);
        } catch (error) {
          console.error('Search failed:', error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [query, searchChats]);

  /**
   * Close results dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleResultClick = (sessionId: string) => {
    onResultSelect(sessionId);
    setShowResults(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mission logs..."
          data-testid="search-input"
          className="input-premium w-full !h-10 pl-10 pr-10 !text-xs !bg-dashboard-bg/50"
        />

        {/* Search icon */}
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ui-text-dim/60">
          {isSearching ? (
            <div className="h-3.5 w-3.5 border-2 border-ui-accent/30 border-t-ui-accent rounded-full animate-spin" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </span>

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-ui-text-dim hover:text-ui-accent hover:bg-ui-accent/10 transition-all"
            aria-label="Clear search"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 card-premium !p-2 !bg-ui-bg/95 border-ui-accent/20 shadow-2xl max-h-80 overflow-y-auto z-50">
          {results.map((result) => (
            <SearchResult
              key={`${result.session_id}-${result.message_id}`}
              result={result}
              searchQuery={query}
              onClick={() => handleResultClick(result.session_id)}
            />
          ))}
        </div>
      )}

      {/* No results message */}
      {showResults && query.length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-3 card-premium p-6 text-center z-50">
          <span className="label-mini text-ui-text-dim block mb-1">NO DATA RETRIEVED</span>
          <p className="text-[11px] text-ui-text-dim/60">No records matching "{query}"</p>
        </div>
      )}
    </div>
  );
};
