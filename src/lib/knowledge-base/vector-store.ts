/**
 * Vector Store Client for Knowledge Base
 *
 * Handles vector similarity search using Supabase pgvector
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

import type { KnowledgeChunk } from "@/types";
import type { KnowledgeChunkRow } from "@/types/database";

// Re-export for backwards compatibility
export type { KnowledgeChunk };

/**
 * Search knowledge chunks by embedding similarity
 */
export async function searchKnowledgeChunks(
  queryEmbedding: number[],
  options: {
    category?: KnowledgeChunk["category"];
    threshold?: number;
    limit?: number;
  } = {}
): Promise<KnowledgeChunk[]> {
  const { category, threshold = 0.7, limit = 10 } = options;

  try {
    // Use the database function for vector search
    // PostgreSQL vector type expects array format
    const embeddingArray = `[${queryEmbedding.join(",")}]`;

    const query = supabase.rpc("search_knowledge_chunks", {
      query_embedding: embeddingArray,
      match_category: category || null,
      match_threshold: threshold,
      match_count: limit,
    });

    const { data, error } = await query;

    if (error) {
      // Error searching knowledge chunks
      throw error;
    }

    return (data || []).map(
      (row: KnowledgeChunkRow): KnowledgeChunk => ({
        id: row.id,
        content: row.content,
        category: row.category as KnowledgeChunk["category"],
        source: row.source,
        title: row.title,
        metadata: (row.metadata || {}) as KnowledgeChunk["metadata"],
        similarity: row.similarity,
      })
    );
  } catch (error) {
    console.error("Error in searchKnowledgeChunks:", error);
    return [];
  }
}

/**
 * Get knowledge chunk by ID
 */
export async function getKnowledgeChunkById(id: string): Promise<KnowledgeChunk | null> {
  try {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching knowledge chunk:", error);
      return null;
    }

    return {
      id: data.id,
      content: data.content,
      category: data.category,
      source: data.source,
      title: data.title,
      metadata: data.metadata || {},
    };
  } catch (error) {
    console.error("Error in getKnowledgeChunkById:", error);
    return null;
  }
}
