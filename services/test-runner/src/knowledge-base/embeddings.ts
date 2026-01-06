/**
 * Embeddings Generation
 *
 * Generates embeddings using OpenAI's text-embedding-ada-002 model
 */

import { OpenAI } from "openai";
import type { ConnectionConfig } from "../config/connections.js";

/**
 * Generate embedding for a text string
 */
export async function generateEmbedding(
  text: string,
  config?: ConnectionConfig
): Promise<number[]> {
  if (!config) {
    throw new Error("Connection config required for embeddings");
  }

  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
  });

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config?: ConnectionConfig,
  batchSize: number = 100
): Promise<number[][]> {
  if (!config) {
    throw new Error("Connection config required for embeddings");
  }

  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
  });

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: batch,
      });

      embeddings.push(...response.data.map((item) => item.embedding));
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i}:`, error);
      throw error;
    }
  }

  return embeddings;
}

