import { supabase } from "./supabase";

type Test = {
  id: string;
  title: string;
  status: "draft" | "queued" | "running" | "completed" | "needs-validation" | "error";
  lastRun: string;
  personas: string[];
  artifactType: string;
  successRate?: number;
  avgTime?: string;
  createdAt: number;
  testData?: {
    testName: string;
    goal: string;
    selectedPersona: string;
    runCount?: number;
    tasks: string[];
    figmaUrlA?: string;
    figmaUrlB?: string;
    liveUrl?: string;
  };
  progressState?: {
    completedPersonas: number;
    totalPersonas: number;
    startTime: number;
    estimatedDuration: number; // in milliseconds
  };
  feedback?: string;
  findings?: {
    title: string;
    severity: "High" | "Med" | "Low";
    confidence: number;
    description: string;
    suggestedFix: string;
    affectingTasks: string[];
  }[];
  nextSteps?: {
    userExperience: string[];
    informationArchitecture: string[];
    accessibility: string[];
  };
  duration?: number; // in milliseconds
  actionCount?: number;
  completedAt?: number;
  heuristics?: {
    visibility?: boolean;
    realWorld?: boolean;
    userControl?: boolean;
    errorPrevention?: boolean;
    recognition?: boolean;
    consistency?: boolean;
    a11y?: boolean;
    selectedPersona?: string;
    [key: string]: unknown;
  };
};

