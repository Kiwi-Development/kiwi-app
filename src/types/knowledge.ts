/**
 * Knowledge chunk category
 */
export type KnowledgeCategory =
  | "ux_laws"
  | "wcag"
  | "growth_patterns"
  | "design_principles"
  | "nielsen_heuristics"
  | "kiwi_rubric";

/**
 * Knowledge chunk metadata
 */
export interface KnowledgeChunkMetadata extends Record<string, unknown> {
  level?: string; // e.g., "A", "AA", "AAA" for WCAG
}

/**
 * Knowledge chunk
 */
export interface KnowledgeChunk {
  id: string;
  content: string;
  category: KnowledgeCategory;
  source: string;
  title: string;
  metadata: KnowledgeChunkMetadata;
  similarity?: number;
}
