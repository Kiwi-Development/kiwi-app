/**
 * Knowledge Base Ingestion Script
 * 
 * Reads knowledge files and ingests them into Supabase with embeddings.
 * Run this script to populate the knowledge_chunks table.
 */

import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Get clients lazily to ensure env vars are loaded first
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support both new secret key format and legacy service_role key
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, supabaseSecretKey);
}

function getOpenAIClient() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }
  
  return new OpenAI({ apiKey: openaiApiKey });
}

interface KnowledgeChunk {
  content: string;
  category: 'ux_laws' | 'wcag' | 'growth_patterns' | 'design_principles' | 'nielsen_heuristics' | 'kiwi_rubric';
  source: string;
  title: string;
  metadata: Record<string, any>;
}

/**
 * Split markdown content into chunks
 */
function chunkContent(content: string, maxChunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const lines = content.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    // If adding this line would exceed max size, save current chunk
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  // Add remaining content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Parse markdown file and extract structured chunks
 */
function parseKnowledgeFile(filePath: string, category: KnowledgeChunk['category']): KnowledgeChunk[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const chunks: KnowledgeChunk[] = [];

  // Split by headers (## or ###)
  const sections = content.split(/(?=^##? )/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const headerMatch = lines[0].match(/^##? (.+)$/);
    
    if (!headerMatch) continue;

    const title = headerMatch[1];
    
    // Extract source if present (format: **Source:** ...)
    let source = title;
    const sourceMatch = section.match(/\*\*Source:\*\* (.+)/);
    if (sourceMatch) {
      source = sourceMatch[1].trim();
    }

    // Extract metadata
    const metadata: Record<string, any> = {};
    
    // Extract level if present (Level A, AA, AAA)
    const levelMatch = section.match(/Level ([A-Z]+)/);
    if (levelMatch) {
      metadata.level = levelMatch[1];
    }

    // Extract category from content if present
    const categoryMatch = section.match(/\*\*Category:\*\* (.+)/);
    if (categoryMatch) {
      metadata.subcategory = categoryMatch[1].trim();
    }

    // Split large sections into smaller chunks
    const sectionChunks = chunkContent(section, 1000);

    for (let i = 0; i < sectionChunks.length; i++) {
      chunks.push({
        content: sectionChunks[i],
        category,
        source,
        title: sectionChunks.length > 1 ? `${title} (Part ${i + 1})` : title,
        metadata: {
          ...metadata,
          part: sectionChunks.length > 1 ? i + 1 : undefined,
          totalParts: sectionChunks.length > 1 ? sectionChunks.length : undefined,
        },
      });
    }
  }

  return chunks;
}

/**
 * Generate embedding for a chunk using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Ingest a knowledge file
 */
async function ingestKnowledgeFile(filePath: string, category: KnowledgeChunk['category']): Promise<void> {
  console.log(`\n📚 Ingesting ${filePath}...`);
  
  const chunks = parseKnowledgeFile(filePath, category);
  console.log(`   Found ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`   Processing chunk ${i + 1}/${chunks.length}: ${chunk.title}`);

    try {
      const supabase = getSupabaseClient();
      
      // Check if chunk already exists
      const { data: existing } = await supabase
        .from('knowledge_chunks')
        .select('id')
        .eq('content', chunk.content)
        .eq('category', chunk.category)
        .eq('source', chunk.source)
        .single();

      if (existing) {
        console.log(`   ⏭️  Skipping duplicate chunk`);
        continue;
      }

      // Generate embedding
      const embedding = await generateEmbedding(chunk.content);

      // Insert into database
      const { error } = await supabase
        .from('knowledge_chunks')
        .insert({
          content: chunk.content,
          embedding: `[${embedding.join(',')}]`, // Convert to PostgreSQL array format
          category: chunk.category,
          source: chunk.source,
          title: chunk.title,
          metadata: chunk.metadata,
        });

      if (error) {
        console.error(`   ❌ Error inserting chunk: ${error.message}`);
      } else {
        console.log(`   ✅ Inserted chunk`);
      }

      // Rate limiting - wait a bit between API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Error processing chunk: ${error}`);
    }
  }
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🚀 Starting knowledge base ingestion...\n');

  const knowledgeDir = path.join(__dirname, 'knowledge');

  // Ingest each knowledge file
  const files = [
    { file: 'ux-laws.md', category: 'ux_laws' as const },
    { file: 'wcag-guidelines.md', category: 'wcag' as const },
    { file: 'growth-patterns.md', category: 'growth_patterns' as const },
  ];

  for (const { file, category } of files) {
    const filePath = path.join(knowledgeDir, file);
    if (fs.existsSync(filePath)) {
      await ingestKnowledgeFile(filePath, category);
    } else {
      console.warn(`⚠️  File not found: ${filePath}`);
    }
  }

  console.log('\n✅ Knowledge base ingestion complete!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { ingestKnowledgeFile, generateEmbedding };

