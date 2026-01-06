/**
 * Knowledge Base Retrieval
 * 
 * Retrieves relevant knowledge chunks for agents with formatted context
 */

import { generateEmbedding } from "./embeddings.js";
import { searchKnowledgeChunks, getKnowledgeChunkById } from "./vector-store.js";
import type { KnowledgeChunk } from "../reasoning/types.js";
import type { ConnectionConfig } from "../config/connections.js";

export interface Citation {
  chunkId: string;
  source: string;
  title: string;
  category: string;
  content: string;
  similarity?: number;
}

export interface RetrievalResult {
  chunks: KnowledgeChunk[];
  citations: Citation[];
  context: string; // Formatted context for agent prompts
}

/**
 * Retrieve knowledge chunks relevant to an issue
 * Returns formatted result with citations and context string
 */
export async function retrieveKnowledgeForIssue(
  issueDescription: string,
  category?: string,
  config?: ConnectionConfig
): Promise<RetrievalResult> {
  if (!config) {
    throw new Error("Connection config required for knowledge retrieval");
  }

  const embedding = await generateEmbedding(issueDescription, config);
  const chunks = await searchKnowledgeChunks(
    embedding,
    {
      category: category as any,
      threshold: 0.7,
      limit: 5,
    },
    config
  );

  // Format citations
  const citations: Citation[] = chunks.map((chunk) => ({
    chunkId: chunk.id,
    source: chunk.source,
    title: chunk.title,
    category: chunk.category,
    content: chunk.content,
    similarity: chunk.similarity,
  }));

  // Format context string for agent prompts
  const context = citations
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.title} (${citation.category}): ${citation.content}`
    )
    .join("\n\n");

  return {
    chunks,
    citations,
    context: context || "No relevant knowledge chunks found.",
  };
}

/**
 * Get a specific knowledge chunk by ID
 */
export async function getKnowledgeChunk(
  id: string,
  config?: ConnectionConfig
): Promise<KnowledgeChunk | null> {
  if (!config) {
    throw new Error("Connection config required for knowledge retrieval");
  }
  return await getKnowledgeChunkById(id, config);
}
