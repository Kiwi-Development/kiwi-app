-- Migration: Add browserbase_session_id column to test_runs table
-- Date: 2025-01-XX
-- Description: Adds browserbase_session_id column to store Browserbase session IDs for session re-attachment

-- Add browserbase_session_id column
ALTER TABLE test_runs
ADD COLUMN IF NOT EXISTS browserbase_session_id TEXT;

-- Create index on browserbase_session_id for performance (queries on session start)
CREATE INDEX IF NOT EXISTS idx_test_runs_browserbase_session_id 
ON test_runs(browserbase_session_id);

-- Add comment to column
COMMENT ON COLUMN test_runs.browserbase_session_id IS 'Browserbase session ID for re-attaching to existing browser sessions after backend restart';


