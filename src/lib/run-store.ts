import type { LiveRunState, SemanticContext } from "@/types";
import { supabase } from "./supabase";

type ActiveRun = {
  testId: string;
  sessionId: string;
  state: LiveRunState;
  agentHistory: Array<{ role: string; content?: string }>;
  lastUpdated: number;
};

class RunStore {
  private storageKey = "kiwi_active_runs";

  // Get active run from localStorage (ephemeral, for in-progress runs)
  getActiveRun(testId: string): ActiveRun | undefined {
    if (typeof window === "undefined") return undefined;
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return undefined;

    const runs: Record<string, ActiveRun> = JSON.parse(stored);
    const run = runs[testId];

    // Optional: Expire runs older than X hours?
    // For now, let's keep them until explicitly cleared or overwritten.
    return run;
  }

  // Save active run to localStorage (ephemeral, for in-progress runs)
  saveRun(testId: string, data: Omit<ActiveRun, "lastUpdated">) {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(this.storageKey);
    const runs: Record<string, ActiveRun> = stored ? JSON.parse(stored) : {};

    runs[testId] = {
      ...data,
      lastUpdated: Date.now(),
    };

    localStorage.setItem(this.storageKey, JSON.stringify(runs));
  }

  clearRun(testId: string) {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return;

    const runs: Record<string, ActiveRun> = JSON.parse(stored);
    delete runs[testId];

    localStorage.setItem(this.storageKey, JSON.stringify(runs));
  }

  // Create a test_run record upfront (before starting simulation)
  async createTestRun(
    testId: string,
    personaVersionId: string,
    totalTasks: number
  ): Promise<string | null> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return null;
      }

      const insertData = {
        test_id: testId,
        persona_version_id: personaVersionId,
        status: "queued" as const,
        progress_percent: 0,
        completed_tasks: 0,
        total_tasks: totalTasks > 0 ? totalTasks : 1,
        started_at: null,
        completed_at: null,
        duration_seconds: null,
        action_count: 0,
        task_completion_percentage: null,
        general_feedback: null,
        next_steps: null,
        events: [],
        logs: [],
        semantic_context: null,
      };

      const { data, error } = await supabase.from("test_runs").insert(insertData).select().single();

      if (error) {
        console.error("Error creating test run:", error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error("Error in createTestRun:", error);
      return null;
    }
  }

  // Update test_run status and progress
  async updateTestRun(
    testRunId: string,
    updates: {
      status?: "queued" | "running" | "completed" | "needs-validation" | "error";
      progress_percent?: number;
      started_at?: string;
      action_count?: number;
    }
  ): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return false;
      }

      const { error } = await supabase.from("test_runs").update(updates).eq("id", testRunId);

      if (error) {
        console.error("Error updating test run:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in updateTestRun:", error);
      return false;
    }
  }

  // Save completed run to database (test_runs table)
  async saveCompletedRun(
    testId: string,
    personaVersionId: string,
    state: LiveRunState,
    sessionId: string
  ): Promise<string | null> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return null;
      }

      // Calculate duration from startedAt if duration not set
      const durationMs = state.duration || (state.startedAt ? Date.now() - state.startedAt : 0);
      const durationSeconds = durationMs > 0 ? Math.floor(durationMs / 1000) : null;
      const taskCompletionPercentage =
        state.steps.length > 0
          ? (state.steps.filter((s) => s.pass).length / state.steps.length) * 100
          : null;

      const totalTasks = state.steps.length || 0;
      const completedTasks = state.steps.filter((s) => s.pass).length;
      const actionCount = state.events.filter((e) => e.type === "click").length;

      // Extract semantic context if available
      const semanticContext =
        (state as LiveRunState & { semanticContext?: SemanticContext }).semanticContext || null;

      const insertData = {
        test_id: testId,
        persona_version_id: personaVersionId,
        status: state.status === "completed" ? "completed" : "error",
        progress_percent: state.personas[0]?.percent || 0,
        completed_tasks: completedTasks,
        total_tasks: totalTasks > 0 ? totalTasks : 1, // Ensure at least 1 to satisfy NOT NULL constraint
        started_at: state.startedAt ? new Date(state.startedAt).toISOString() : null,
        completed_at: state.status === "completed" ? new Date().toISOString() : null,
        duration_seconds: durationSeconds,
        action_count: actionCount,
        task_completion_percentage: taskCompletionPercentage,
        general_feedback:
          (state as LiveRunState & { generalFeedback?: string }).generalFeedback || null,
        next_steps:
          (
            state as LiveRunState & {
              nextSteps?: {
                userExperience?: string[];
                informationArchitecture?: string[];
                accessibility?: string[];
              } | null;
            }
          ).nextSteps || null,
        events: state.events || [],
        logs: state.logs || [],
        semantic_context: semanticContext, // Store semantic context
      };

      console.log("Inserting test run with data:", {
        ...insertData,
        events: `[${insertData.events.length} events]`,
        logs: `[${insertData.logs.length} logs]`,
      });

      const { data, error } = await supabase.from("test_runs").insert(insertData).select().single();

      if (error) {
        console.error("Error saving completed run:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        return null;
      }

      if (!data) {
        console.error("No data returned from insert, but no error");
        return null;
      }

      console.log("Test run saved successfully:", data.id);
      return data.id;
    } catch (error) {
      console.error("Error in saveCompletedRun:", error);
      return null;
    }
  }
}

export const runStore = new RunStore();
