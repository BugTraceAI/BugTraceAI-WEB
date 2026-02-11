// hooks/useReportViewer.ts
// Custom hook for loading and filtering report markdown and findings
import { useState, useEffect } from 'react';
import { CLI_API_URL } from '../lib/cliApi';

export interface Finding {
  id?: string;
  title: string;
  type?: string;
  severity: string;
  description: string;
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

export type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

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
}

interface UseReportViewerReturn {
  markdown: string;
  findings: Finding[];
  scanStats: ScanStats | null;
  loading: boolean;
  error: string | null;
  selectedSeverity: SeverityFilter;
  filteredFindings: Finding[];
  setSelectedSeverity: (severity: SeverityFilter) => void;
  handleCardClick: (severity: SeverityFilter) => void;
  loadData: () => Promise<void>;
}

export const useReportViewer = (reportId: string): UseReportViewerReturn => {
  const [markdown, setMarkdown] = useState<string>('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch markdown, findings, and engagement data in parallel
      const [mdResponse, findingsResponse, engagementResponse] = await Promise.all([
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/final_report.md`).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/validated_findings.json`).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/engagement_data.json`).catch(() => null),
      ]);

      let hasMarkdown = false;
      let hasFindings = false;

      if (mdResponse?.ok) {
        const text = await mdResponse.text();
        setMarkdown(text);
        hasMarkdown = true;
      }

      if (findingsResponse?.ok) {
        try {
          const data = await findingsResponse.json();
          const items = data.findings || [];
          setFindings(items);
          hasFindings = items.length > 0;
        } catch { /* malformed JSON */ }
      }

      // Parse engagement data for scan stats & tech stack
      if (engagementResponse?.ok) {
        try {
          const data = await engagementResponse.json();
          const stats = data.stats || {};
          setScanStats({
            duration: stats.duration,
            duration_seconds: stats.duration_seconds,
            urls_scanned: stats.urls_scanned,
            total_tokens: stats.total_tokens,
            estimated_cost: stats.estimated_cost,
            tech_stack: stats.tech_stack,
          });
        } catch { /* malformed JSON */ }
      }

      // Fallback: try findings API only if file wasn't available
      if (!hasFindings) {
        try {
          const apiResp = await fetch(`${CLI_API_URL}/api/scans/${reportId}/findings?per_page=100`);
          if (apiResp.ok) {
            const data = await apiResp.json();
            const items = (data.findings || []).map((f: Record<string, unknown>) => ({
              id: String(f.finding_id),
              title: (f.type as string) || 'Finding',
              type: f.type as string,
              severity: f.severity as string,
              description: (f.details as string) || '',
              url: f.url as string,
              parameter: f.parameter as string,
              payload: f.payload as string,
              validated: f.validated as boolean,
            }));
            setFindings(items);
            hasFindings = items.length > 0;
          }
        } catch { /* no findings available */ }
      }

      if (!hasMarkdown && !hasFindings) {
        setError('No report available yet for this scan. The scan may still be in progress or has no findings.');
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
  };

  // Filter findings by selected severity
  const filteredFindings = selectedSeverity === 'all'
    ? findings
    : findings.filter((f) => f.severity.toLowerCase() === selectedSeverity);

  return {
    markdown,
    findings,
    scanStats,
    loading,
    error,
    selectedSeverity,
    filteredFindings,
    setSelectedSeverity,
    handleCardClick,
    loadData,
  };
};
