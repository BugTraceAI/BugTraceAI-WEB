// contexts/AnalysisContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { Vulnerability } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisReport {
  id: string;
  analysis_type: 'url_analysis' | 'code_analysis' | 'jwt_analysis' | 'security_headers' | 'file_upload' | 'privesc';
  target: string;
  vulnerabilities: Vulnerability[];
  metadata: {
    model?: string;
    scan_config?: any;
  } | null;
  session_id?: string;
  session?: {
    id: string;
    title: string;
    session_type: string;
  } | null;
  created_at: string;
}

interface AnalysisContextType {
  // State
  analyses: AnalysisReport[];
  currentAnalysis: AnalysisReport | null;
  loading: boolean;
  error: string | null;

  // Actions
  saveAnalysis: (
    type: 'url_analysis' | 'code_analysis' | 'jwt_analysis' | 'security_headers' | 'file_upload' | 'privesc',
    target: string,
    vulnerabilities: Vulnerability[],
    metadata?: { model?: string; scan_config?: any },
    sessionId?: string
  ) => Promise<AnalysisReport>;
  loadAnalyses: (filters?: { analysis_type?: string; target?: string; limit?: number; offset?: number }) => Promise<void>;
  loadAnalysis: (id: string) => Promise<void>;
  deleteAnalysis: (id: string) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================================================
// PROVIDER
// ============================================================================

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analyses, setAnalyses] = useState<AnalysisReport[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // SAVE ANALYSIS
  // --------------------------------------------------------------------------
  const saveAnalysis = useCallback(async (
    type: 'url_analysis' | 'code_analysis' | 'jwt_analysis' | 'security_headers' | 'file_upload' | 'privesc',
    target: string,
    vulnerabilities: Vulnerability[],
    metadata?: { model?: string; scan_config?: any },
    sessionId?: string
  ): Promise<AnalysisReport> => {
    try {
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/analyses`, {
        analysis_type: type,
        target,
        vulnerabilities,
        metadata: metadata || null,
        session_id: sessionId || null,
      });

      const newAnalysis = response.data.data;

      // Add to analyses list
      setAnalyses((prev) => [newAnalysis, ...prev]);
      setCurrentAnalysis(newAnalysis);

      return newAnalysis;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to save analysis';
      setError(message);
      throw new Error(message);
    }
  }, []);

  // --------------------------------------------------------------------------
  // LOAD ANALYSES
  // --------------------------------------------------------------------------
  const loadAnalyses = useCallback(async (filters?: {
    analysis_type?: string;
    target?: string;
    limit?: number;
    offset?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/analyses`, {
        params: {
          ...(filters?.analysis_type && { analysis_type: filters.analysis_type }),
          ...(filters?.target && { target: filters.target }),
          limit: filters?.limit || 50,
          offset: filters?.offset || 0,
        },
      });

      setAnalyses(response.data.data.results || []);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to load analyses';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // LOAD ANALYSIS
  // --------------------------------------------------------------------------
  const loadAnalysis = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/analyses/${id}`);
      const analysisData = response.data.data;

      setCurrentAnalysis(analysisData);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to load analysis';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // DELETE ANALYSIS
  // --------------------------------------------------------------------------
  const deleteAnalysis = useCallback(async (id: string) => {
    try {
      setError(null);

      await axios.delete(`${API_BASE_URL}/analyses/${id}`);

      // Remove from analyses list
      setAnalyses((prev) => prev.filter((a) => a.id !== id));

      // Clear current analysis if it was the deleted one
      if (currentAnalysis?.id === id) {
        setCurrentAnalysis(null);
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to delete analysis';
      setError(message);
      throw new Error(message);
    }
  }, [currentAnalysis]);

  // --------------------------------------------------------------------------
  // CLEAR ERROR
  // --------------------------------------------------------------------------
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // --------------------------------------------------------------------------
  // CONTEXT VALUE
  // --------------------------------------------------------------------------
  const value: AnalysisContextType = {
    analyses,
    currentAnalysis,
    loading,
    error,
    saveAnalysis,
    loadAnalyses,
    loadAnalysis,
    deleteAnalysis,
    clearError,
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
};

// ============================================================================
// HOOK
// ============================================================================

export const useAnalysisContext = () => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysisContext must be used within an AnalysisProvider');
  }
  return context;
};
