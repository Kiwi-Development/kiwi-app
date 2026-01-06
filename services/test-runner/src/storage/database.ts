/**
 * Database Client
 * 
 * Handles database operations for test runs
 */

import { createSupabaseClient } from "./supabase-client.js";
import type { ConnectionConfig } from "../config/connections.js";

export interface TestRunRecord {
  id: string;
  test_id: string;
  status: "queued" | "running" | "completed" | "error";
  persona_version_id: string; // Required field
  browserbase_session_id?: string;
  started_at?: string;
  completed_at?: string;
  general_feedback?: string; // Can be used to store error messages
  created_at: string;
  updated_at: string;
}

export interface TestRecord {
  id: string;
  title: string;
  goal: string;
  tasks: string[];
  url: string;
  live_url: string | null;
  figma_url_a: string | null;
  figma_url_b: string | null;
  persona_id?: string; // May be in heuristics.selectedPersona instead
  heuristics?: {
    selectedPersona?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface PersonaRecord {
  id: string;
  name: string;
  role: string;
  goals: string[];
  behaviors: string[];
  frustrations: string[];
  constraints: string[];
  accessibility: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Database client for test run operations
 */
export class DatabaseClient {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /**
   * Get test by ID
   */
  async getTest(testId: string): Promise<TestRecord | null> {
    const supabase = createSupabaseClient(this.config);
    const { data, error } = await supabase
      .from("tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw error;
    }

    const test = data as TestRecord;
    
    // Extract persona_id from heuristics if not directly on test
    if (!test.persona_id && test.heuristics?.selectedPersona) {
      test.persona_id = test.heuristics.selectedPersona;
    }

    // Determine URL (prefer live_url, fallback to figma_url_a)
    if (!test.url) {
      test.url = test.live_url || test.figma_url_a || "";
    }

    return test;
  }

  /**
   * Get persona by ID
   */
  async getPersona(personaId: string): Promise<PersonaRecord | null> {
    const supabase = createSupabaseClient(this.config);
    const { data, error } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw error;
    }

    return data as PersonaRecord;
  }

  /**
   * Get current persona version ID for a persona
   * First tries to use personas.current_version_id, then falls back to querying persona_versions
   */
  async getPersonaVersionId(personaId: string): Promise<string | null> {
    const supabase = createSupabaseClient(this.config);
    
    // First, try to get current_version_id from personas table
    const { data: personaData, error: personaError } = await supabase
      .from("personas")
      .select("current_version_id")
      .eq("id", personaId)
      .single();

    if (!personaError && personaData?.current_version_id) {
      return personaData.current_version_id;
    }

    // Fallback: Get the latest persona version from persona_versions table
    const { data: versionData, error: versionError } = await supabase
      .from("persona_versions")
      .select("id")
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionError) {
      console.error("Error getting persona version:", versionError);
      return null;
    }

    if (!versionData) {
      console.warn(`No persona version found for persona_id: ${personaId}`);
      return null;
    }

    return versionData.id;
  }

  /**
   * Create test run record
   */
  async createTestRun(testId: string, personaVersionId: string, totalTasks: number): Promise<TestRunRecord> {
    const supabase = createSupabaseClient(this.config);
    
    const insertData = {
      test_id: testId,
      status: "queued" as const,
      persona_version_id: personaVersionId,
      total_tasks: totalTasks,
    };

    const { data, error } = await supabase
      .from("test_runs")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as TestRunRecord;
  }

  /**
   * Update test status
   */
  async updateTest(testId: string, updates: { status?: "draft" | "queued" | "running" | "completed" | "needs-validation" | "error" }): Promise<void> {
    const supabase = createSupabaseClient(this.config);
    const { error } = await supabase
      .from("tests")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", testId);

    if (error) {
      throw error;
    }
  }

  /**
   * Update test run status and browserbase session ID
   */
  async updateTestRun(
    testRunId: string,
    updates: {
      status?: TestRunRecord["status"];
      browserbase_session_id?: string;
      general_feedback?: string; // Can be used to store error messages
      started_at?: string;
      completed_at?: string;
      completed_tasks?: number;
      task_completion_percentage?: number;
      duration_seconds?: number;
      action_count?: number;
      logs?: Array<{ t: number; text: string; type?: "reasoning" | "action" }>;
      events?: Array<{ id: string; type: string; label: string; details?: string; stepIndex?: number; t: number }>;
    }
  ): Promise<TestRunRecord> {
    const supabase = createSupabaseClient(this.config);
    const { data, error } = await supabase
      .from("test_runs")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", testRunId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as TestRunRecord;
  }

  /**
   * Get test runs by test ID
   */
  async getTestRunsByTestId(testId: string, limit?: number): Promise<TestRunRecord[]> {
    const supabase = createSupabaseClient(this.config);
    let query = supabase
      .from("test_runs")
      .select("*")
      .eq("test_id", testId)
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as TestRunRecord[];
  }

  /**
   * Get test run by ID
   */
  async getTestRun(testRunId: string): Promise<TestRunRecord | null> {
    const supabase = createSupabaseClient(this.config);
    const { data, error } = await supabase
      .from("test_runs")
      .select("*")
      .eq("id", testRunId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw error;
    }

    return data as TestRunRecord;
  }

  /**
   * Save findings to database
   */
  async saveFindings(testRunId: string, findings: any[], personaVersionId: string): Promise<void> {
    const supabase = createSupabaseClient(this.config);

    // Map severity to valid enum values (Blocker, High, Med, Low)
    const normalizeSeverity = (severity: string | undefined): "Blocker" | "High" | "Med" | "Low" => {
      if (!severity) return "Med";
      const normalized = severity.trim();
      if (normalized === "N/A" || normalized === "n/a" || normalized === "na") {
        return "Med"; // Default to Med for N/A values
      }
      // Check if it's a valid enum value
      if (["Blocker", "High", "Med", "Low"].includes(normalized)) {
        return normalized as "Blocker" | "High" | "Med" | "Low";
      }
      // Try to map common variations
      const lower = normalized.toLowerCase();
      if (lower.includes("blocker") || lower.includes("critical")) return "Blocker";
      if (lower.includes("high") || lower === "3") return "High";
      if (lower.includes("med") || lower.includes("medium") || lower === "2") return "Med";
      if (lower.includes("low") || lower === "1") return "Low";
      // Default to Med if we can't determine
      return "Med";
    };

    // Insert findings into findings table (or test_runs.findings JSON column)
    // For now, we'll use the feedback_entries table structure
    const findingsToInsert = findings.map((finding) => ({
      test_run_id: testRunId,
      persona_version_id: personaVersionId, // Required field
      title: finding.title,
      severity: normalizeSeverity(finding.severity),
      confidence: finding.confidence,
      category: finding.category,
      description: finding.description,
      suggested_fix: finding.suggestedFix,
      evidence_snippets: finding.evidenceSnippets || [],
      affecting_tasks: finding.affectingTasks || finding.triggeredByTasks || [],
      triggered_by_personas: finding.triggeredByPersonas || [],
      knowledge_citations: finding.knowledgeCitations || [],
      developer_outputs: finding.developerOutputs || null,
    }));

    const { error } = await supabase
      .from("feedback_entries")
      .insert(findingsToInsert);

    if (error) {
      throw error;
    }
  }

  /**
   * Get findings for a test run
   */
  async getFindings(testRunId: string): Promise<any[]> {
    const supabase = createSupabaseClient(this.config);
    const { data, error } = await supabase
      .from("feedback_entries")
      .select("*")
      .eq("test_run_id", testRunId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Map database findings to AgentFinding format
    return (data || []).map((f) => ({
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
      confidence_level: f.confidence >= 70 ? "High" : f.confidence >= 40 ? "Med" : "Low",
      description: f.description,
      suggestedFix: f.suggested_fix,
      affectingTasks: f.affecting_tasks || [],
      triggeredByTasks: f.affecting_tasks || [],
      triggeredByPersonas: f.triggered_by_personas || [],
      category: f.category,
      evidenceSnippets: f.evidence_snippets || [],
      knowledgeCitations: f.knowledge_citations || [],
      developerOutputs: f.developer_outputs || null,
    }));
  }
}

