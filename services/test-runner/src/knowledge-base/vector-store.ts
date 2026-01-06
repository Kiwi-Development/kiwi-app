/**
 * Vector Store Client for Knowledge Base
 *
 * Handles vector similarity search using Supabase pgvector
 */

import type { ConnectionConfig } from "../config/connections.js";
import { createSupabaseClient } from "../storage/supabase-client.js";
import type { KnowledgeChunk } from "../reasoning/types.js";

/**
 * Search knowledge chunks by embedding similarity
 */
export async function searchKnowledgeChunks(
  queryEmbedding: number[],
  options: {
    category?: string;
    threshold?: number;
    limit?: number;
  } = {},
  config?: ConnectionConfig
): Promise<KnowledgeChunk[]> {
  const { category, threshold = 0.7, limit = 10 } = options;

  if (!config) {
    throw new Error("Connection config required for vector store operations");
  }

  const supabase = createSupabaseClient(config);

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
      throw error;
    }

    if (!data) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      category: row.category,
      source: row.source,
      title: row.title,
      content: row.content,
      embedding: row.embedding,
    }));
  } catch (error) {
    console.error("Error searching knowledge chunks:", error);
    throw error;
  }
}

/**
 * Get a knowledge chunk by ID
 */
export async function getKnowledgeChunkById(
  id: string,
  config?: ConnectionConfig
): Promise<KnowledgeChunk | null> {
  if (!config) {
    throw new Error("Connection config required for vector store operations");
  }

  const supabase = createSupabaseClient(config);

  try {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      category: data.category,
      source: data.source,
      title: data.title,
      content: data.content,
      embedding: data.embedding,
    };
  } catch (error) {
    console.error("Error getting knowledge chunk:", error);
    throw error;
  }
}

