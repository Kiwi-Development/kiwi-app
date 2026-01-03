import type { Finding, FindingSeverity } from "./findings";

/**
 * Regression - finding that got worse between runs
 */
export interface Regression {
  finding: Finding;
  severityChange: string;
  frequencyChange?: string;
}

/**
 * Confusion Hotspot - area with many issues
 */
export interface ConfusionHotspot {
  area: string;
  issueCount: number;
  elements?: string[];
}

/**
 * Finding counts by severity
 */
export interface FindingCounts {
  blocker: number;
  high: number;
  med: number;
  low: number;
}

/**
 * Comparison Result - result of comparing two runs
 */
export interface ComparisonResult {
  runA: { id: string };
  runB: { id: string };
  findingCounts: {
    a: FindingCounts;
    b: FindingCounts;
  };
  resolved: Finding[];
  newFindings: Finding[];
  regressions: Regression[];
  confusionHotspots: ConfusionHotspot[];
}

/**
 * Multi-run comparison result
 */
export interface MultiRunComparison {
  allFindings: Finding[];
  findingCounts: Record<string, FindingCounts>;
  runs: Array<{ id: string; [key: string]: unknown }>;
  confusionHotspots: ConfusionHotspot[];
}

/**
 * Multi-test comparison result (for comparing multiple tests)
 */
export interface MultiTestComparison {
  allFindings: Finding[];
  findingCounts: Record<string, FindingCounts>;
  tests: Array<{ id: string; title: string; [key: string]: unknown }>;
  isMultiTest: true;
}
