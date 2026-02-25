import React, { useState, useRef, useEffect } from 'react';

interface ExportDropdownProps {
  reportId: string;
  disabled?: boolean;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ reportId, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    window.open(`${API_URL}/analyses/${reportId}/export?format=${format}`, '_blank');
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold gradient-coral text-white rounded-lg hover:brightness-110 transition-all duration-300 shadow-md shadow-coral/20 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="export-dropdown-btn"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-purple-medium/60 border-0 rounded-lg shadow-lg overflow-hidden z-10">
          <button
            onClick={() => handleExport('json')}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-medium/50 transition-colors flex items-center gap-2"
            data-testid="export-json"
          >
            <svg className="h-4 w-4 text-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-medium/50 transition-colors flex items-center gap-2"
            data-testid="export-csv"
          >
            <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-medium/50 transition-colors flex items-center gap-2"
            data-testid="export-pdf"
          >
            <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            PDF
          </button>
        </div>
      )}
    </div>
  );
};
