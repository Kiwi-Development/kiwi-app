/**
 * Embeddings Generation
 * 
 * Generates embeddings using OpenAI's text-embedding-ada-002 model
 */

import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Generate embedding for a text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    // Error generating embedding
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: batch,
      });

      embeddings.push(...response.data.map(item => item.embedding));
    } catch (error) {
      // Error generating embeddings for batch
      // Return empty embeddings for failed batch
      embeddings.push(...batch.map(() => []));
    }
  }

  return embeddings;
}

