/**
 * Database row types for Supabase queries
 * These represent the raw database structure
 */

/**
 * Feedback entry from database
 */
export interface FeedbackEntryRow {
  id: string;
  test_run_id: string;
  title: string;
  severity: "Blocker" | "High" | "Med" | "Low";
  confidence: number;
  description: string;
  suggested_fix?: string | null;
  affecting_tasks?: string[] | null;
  frequency?: number | null;
  category?: string | null;
  evidence_snippets?: unknown[] | null;
  created_at?: string;
  [key: string]: unknown; // Allow additional database fields
}

/**
 * Test run row from database
 */
export interface TestRunRow {
  id: string;
  test_id: string;
  status: string;
  created_at?: string;
  task_completion_percentage?: number;
  duration_seconds?: number;
  action_count?: number;
  [key: string]: unknown; // Allow additional database fields
}

/**
 * Knowledge chunk row from database
 */
export interface KnowledgeChunkRow {
  id: string;
  content: string;
  category: string;
  source: string;
  title: string;
  metadata?: Record<string, unknown> | null;
  similarity?: number;
  [key: string]: unknown; // Allow additional database fields
}
