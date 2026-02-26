// hooks/useReportViewer.ts
// Custom hook for loading and filtering report markdown and findings
import { useState, useEffect } from 'react';
import { CLI_API_URL, FindingItem } from '../lib/cliApi';

export interface Finding {
  id?: string;
  title?: string;
  type?: string;
  severity: string;
  description?: string;
  details?: string;
  url?: string;
  parameter?: string;
  payload?: string;
  cvss_score?: number;
  cvss_vector?: string;
  cvss_rationale?: string;
  impact?: string;
  remediation?: string;
  validated?: boolean;
  status?: string;
  exploitation_details?: string;
  validator_notes?: string;
  llm_reproduction_steps?: string[];
  evidence?: string;
  source?: string;
  fp_confidence?: number;
  confidence_score?: number;
}

export type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface TechEntry {
  name: string;
  version: string | null;
  eol: boolean;
  category: string;
}

export interface ScanStats {
  duration?: string;
  duration_seconds?: number;
  urls_scanned?: number;
  total_tokens?: number;
  estimated_cost?: number;
  tech_stack?: {
    technologies: TechEntry[];
    waf: string[];
  };
  scan_type?: string;
  max_depth?: number;
  max_urls?: number;
}

interface UseReportViewerReturn {
  markdown: string;
  findings: Finding[];
  detections: FindingItem[];
  scanStats: ScanStats | null;
  loading: boolean;
  error: string | null;
  selectedSeverity: SeverityFilter;
  selectedCategory: string | null;
  filteredFindings: Finding[];
  setSelectedSeverity: (severity: SeverityFilter) => void;
  setSelectedCategory: (category: string | null) => void;
  handleCardClick: (severity: SeverityFilter) => void;
  handleCategoryClick: (category: string) => void;
  loadData: () => Promise<void>;
}

export const useReportViewer = (reportId: string): UseReportViewerReturn => {
  const [markdown, setMarkdown] = useState<string>('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [detections, setDetections] = useState<FindingItem[]>([]);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch markdown, findings, engagement data, and all detections from DB
      const [mdResponse, findingsResponse, engagementResponse, detectionsResponse] = await Promise.all([
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/final_report.md`).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/validated_findings.json`).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/engagement_data.json`).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/findings?per_page=100`).catch(() => null),
      ]);

      let hasMarkdown = false;
      let hasFindings = false;
      let parsedFindings: Finding[] = [];

      if (mdResponse?.ok) {
        const text = await mdResponse.text();
        setMarkdown(text);
        hasMarkdown = true;
      }

      if (findingsResponse?.ok) {
        try {
          const data = await findingsResponse.json();
          parsedFindings = (data.findings || []).filter(
            (f: Finding) => f.type?.toLowerCase() !== 'unknown'
          );
          setFindings(parsedFindings);
          hasFindings = parsedFindings.length > 0;
        } catch { /* malformed JSON */ }
      }

      // Parse detections from DB (all raw findings/signals)
      if (detectionsResponse?.ok) {
        try {
          const data = await detectionsResponse.json();
          setDetections(data.findings || []);
        } catch { /* malformed JSON */ }
      }

      // Parse engagement data for scan stats & tech stack
      if (engagementResponse?.ok) {
        try {
          const data = await engagementResponse.json();
          const stats = data.stats || {};
          setScanStats(stats);
        } catch { /* malformed JSON */ }
      }

      if (!hasFindings) {
        // Fallback or secondary check if needed
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const handleCardClick = (severity: SeverityFilter) => {
    setSelectedSeverity(selectedSeverity === severity ? 'all' : severity);
    setSelectedCategory(null); // Reset category when severity changes
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
    setSelectedSeverity('all'); // Reset severity when category changes
  };

  // Filter findings: can filter by severity OR by category
  let filteredFindings = findings;
  if (selectedCategory) {
    filteredFindings = findings.filter(f => (f.type || f.title) === selectedCategory);
  } else if (selectedSeverity !== 'all') {
    filteredFindings = findings.filter(f => {
      const sev = (f.severity || '').toLowerCase();
      // "info" filter also matches findings with missing/empty severity
      if (selectedSeverity === 'info') return sev === 'info' || sev === '';
      return sev === selectedSeverity;
    });
  }

  return {
    markdown,
    findings,
    detections,
    scanStats,
    loading,
    error,
    selectedSeverity,
    selectedCategory,
    filteredFindings,
    setSelectedSeverity,
    setSelectedCategory,
    handleCardClick,
    handleCategoryClick,
    loadData,
  };
};
