// hooks/useReportViewer.ts
// Custom hook for loading and filtering report markdown and findings
import { useState, useEffect, useCallback, useRef } from 'react';
import { CLI_API_URL, FindingItem } from '../lib/cliApi';

export interface Finding {
  id?: string;
  title?: string;
  type?: string;
  severity: string;
  description?: string;
  details?: string;
  summary?: string;
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
  reproduction?: string;
  http_request?: string;
  http_response?: string;
  response_status?: number;
  response_excerpt?: string;
  source?: string;
  fp_confidence?: number;
  confidence_score?: number;
  screenshot_path?: string;
  // Tagged true for entries from validated_findings.json's `manual_review` bucket —
  // confirmed-but-demoted findings the report quality gate flagged for human review.
  _needsReview?: boolean;
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
  const activeControllerRef = useRef<AbortController | null>(null);

  const resetReportState = useCallback(() => {
    setMarkdown('');
    setFindings([]);
    setDetections([]);
    setScanStats(null);
  }, []);

  const loadData = useCallback(async () => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);
    setError(null);
    resetReportState();
    try {
      // Fetch markdown, findings, engagement data, and all detections from DB
      const [mdResponse, findingsResponse, engagementResponse, detectionsResponse] = await Promise.all([
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/final_report.md`, { signal: controller.signal }).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/validated_findings.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/files/engagement_data.json`, { signal: controller.signal }).catch(() => null),
        fetch(`${CLI_API_URL}/api/scans/${reportId}/findings?per_page=100`, { signal: controller.signal }).catch(() => null),
      ]);

      if (controller.signal.aborted || activeControllerRef.current !== controller) return;

      let parsedFindings: Finding[] = [];

      if (mdResponse?.ok) {
        const text = await mdResponse.text();
        if (controller.signal.aborted || activeControllerRef.current !== controller) return;
        setMarkdown(text);
      }

      // Findings come from validated_findings.json (final, deduplicated product).
      // Fallback to raw_findings.json when a scan died before validation, so the
      // Findings tab — and the "Send to Repeater" action — still work on partial
      // reports. Both files expose findings under the same `.findings` key.
      let findingsJson: { findings?: Finding[]; manual_review?: Finding[] } | null = null;
      if (findingsResponse?.ok) {
        try { findingsJson = await findingsResponse.json(); } catch { /* malformed JSON */ }
      }
      if (!findingsJson) {
        const rawResp = await fetch(
          `${CLI_API_URL}/api/scans/${reportId}/files/raw_findings.json`,
          { signal: controller.signal },
        ).catch(() => null);
        if (rawResp?.ok) {
          try { findingsJson = await rawResp.json(); } catch { /* malformed JSON */ }
        }
      }
      if (findingsJson) {
        if (controller.signal.aborted || activeControllerRef.current !== controller) return;
        const notUnknown = (f: Finding) => f.type?.toLowerCase() !== 'unknown';
        const confirmed = (findingsJson.findings || []).filter(notUnknown);
        // Surface the `manual_review` bucket too (confirmed-but-demoted by the report
        // quality gate) so nothing actionable is hidden from the Findings tab.
        const needsReview = (findingsJson.manual_review || [])
          .filter(notUnknown)
          .map((f: Finding) => ({ ...f, _needsReview: true }));
        // Order by severity (critical → info) so confirmed AND needs-review findings of
        // the same severity sit together — a critical "Needs Review" can't hide on page 2.
        const SEV_ORDER: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
        parsedFindings = [...confirmed, ...needsReview].sort(
          (a, b) => (SEV_ORDER[(b.severity || '').toLowerCase()] || 0) - (SEV_ORDER[(a.severity || '').toLowerCase()] || 0)
        );
        setFindings(parsedFindings);
      }

      // Parse detections from DB (all raw findings/signals)
      if (detectionsResponse?.ok) {
        try {
          const data = await detectionsResponse.json();
          if (controller.signal.aborted || activeControllerRef.current !== controller) return;
          setDetections(data.findings || []);
        } catch { /* malformed JSON */ }
      }

      // Parse engagement data for scan stats & tech stack
      if (engagementResponse?.ok) {
        try {
          const data = await engagementResponse.json();
          if (controller.signal.aborted || activeControllerRef.current !== controller) return;
          const stats = data.stats || {};
          setScanStats(stats);
        } catch { /* malformed JSON */ }
      }

    } catch (err) {
      if (!controller.signal.aborted && activeControllerRef.current === controller) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      }
    } finally {
      if (!controller.signal.aborted && activeControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [reportId, resetReportState]);

  useEffect(() => {
    loadData();
    return () => {
      activeControllerRef.current?.abort();
    };
  }, [loadData]);

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
