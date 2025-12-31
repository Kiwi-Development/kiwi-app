-- ============================================================================
-- Database Schema Migration for Design Intelligence Platform
-- ============================================================================
-- Run this to add new columns to existing tables
-- ============================================================================

-- Add semantic_context column to test_runs (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_runs' AND column_name = 'semantic_context'
  ) THEN
    ALTER TABLE test_runs ADD COLUMN semantic_context JSONB;
  END IF;
END $$;

-- Add knowledge_citations column to feedback_entries (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback_entries' AND column_name = 'knowledge_citations'
  ) THEN
    ALTER TABLE feedback_entries ADD COLUMN knowledge_citations JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add developer_outputs column to feedback_entries (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback_entries' AND column_name = 'developer_outputs'
  ) THEN
    ALTER TABLE feedback_entries ADD COLUMN developer_outputs JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

