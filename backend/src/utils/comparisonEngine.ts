/**
 * comparisonEngine.ts
 *
 * Comparison engine for analyzing differences between two analysis reports.
 * Provides diff algorithm to identify new, fixed, changed, and unchanged vulnerabilities.
 */

import { Prisma } from '@prisma/client';

interface Vulnerability {
  vulnerability: string;
  severity: string;
  description: string;
  impact: string;
  recommendation: string;
  vulnerableCode: string;
  injectionPoint?: {
    type: string;
    parameter: string;
    method?: string;
  };
}

interface AnalysisReport {
  id: string;
  analysisType: string;
  target: string;
  vulnerabilities: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

interface SeverityChange {
  vulnerability: string;
  old_severity: string;
  new_severity: string;
  description: string;
}

interface ComparisonResult {
  reportA: {
    id: string;
    target: string;
    created_at: string;
    vulnerability_count: number;
  };
  reportB: {
    id: string;
    target: string;
    created_at: string;
    vulnerability_count: number;
  };
  diff: {
    new_vulnerabilities: Vulnerability[];
    fixed_vulnerabilities: Vulnerability[];
    severity_changes: SeverityChange[];
    unchanged_vulnerabilities: Vulnerability[];
  };
  summary: {
    total_new: number;
    total_fixed: number;
    total_changed: number;
    total_unchanged: number;
  };
}

/**
 * Normalize vulnerability name for matching
 */
function normalizeVulnName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Check if two vulnerabilities are the same based on multiple criteria
 */
function vulnerabilitiesMatch(vulnA: Vulnerability, vulnB: Vulnerability): boolean {
  // Match by vulnerability name (case-insensitive)
  if (normalizeVulnName(vulnA.vulnerability) === normalizeVulnName(vulnB.vulnerability)) {
    return true;
  }

  // Match by injection point (same parameter + type)
  if (vulnA.injectionPoint && vulnB.injectionPoint) {
    const sameParameter = vulnA.injectionPoint.parameter === vulnB.injectionPoint.parameter;
    const sameType = vulnA.injectionPoint.type === vulnB.injectionPoint.type;
    if (sameParameter && sameType) {
      return true;
    }
  }

  // Match by vulnerable code snippet (fuzzy match, first 100 chars)
  const codeA = vulnA.vulnerableCode.substring(0, 100).toLowerCase().trim();
  const codeB = vulnB.vulnerableCode.substring(0, 100).toLowerCase().trim();
  if (codeA && codeB && codeA === codeB) {
    return true;
  }

  return false;
}

/**
 * Compare two analysis reports and generate diff
 */
export function compareAnalyses(
  reportA: AnalysisReport,
  reportB: AnalysisReport
): ComparisonResult {
  // Cast JsonValue to Vulnerability array
  const vulnsA = (Array.isArray(reportA.vulnerabilities) ? reportA.vulnerabilities : []) as unknown as Vulnerability[];
  const vulnsB = (Array.isArray(reportB.vulnerabilities) ? reportB.vulnerabilities : []) as unknown as Vulnerability[];

  const newVulnerabilities: Vulnerability[] = [];
  const fixedVulnerabilities: Vulnerability[] = [];
  const severityChanges: SeverityChange[] = [];
  const unchangedVulnerabilities: Vulnerability[] = [];

  // Build map of vulnerabilities in A for faster lookup
  const vulnsAMatched = new Set<number>();

  // Process each vulnerability in B
  for (const vulnB of vulnsB) {
    let foundMatch = false;

    for (let i = 0; i < vulnsA.length; i++) {
      if (vulnsAMatched.has(i)) continue; // Already matched

      const vulnA = vulnsA[i];

      if (vulnerabilitiesMatch(vulnA, vulnB)) {
        foundMatch = true;
        vulnsAMatched.add(i);

        // Check if severity changed
        if (vulnA.severity !== vulnB.severity) {
          severityChanges.push({
            vulnerability: vulnB.vulnerability,
            old_severity: vulnA.severity,
            new_severity: vulnB.severity,
            description: vulnB.description,
          });
        } else {
          // Unchanged
          unchangedVulnerabilities.push(vulnB);
        }

        break;
      }
    }

    // If no match found in A, it's a new vulnerability in B
    if (!foundMatch) {
      newVulnerabilities.push(vulnB);
    }
  }

  // Process vulnerabilities in A that weren't matched (fixed in B)
  for (let i = 0; i < vulnsA.length; i++) {
    if (!vulnsAMatched.has(i)) {
      fixedVulnerabilities.push(vulnsA[i]);
    }
  }

  // Build result
  const result: ComparisonResult = {
    reportA: {
      id: reportA.id,
      target: reportA.target,
      created_at: reportA.createdAt.toISOString(),
      vulnerability_count: vulnsA.length,
    },
    reportB: {
      id: reportB.id,
      target: reportB.target,
      created_at: reportB.createdAt.toISOString(),
      vulnerability_count: vulnsB.length,
    },
    diff: {
      new_vulnerabilities: newVulnerabilities,
      fixed_vulnerabilities: fixedVulnerabilities,
      severity_changes: severityChanges,
      unchanged_vulnerabilities: unchangedVulnerabilities,
    },
    summary: {
      total_new: newVulnerabilities.length,
      total_fixed: fixedVulnerabilities.length,
      total_changed: severityChanges.length,
      total_unchanged: unchangedVulnerabilities.length,
    },
  };

  return result;
}
