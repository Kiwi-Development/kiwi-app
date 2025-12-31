-- ============================================================================
-- Knowledge Base Category Migration
-- ============================================================================
-- Run this to add new categories (nielsen_heuristics, kiwi_rubric) to existing
-- knowledge_chunks table
-- ============================================================================

-- Drop the existing check constraint
ALTER TABLE knowledge_chunks 
  DROP CONSTRAINT IF EXISTS knowledge_chunks_category_check;

-- Add the new check constraint with additional categories
ALTER TABLE knowledge_chunks 
  ADD CONSTRAINT knowledge_chunks_category_check 
  CHECK (category IN ('ux_laws', 'wcag', 'growth_patterns', 'design_principles', 'nielsen_heuristics', 'kiwi_rubric'));