// Database test type
type DatabaseTest = {
  id: string;
  title: string;
  status: "draft" | "queued" | "running" | "completed" | "needs-validation" | "error";
  user_id: string;
  organization_id: string | null;
  goal: string | null;
  use_case: string | null;
  artifact_type: string;
  figma_url_a: string | null;
  figma_url_b: string | null;
  live_url: string | null;
  tasks: string[];
  heuristics: Record<string, boolean>;
  success_rate: number | null;
  avg_time_seconds: number | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

class TestStore {
  private formatLastRun(date: string | null): string {
    if (!date) return "Never";
    const runDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - runDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return runDate.toLocaleDateString();
  }

  private formatAvgTime(seconds: number | null): string {
    if (!seconds) return "";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  // Convert database test to app test
  private async dbToAppTest(db: DatabaseTest): Promise<Test> {
    // Get latest test run for additional data
    const { data: latestRun } = await supabase
      .from("test_runs")
      .select("id, general_feedback, next_steps, duration_seconds, action_count, completed_at")
      .eq("test_id", db.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get feedback entries (findings) if we have a run
    let feedbackEntries = null;
    if (latestRun?.id) {
      const { data } = await supabase
        .from("feedback_entries")
        .select("*")
        .eq("test_run_id", latestRun.id)
        .order("created_at", { ascending: false });
      feedbackEntries = data;
    }

    const findings =
      feedbackEntries?.map((fe) => ({
        title: fe.title,
        severity: fe.severity as "High" | "Med" | "Low",
        confidence: fe.confidence,
        description: fe.description,
        suggestedFix: fe.suggested_fix || "",
        affectingTasks: (fe.affecting_tasks as string[]) || [],
      })) || [];

    // Use avg_time_seconds from tests table (aggregated by trigger) if available,
    // otherwise fall back to latest run's duration_seconds
    const durationSeconds = db.avg_time_seconds || latestRun?.duration_seconds || null;
    const duration = durationSeconds ? durationSeconds * 1000 : undefined;

    return {
      id: db.id,
      title: db.title,
      status: db.status,
      lastRun: this.formatLastRun(db.last_run_at),
      personas: [], // Will be populated from test_runs if needed
      artifactType: db.artifact_type,
      successRate: db.success_rate || undefined,
      avgTime: this.formatAvgTime(db.avg_time_seconds),
      createdAt: new Date(db.created_at).getTime(),
      testData: {
        testName: db.title,
        goal: db.goal || "",
        selectedPersona: (db.heuristics as { selectedPersona?: string })?.selectedPersona || "",
        runCount: (db.heuristics as { runCount?: number })?.runCount || 1,
        tasks: db.tasks || [],
        figmaUrlA: db.figma_url_a || undefined,
        figmaUrlB: db.figma_url_b || undefined,
        liveUrl: db.live_url || undefined,
      },
      feedback: latestRun?.general_feedback || undefined,
      findings: findings.length > 0 ? findings : undefined,
      nextSteps: (latestRun?.next_steps as Test["nextSteps"]) || undefined,
      duration: duration,
      actionCount: latestRun?.action_count || undefined,
      completedAt: latestRun?.completed_at ? new Date(latestRun.completed_at).getTime() : undefined,
    };
  }

  async getTests(): Promise<Test[]> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return [];

      // RLS will handle the filtering automatically
      // Explicitly filter out soft-deleted tests
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .is("deleted_at", null)
        .eq("user_id", session.user.id) // Also filter by user_id for safety
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[getTests] Error fetching tests:", error);
        return [];
      }

      // Log for debugging
      if (data && data.length > 0) {
        console.log(`[getTests] Found ${data.length} tests (excluding soft-deleted)`);
        // Check if any have deleted_at set (shouldn't happen due to filter, but good to verify)
        const withDeletedAt = data.filter((t) => t.deleted_at !== null);
        if (withDeletedAt.length > 0) {
          console.warn(
            "[getTests] WARNING: Found tests with deleted_at in results:",
            withDeletedAt
          );
        }
      }

      const tests = await Promise.all((data || []).map((t) => this.dbToAppTest(t as DatabaseTest)));
      return tests;
    } catch (error) {
      console.error("Error in getTests:", error);
      return [];
    }
  }

  async getTestById(id: string): Promise<Test | undefined> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return undefined;

      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        console.error("Error fetching test:", error);
        return undefined;
      }

      return await this.dbToAppTest(data as DatabaseTest);
    } catch (error) {
      console.error("Error in getTestById:", error);
      return undefined;
    }
  }

  async saveTest(test: Test): Promise<Test | null> {
    try {
      // Use getSession() instead of getUser() for client-side code
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated");
        return null;
      }

      const testData = test.testData;
      // Merge heuristics from test object (if provided) with selectedPersona
      const heuristics = test.heuristics || {};
      const dbTest = {
        title: test.title,
        status: test.status,
        user_id: session.user.id,
        organization_id: null, // Can be set later
        goal: testData?.goal || null,
        use_case: null, // Deprecated field, kept for database compatibility
        artifact_type: test.artifactType,
        figma_url_a: testData?.figmaUrlA || null,
        figma_url_b: testData?.figmaUrlB || null,
        live_url: testData?.liveUrl || null,
        tasks: testData?.tasks || [],
        heuristics: {
          ...heuristics,
          selectedPersona: testData?.selectedPersona || null,
          runCount: testData?.runCount || 1,
        },
        success_rate: test.successRate || null,
        avg_time_seconds: test.avgTime ? parseInt(test.avgTime) : null,
      };

      let result;
      // Check if test ID is a valid UUID (from database) or a timestamp (from old localStorage)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        test.id
      );

      if (test.id && isUuid) {
        // Update existing test (UUID from database)
        const { data, error } = await supabase
          .from("tests")
          .update(dbTest)
          .eq("id", test.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating test:", error);
          return null;
        }
        result = data;
      } else {
        // Create new test
        const { data, error } = await supabase.from("tests").insert(dbTest).select().single();

        if (error) {
          console.error("Error creating test:", error);
          return null;
        }
        result = data;
      }

      return await this.dbToAppTest(result as DatabaseTest);
    } catch (error) {
      console.error("Error in saveTest:", error);
      return null;
    }
  }

  async updateTestProgress(
    id: string,
    completedPersonas: number,
    totalPersonas: number
  ): Promise<void> {
    try {
      const successRate =
        totalPersonas > 0 ? Math.round((completedPersonas / totalPersonas) * 100) : 0;

      const status = completedPersonas >= totalPersonas ? "completed" : "running";

      const { error } = await supabase
        .from("tests")
        .update({
          success_rate: successRate,
          status: status,
        })
        .eq("id", id);

      if (error) {
        console.error("Error updating test progress:", error);
      }
    } catch (error) {
      console.error("Error in updateTestProgress:", error);
    }
  }

  async deleteTest(id: string): Promise<boolean> {
    try {
      // Verify user is authenticated
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("User not authenticated for delete");
        return false;
      }

      console.log(`[deleteTest] Starting delete for test ID: ${id}, user: ${session.user.id}`);

      // First verify the test exists and belongs to the user
      const { data: existingTest, error: checkError } = await supabase
        .from("tests")
        .select("id, user_id")
        .eq("id", id)
        .single();

      if (checkError || !existingTest) {
        console.error("[deleteTest] Test not found or error checking:", checkError);
        return false;
      }

      if (existingTest.user_id !== session.user.id) {
        console.error("[deleteTest] User does not own this test");
        return false;
      }

      // Always hard delete - the database has ON DELETE CASCADE for test_runs,
      // so related records will be automatically deleted
      console.log("[deleteTest] Attempting hard delete (will cascade delete test_runs)");
      const { data, error } = await supabase
        .from("tests")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id)
        .select();

      if (error) {
        console.error("[deleteTest] Error hard deleting test:", error);
        console.error("[deleteTest] Error details:", JSON.stringify(error, null, 2));
        return false;
      }

      // Check if anything was actually deleted
      if (!data || data.length === 0) {
        console.warn(
          "[deleteTest] No test was deleted - may not exist or user doesn't have permission"
        );
        return false;
      }

      console.log("[deleteTest] Test hard deleted successfully:", id);
      console.log("[deleteTest] Deleted test data:", data[0]);
      return true;
    } catch (error) {
      console.error("[deleteTest] Error in deleteTest:", error);
      return false;
    }
  }
}

export const testStore = new TestStore();
export type { Test };
