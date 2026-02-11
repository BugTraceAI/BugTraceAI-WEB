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
          placeholder="Search messages..."
          data-testid="search-input"
          className="w-full px-4 py-2 pl-10 bg-purple-medium/50 border-0 rounded-lg text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
        />

        {/* Search icon */}
        <span className="absolute left-3 top-2.5 text-muted text-base">
          {isSearching ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            '🔍'
          )}
        </span>

        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-2.5 text-muted hover:text-white transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-purple-medium/50 border-0 rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-purple-medium/50 border-0 rounded-lg p-4 text-center text-muted text-sm z-50">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
};
