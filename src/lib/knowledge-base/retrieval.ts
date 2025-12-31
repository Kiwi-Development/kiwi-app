/**
 * RAG Retrieval System
 *
 * Retrieves relevant knowledge chunks with citation support for agents
 */

import { generateEmbedding } from "./embeddings";
import { searchKnowledgeChunks, getKnowledgeChunkById, KnowledgeChunk } from "./vector-store";

export interface Citation {
  chunkId: string;
  source: string;
  title: string;
  category: string;
  content: string;
  similarity: number;
}

export interface RetrievalResult {
  chunks: KnowledgeChunk[];
  citations: Citation[];
  context: string; // Formatted context for agent prompts
}

/**
 * Retrieve relevant knowledge chunks for a query
 */
export async function retrieveKnowledge(
  query: string,
  options: {
    category?: KnowledgeChunk["category"];
    threshold?: number;
    limit?: number;
  } = {}
): Promise<RetrievalResult> {
  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Search knowledge base
    const chunks = await searchKnowledgeChunks(queryEmbedding, options);

    // Format citations
    const citations: Citation[] = chunks.map((chunk) => ({
      chunkId: chunk.id,
      source: chunk.source,
      title: chunk.title,
      category: chunk.category,
      content: chunk.content,
      similarity: chunk.similarity || 0,
    }));

    // Format context for agent prompts
    const context = formatContextForAgent(chunks);

    return {
      chunks,
      citations,
      context,
    };
  } catch (error) {
    console.error("Error retrieving knowledge:", error);
    return {
      chunks: [],
      citations: [],
      context: "",
    };
  }
}

/**
 * Format knowledge chunks into context string for agent prompts
 */
function formatContextForAgent(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return "";
  }

  const sections = chunks.map((chunk, index) => {
    const citation = `[${index + 1}] ${chunk.source} - ${chunk.title}`;
    return `${citation}\n${chunk.content}\n`;
  });

  return `\n=== RELEVANT DESIGN KNOWLEDGE ===\n\n${sections.join("\n---\n\n")}\n\n=== END KNOWLEDGE ===\n`;
}

/**
 * Retrieve knowledge for a specific design issue
 */
export async function retrieveKnowledgeForIssue(
  issueDescription: string,
  issueCategory?: "ux" | "accessibility" | "conversion"
): Promise<RetrievalResult> {
  // Map issue category to knowledge category
  // For UX issues, search across multiple relevant categories
  const categoryMap: Record<string, KnowledgeChunk["category"] | null> = {
    ux: null, // Search all UX-related categories
    accessibility: "wcag",
    conversion: "growth_patterns",
  };

  const knowledgeCategory = issueCategory ? categoryMap[issueCategory] : undefined;

  return retrieveKnowledge(issueDescription, {
    category: knowledgeCategory || undefined, // Convert null to undefined
    threshold: 0.7,
    limit: 5,
  });
}

/**
 * Format citations for inclusion in findings
 */
export function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) {
    return "";
  }

  return citations
    .map((citation, index) => {
      return `[${index + 1}] ${citation.source} - ${citation.title} (${citation.category})`;
    })
    .join("\n");
}

/**
 * Get citation objects for database storage
 */
export function getCitationObjects(citations: Citation[]): Array<{
  chunk_id: string;
  source: string;
  title: string;
  category: string;
}> {
  return citations.map((citation) => ({
    chunk_id: citation.chunkId,
    source: citation.source,
    title: citation.title,
    category: citation.category,
  }));
}
