/**
 * Synthesis and Debate Logic
 * 
 * Synthesizes findings from multiple agents, prioritizes issues, and validates findings
 */

import { AgentFinding } from './orchestrator';

export interface SynthesisResult {
  allFindings: AgentFinding[];
  highPriority: AgentFinding[];
  mediumPriority: AgentFinding[];
  lowPriority: AgentFinding[];
  summary: string;
}

/**
 * Synthesize findings from all agents
 * 
 * - Removes duplicates
 * - Validates findings (requires agreement from multiple agents or high confidence)
 * - Prioritizes by severity and impact
 */
export function synthesizeFindings(findings: AgentFinding[]): SynthesisResult {
  // Group findings by similarity (same issue detected by multiple agents)
  const grouped = groupSimilarFindings(findings);

  // Validate findings (require high confidence or multiple agent agreement)
  const validated = validateFindings(grouped);

  // Sort by priority
  const sorted = sortByPriority(validated);

  // Categorize by severity
  const highPriority = sorted.filter(f => f.severity === 'High');
  const mediumPriority = sorted.filter(f => f.severity === 'Med');
  const lowPriority = sorted.filter(f => f.severity === 'Low');

  // Generate summary
  const summary = generateSummary(sorted);

  return {
    allFindings: sorted,
    highPriority,
    mediumPriority,
    lowPriority,
    summary,
  };
}

/**
 * Group similar findings together
 */
function groupSimilarFindings(findings: AgentFinding[]): AgentFinding[] {
  const groups: AgentFinding[][] = [];
  const processed = new Set<number>();

  for (let i = 0; i < findings.length; i++) {
    if (processed.has(i)) continue;

    const group = [findings[i]];
    processed.add(i);

    // Find similar findings
    for (let j = i + 1; j < findings.length; j++) {
      if (processed.has(j)) continue;

      if (areFindingsSimilar(findings[i], findings[j])) {
        group.push(findings[j]);
        processed.add(j);
      }
    }

    groups.push(group);
  }

  // Merge groups into single findings
  return groups.map(mergeFindings);
}

/**
 * Check if two findings are similar (same issue)
 */
function areFindingsSimilar(f1: AgentFinding, f2: AgentFinding): boolean {
  // Same element selector
  if (f1.elementSelector && f2.elementSelector && f1.elementSelector === f2.elementSelector) {
    return true;
  }

  // Similar titles (fuzzy match)
  const title1 = f1.title.toLowerCase();
  const title2 = f2.title.toLowerCase();
  if (title1 === title2 || title1.includes(title2) || title2.includes(title1)) {
    return true;
  }

  // Overlapping descriptions
  const desc1 = f1.description.toLowerCase();
  const desc2 = f2.description.toLowerCase();
  const words1 = new Set(desc1.split(/\s+/));
  const words2 = new Set(desc2.split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const similarity = intersection.size / Math.max(words1.size, words2.size);
  
  return similarity > 0.5; // 50% word overlap
}

/**
 * Merge multiple findings about the same issue
 */
function mergeFindings(findings: AgentFinding[]): AgentFinding {
  if (findings.length === 1) {
    return findings[0];
  }

  // Use the finding with highest confidence as base
  const base = findings.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  // Merge citations
  const allCitations = new Map<string, AgentFinding['citations'][0]>();
  findings.forEach(f => {
    f.citations.forEach(citation => {
      const key = `${citation.source}-${citation.title}`;
      if (!allCitations.has(key)) {
        allCitations.set(key, citation);
      }
    });
  });

  // Increase confidence if multiple agents agree
  const confidenceBoost = findings.length > 1 ? Math.min(10 * (findings.length - 1), 20) : 0;
  const mergedConfidence = Math.min(base.confidence + confidenceBoost, 100);

  // Use highest severity
  const severities = ['Low', 'Med', 'High'];
  const maxSeverity = findings.reduce((max, f) => {
    const maxIdx = severities.indexOf(max);
    const fIdx = severities.indexOf(f.severity);
    return fIdx > maxIdx ? f.severity : max;
  }, base.severity);

  return {
    ...base,
    confidence: mergedConfidence,
    severity: maxSeverity,
    citations: Array.from(allCitations.values()),
    description: `${base.description}\n\n[Validated by ${findings.length} specialist${findings.length > 1 ? 's' : ''}]`,
  };
}

/**
 * Validate findings - filter out low-confidence findings unless multiple agents agree
 */
function validateFindings(findings: AgentFinding[]): AgentFinding[] {
  return findings.filter(finding => {
    // High confidence findings are always valid
    if (finding.confidence >= 80) {
      return true;
    }

    // Medium confidence with citations are valid
    if (finding.confidence >= 60 && finding.citations.length > 0) {
      return true;
    }

    // Low confidence findings need multiple citations or high severity
    if (finding.confidence >= 50 && (finding.citations.length >= 2 || finding.severity === 'High')) {
      return true;
    }

    // Filter out low-confidence, uncited findings
    return false;
  });
}

/**
 * Sort findings by priority
 */
function sortByPriority(findings: AgentFinding[]): AgentFinding[] {
  const severityWeight: Record<'Blocker' | 'High' | 'Med' | 'Low', number> = { Blocker: 4, High: 3, Med: 2, Low: 1 };
  
  return [...findings].sort((a, b) => {
    // First by severity
    const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by confidence
    const confidenceDiff = b.confidence - a.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;

    // Then by number of citations (more citations = more validated)
    return b.citations.length - a.citations.length;
  });
}

/**
 * Generate summary of findings
 */
function generateSummary(findings: AgentFinding[]): string {
  if (findings.length === 0) {
    return 'No significant issues found.';
  }

  const highCount = findings.filter(f => f.severity === 'High').length;
  const medCount = findings.filter(f => f.severity === 'Med').length;
  const lowCount = findings.filter(f => f.severity === 'Low').length;

  const parts: string[] = [];

  if (highCount > 0) {
    parts.push(`${highCount} high-priority issue${highCount > 1 ? 's' : ''}`);
  }
  if (medCount > 0) {
    parts.push(`${medCount} medium-priority issue${medCount > 1 ? 's' : ''}`);
  }
  if (lowCount > 0) {
    parts.push(`${lowCount} low-priority issue${lowCount > 1 ? 's' : ''}`);
  }

  return `Found ${findings.length} issue${findings.length > 1 ? 's' : ''}: ${parts.join(', ')}.`;
}

