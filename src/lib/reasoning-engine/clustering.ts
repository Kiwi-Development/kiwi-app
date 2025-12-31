/**
 * Finding Clustering and Deduplication
 * 
 * Groups similar findings across personas/tasks to avoid duplicates
 */

import { AgentFinding, EvidenceSnippet } from './orchestrator';
// Note: Embeddings removed - using simple string similarity for client-side clustering
// OpenAI API key is not available on client side (and shouldn't be exposed via NEXT_PUBLIC_)

export interface ClusteredFinding extends AgentFinding {
  frequency: number;
  triggered_by_tasks: string[];
  triggered_by_personas: string[];
  evidence_snippets: EvidenceSnippet[];
  clustered_finding_id?: string; // ID of the canonical finding if this is a duplicate
}

/**
 * Calculate similarity between two findings
 * 
 * Note: On the client side, we use simple string similarity since OpenAI API key
 * is not available (and should not be exposed via NEXT_PUBLIC_ prefix for security).
 * For better clustering, this could be moved to a server-side API route.
 */
async function calculateFindingSimilarity(
  finding1: AgentFinding,
  finding2: AgentFinding
): Promise<number> {
  // Always use simple string similarity on client side (no API key available)
  // This is safe and doesn't require server-side API calls
  const text1 = `${finding1.title} ${finding1.description} ${finding1.suggestedFix || ''}`.toLowerCase();
  const text2 = `${finding2.title} ${finding2.description} ${finding2.suggestedFix || ''}`.toLowerCase();
  
  return simpleStringSimilarity(text1, text2);
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Simple string similarity (Jaccard similarity on words)
 */
function simpleStringSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Cluster findings by similarity
 * Groups similar findings together and creates canonical findings
 */
export async function clusterFindings(
  findings: AgentFinding[],
  evidenceSnippets: Map<string, EvidenceSnippet[]>, // Map of finding index to evidence snippets
  tasks: string[],
  personaName: string
): Promise<ClusteredFinding[]> {
  if (findings.length === 0) return [];

  const clustered: ClusteredFinding[] = [];
  const processed = new Set<number>();
  // Lower threshold for simple string similarity (Jaccard) vs embeddings
  // Jaccard similarity typically gives lower scores than cosine similarity on embeddings
  const similarityThreshold = 0.6; // 60% similarity to consider duplicates

  for (let i = 0; i < findings.length; i++) {
    if (processed.has(i)) continue;

    const currentFinding = findings[i];
    const cluster: number[] = [i];
    processed.add(i);

    // Find similar findings
    for (let j = i + 1; j < findings.length; j++) {
      if (processed.has(j)) continue;

      // Quick check: same category and similar severity
      if (
        currentFinding.category === findings[j].category &&
        Math.abs(
          severityToNumber(currentFinding.severity) - severityToNumber(findings[j].severity)
        ) <= 1
      ) {
        const similarity = await calculateFindingSimilarity(currentFinding, findings[j]);
        
        if (similarity >= similarityThreshold) {
          cluster.push(j);
          processed.add(j);
        }
      }
    }

    // Create clustered finding from the cluster
    if (cluster.length === 1) {
      // Single finding, no duplicates
      // Preserve evidence_snippets from the finding itself (already attached)
      clustered.push({
        ...currentFinding,
        frequency: 1,
        triggered_by_tasks: currentFinding.affectingTasks,
        triggered_by_personas: [personaName],
        evidence_snippets: currentFinding.evidence_snippets || evidenceSnippets.get(i.toString()) || [],
      });
    } else {
      // Multiple similar findings - merge into one canonical finding
      const clusterFindings = cluster.map(idx => findings[idx]);
      
      // Use the finding with highest confidence as the canonical one
      const canonical = clusterFindings.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      // Merge evidence snippets from all findings in the cluster
      const allEvidence: EvidenceSnippet[] = [];
      cluster.forEach((idx) => {
        // Get evidence from the finding itself (already attached) or from the map
        const finding = findings[idx];
        const findingEvidence = finding.evidence_snippets || [];
        const mapEvidence = evidenceSnippets.get(idx.toString()) || [];
        // Combine evidence, avoiding duplicates
        [...findingEvidence, ...mapEvidence].forEach(ev => {
          if (!allEvidence.some(existing => 
            existing.persona_name === ev.persona_name && 
            existing.task_context === ev.task_context &&
            JSON.stringify(existing.what_happened_steps) === JSON.stringify(ev.what_happened_steps)
          )) {
            allEvidence.push(ev);
          }
        });
      });

      // Merge triggered tasks and personas
      const allTasks = new Set<string>();
      clusterFindings.forEach(f => {
        f.affectingTasks.forEach(t => allTasks.add(t));
      });

      clustered.push({
        ...canonical,
        frequency: cluster.length,
        triggered_by_tasks: Array.from(allTasks),
        triggered_by_personas: [personaName], // Will be merged across runs later
        evidence_snippets: allEvidence,
      });
    }
  }

  return clustered;
}

/**
 * Convert severity to number for comparison
 */
function severityToNumber(severity: 'Blocker' | 'High' | 'Med' | 'Low'): number {
  const map: Record<string, number> = {
    'Blocker': 4,
    'High': 3,
    'Med': 2,
    'Low': 1,
  };
  return map[severity] || 2;
}

