import { supabase } from "./supabase";
import type {
  Finding,
  EvidenceSnippet,
  Regression,
  ComparisonResult,
  ConfusionHotspot,
  FindingCounts,
} from "@/types";
import type { FeedbackEntryRow } from "@/types/database";

// Re-export types for backwards compatibility
export type { Finding, Regression, ComparisonResult, ConfusionHotspot };

// Simple string similarity (Jaccard similarity)
function stringSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

// Match findings by title similarity
function matchFindings(findingsA: Finding[], findingsB: Finding[]): Map<string, string> {
  const matches = new Map<string, string>();
  const usedB = new Set<string>();

  // First pass: exact title matches
  for (const findingA of findingsA) {
    const exactMatch = findingsB.find(
      (f) => f.title.toLowerCase() === findingA.title.toLowerCase() && !usedB.has(f.id)
    );
    if (exactMatch) {
      matches.set(findingA.id, exactMatch.id);
      usedB.add(exactMatch.id);
    }
  }

  // Second pass: similarity matches (threshold: 0.6)
  for (const findingA of findingsA) {
    if (matches.has(findingA.id)) continue;

    let bestMatch: Finding | null = null;
    let bestSimilarity = 0;

    for (const findingB of findingsB) {
      if (usedB.has(findingB.id)) continue;

      const similarity = stringSimilarity(findingA.title, findingB.title);
      if (similarity > bestSimilarity && similarity >= 0.6) {
        bestSimilarity = similarity;
        bestMatch = findingB;
      }
    }

    if (bestMatch) {
      matches.set(findingA.id, bestMatch.id);
      usedB.add(bestMatch.id);
    }
  }

  return matches;
}

// Count findings by severity
function countBySeverity(findings: Finding[]): FindingCounts {
  return {
    blocker: findings.filter((f) => f.severity === "Blocker").length,
    high: findings.filter((f) => f.severity === "High").length,
    med: findings.filter((f) => f.severity === "Med").length,
    low: findings.filter((f) => f.severity === "Low").length,
  };
}

// Get severity order for comparison
function getSeverityOrder(severity: string): number {
  const order: Record<string, number> = {
    Blocker: 4,
    High: 3,
    Med: 2,
    Low: 1,
  };
  return order[severity] || 0;
}

// Compare severity (returns change description)
function compareSeverity(severityA: string, severityB: string): string {
  const orderA = getSeverityOrder(severityA);
  const orderB = getSeverityOrder(severityB);

  if (orderB > orderA) {
    return `${severityA} → ${severityB} (worse)`;
  } else if (orderB < orderA) {
    return `${severityA} → ${severityB} (better)`;
  }
  return severityA;
}

// Extract confusion hotspots from evidence snippets
function extractHotspots(findings: Finding[]): ConfusionHotspot[] {
  const areaMap = new Map<string, { count: number; elements: Set<string> }>();

  for (const finding of findings) {
    if (finding.evidence_snippets && finding.evidence_snippets.length > 0) {
      for (const evidence of finding.evidence_snippets) {
        if (evidence.ui_anchor) {
          const area =
            evidence.ui_anchor.frame_name || evidence.ui_anchor.element_label || "Unknown";
          const element =
            evidence.ui_anchor.element_label || evidence.ui_anchor.element_selector || "";

          if (!areaMap.has(area)) {
            areaMap.set(area, { count: 0, elements: new Set() });
          }

          const areaData = areaMap.get(area)!;
          areaData.count += 1;
          if (element) {
            areaData.elements.add(element);
          }
        }
      }
    }
  }

  return Array.from(areaMap.entries())
    .map(
      ([area, data]): ConfusionHotspot => ({
        area,
        issueCount: data.count,
        elements: Array.from(data.elements).slice(0, 5), // Top 5 elements
      })
    )
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10); // Top 10 hotspots
}

export async function compareRuns(runAId: string, runBId: string): Promise<ComparisonResult> {
  // Load feedback entries for both runs
  const { data: entriesA } = await supabase
    .from("feedback_entries")
    .select("*")
    .eq("test_run_id", runAId)
    .order("created_at", { ascending: false });

  const { data: entriesB } = await supabase
    .from("feedback_entries")
    .select("*")
    .eq("test_run_id", runBId)
    .order("created_at", { ascending: false });

  // Convert to Finding format
  const findingsA: Finding[] =
    entriesA?.map((e) => ({
      id: e.id,
      title: e.title,
      severity: e.severity as "Blocker" | "High" | "Med" | "Low",
      confidence: e.confidence,
      description: e.description,
      suggestedFix: e.suggested_fix || "",
      affectingTasks: (e.affecting_tasks as string[]) || [],
      frequency: e.frequency || 1,
      category: e.category,
      evidence_snippets: (e.evidence_snippets || []) as EvidenceSnippet[],
    })) || [];

  const findingsB: Finding[] =
    entriesB?.map((e) => ({
      id: e.id,
      title: e.title,
      severity: e.severity as "Blocker" | "High" | "Med" | "Low",
      confidence: e.confidence,
      description: e.description,
      suggestedFix: e.suggested_fix || "",
      affectingTasks: (e.affecting_tasks as string[]) || [],
      frequency: e.frequency || 1,
      category: e.category,
      evidence_snippets: (e.evidence_snippets || []) as EvidenceSnippet[],
    })) || [];

  // Count findings by severity
  const findingCounts: { a: FindingCounts; b: FindingCounts } = {
    a: countBySeverity(findingsA),
    b: countBySeverity(findingsB),
  };

  // Match findings between runs
  const matches = matchFindings(findingsA, findingsB);
  const matchedBIds = new Set(matches.values());

  // Find resolved (in A, not in B)
  const resolved = findingsA.filter((f) => !matches.has(f.id));

  // Find new (in B, not matched from A)
  const newFindings = findingsB.filter((f) => !matchedBIds.has(f.id));

  // Find regressions (matched findings that got worse)
  const regressions: Regression[] = [];
  for (const [findingAId, findingBId] of matches.entries()) {
    const findingA = findingsA.find((f) => f.id === findingAId)!;
    const findingB = findingsB.find((f) => f.id === findingBId)!;

    const severityOrderA = getSeverityOrder(findingA.severity);
    const severityOrderB = getSeverityOrder(findingB.severity);
    const frequencyA = findingA.frequency || 1;
    const frequencyB = findingB.frequency || 1;

    // Regression if severity increased OR frequency increased significantly
    if (
      severityOrderB > severityOrderA ||
      (frequencyB > frequencyA && frequencyB >= frequencyA * 1.5)
    ) {
      regressions.push({
        finding: findingB,
        severityChange: compareSeverity(findingA.severity, findingB.severity),
        frequencyChange:
          frequencyB > frequencyA
            ? `${frequencyA} → ${frequencyB} (${Math.round(((frequencyB - frequencyA) / frequencyA) * 100)}% increase)`
            : undefined,
      });
    }
  }

  // Extract confusion hotspots from both runs
  const allFindings = [...findingsA, ...findingsB];
  const confusionHotspots = extractHotspots(allFindings);

  return {
    runA: { id: runAId },
    runB: { id: runBId },
    findingCounts,
    resolved,
    newFindings,
    regressions,
    confusionHotspots,
  };
}
