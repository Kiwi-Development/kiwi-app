-- ============================================================================
-- Knowledge Base Schema for Design Intelligence Platform
-- ============================================================================
-- This extends the main database schema with vector search capabilities
-- Execute this after the main database_schema.sql
-- ============================================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Chunks Table
-- Stores structured knowledge (UX laws, WCAG guidelines, growth patterns) as embeddings
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embedding dimension
  category TEXT NOT NULL CHECK (category IN ('ux_laws', 'wcag', 'growth_patterns', 'design_principles', 'nielsen_heuristics', 'kiwi_rubric')),
  source TEXT NOT NULL, -- e.g., "Hick's Law", "WCAG 2.1.1", "Conversion Optimization"
  title TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (level, tags, references, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(content, category, source) -- Prevent duplicate chunks
);

-- Index for vector similarity search
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Index for category filtering
CREATE INDEX idx_knowledge_chunks_category ON knowledge_chunks(category);

-- Index for source lookup
CREATE INDEX idx_knowledge_chunks_source ON knowledge_chunks(source);

-- Full-text search index on content
CREATE INDEX idx_knowledge_chunks_content_fts ON knowledge_chunks 
  USING gin(to_tsvector('english', content));

-- Enable RLS
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read knowledge chunks
CREATE POLICY "Knowledge chunks are readable by authenticated users"
  ON knowledge_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Only service role can insert/update/delete (for knowledge ingestion)
-- Note: This assumes you'll use service role for knowledge ingestion
-- If you want to allow specific users, adjust this policy
CREATE POLICY "Knowledge chunks are writable by service role"
  ON knowledge_chunks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS knowledge_chunks_updated_at ON knowledge_chunks;
CREATE TRIGGER knowledge_chunks_updated_at
  BEFORE UPDATE ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_chunks_updated_at();

-- Function for vector similarity search
-- Returns top N most similar chunks for a given embedding
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  query_embedding vector(1536),
  match_category TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  source TEXT,
  title TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.category,
    kc.source,
    kc.title,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE 
    kc.embedding IS NOT NULL
    AND (match_category IS NULL OR kc.category = match_category)
    AND (1 - (kc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

