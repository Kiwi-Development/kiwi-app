"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "../../../../components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Share2 } from "lucide-react";
import { PersonaProgressList } from "./components/persona-progress-list";
import { LiveLog } from "./components/live-log";
import { EventTimeline } from "./components/event-timeline";
import { SideTabs } from "./components/side-tabs";
import type { LiveRunState, RunEvent, ScreenshotResponse, FindingCategory } from "@/types";
import { useToast } from "../../../../hooks/use-toast";
import { testStore, type Test } from "../../../../lib/test-store";
import { personaStore } from "../../../../lib/persona-store";
import { runStore } from "../../../../lib/run-store";
import { supabase } from "../../../../lib/supabase";
import type { ClusteredFinding } from "../../../../lib/reasoning-engine/clustering";
import type { EvidenceSnippet } from "../../../../lib/reasoning-engine/orchestrator";

type EnhancedFinding = ClusteredFinding & {
  developerOutputs?: Record<string, unknown>;
};
import {
  proxyScreenshot,
  proxyClick,
  startSession,
  extractContext,
  fetchFigmaMetadata,
} from "../../../proxy-actions";

const statusColors: Record<string, string> = {
  queued: "bg-slate-500 text-slate-50",
  running: "bg-blue-500 text-blue-50",
  completed: "bg-green-500 text-green-50",
  "needs-validation": "bg-amber-500 text-amber-50",
  error: "bg-red-500 text-red-50",
};

const statusLabels: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  "needs-validation": "Needs Validation",
  error: "Error",
};

interface SemanticContext {
  dom_tree: unknown | null;
  accessibility_tree: unknown | null;
  page_metadata: unknown | null;
  figma_metadata: unknown | null;
}

export default function LiveRunPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string>();
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const simulationRef = useRef(false);
  const semanticContextRef = useRef<SemanticContext | null>(null); // Store semantic context for reasoning engine

  const testId = params.id as string;

  // Helper function to calculate ETA based on past runs
  const calculateETA = async (testId: string): Promise<string | null> => {
    try {
      const { data: pastRuns, error } = await supabase
        .from("test_runs")
        .select("duration_seconds")
        .eq("test_id", testId)
        .eq("status", "completed")
        .not("duration_seconds", "is", null)
        .order("created_at", { ascending: false })
        .limit(5); // Use last 5 runs for average

      if (error || !pastRuns || pastRuns.length === 0) {
        return null; // Return null for first run (will be handled in UI)
      }

      // Calculate average duration
      const totalSeconds = pastRuns.reduce((sum, run) => sum + (run.duration_seconds || 0), 0);
      const avgSeconds = Math.round(totalSeconds / pastRuns.length);
      const avgMinutes = Math.round(avgSeconds / 60);

      if (avgMinutes < 1) {
        return "~1 min";
      } else if (avgMinutes < 60) {
        return `~${avgMinutes} min`;
      } else {
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
      }
    } catch (error) {
      console.error("Error calculating ETA:", error);
      return null; // Return null for first run or errors
    }
  };

  // Initialize state with deterministic default to prevent hydration mismatch
  const [state, setState] = useState<LiveRunState>({
    runId: testId,
    title: "Loading...",
    status: "running",
    startedAt: 0,
    etaLabel: null, // Will be updated when test loads
    personas: [],
    events: [],
    logs: [],
    steps: [],
    tags: [],
    consoleTrace: [],
  });

  const sessionIdRef = useRef<string | null>(null);
  const agentHistoryRef = useRef<Array<{ role: string; content?: string }>>([]);
  const startedAtRef = useRef<number>(Date.now());
  const findingsRef = useRef<{
    findings: Array<{
      title: string;
      severity: "High" | "Med" | "Low";
      confidence?: number;
      description?: string;
      suggestedFix?: string;
      affectingTasks?: string[];
    }>;
    feedback: string;
    successRate: number;
    nextSteps: {
      userExperience?: string[];
      informationArchitecture?: string[];
      accessibility?: string[];
    } | null;
  } | null>(null);

  // FIX: New Ref to track the unique ID of the currently active loop
  const activeExecutionIdRef = useRef<string>("");

  // Load initial state from store or create new
  useEffect(() => {
    const activeRun = runStore.getActiveRun(testId);

    if (activeRun && activeRun.state.status === "running") {
      setState(activeRun.state);
      agentHistoryRef.current = activeRun.agentHistory;
      sessionIdRef.current = activeRun.sessionId;
      if (activeRun.state.startedAt) {
        startedAtRef.current = activeRun.state.startedAt;
      }

      // If it was running, resume the loop
      if (!simulationRef.current) {
        simulationRef.current = true;
        setIsSimulating(true);
        // Resume with correct progress
        const initialProgress = activeRun.state.personas[0]?.percent || 0;
        runSimulation(true, initialProgress);
      }
    } else {
      // Initialize from test data
      const loadTest = async () => {
        try {
          const test = await testStore.getTestById(testId);

          if (!test) {
            toast({
              title: "Test not found",
              description: "Could not load test data",
              variant: "destructive",
            });
            return;
          }

          if (test.status === "completed") {
            router.push(`/dashboard/reports/${testId}`);
            return;
          }

          const allPersonas = await personaStore.getPersonas();

          let personas = test.testData?.selectedPersona
            ? (() => {
                const p = allPersonas.find(
                  (persona) => persona.id === test.testData?.selectedPersona
                );
                return p
                  ? [
                      {
                        id: test.testData.selectedPersona,
                        name: p.name,
                        variant: p.role,
                        status: "queued" as const,
                        percent: 0,
                      },
                    ]
                  : [];
              })()
            : [];

          // If no persona found but we have personas available, use the first one as fallback
          if (personas.length === 0 && allPersonas.length > 0) {
            const fallbackPersona = allPersonas[0];
            personas = [
              {
                id: fallbackPersona.id,
                name: fallbackPersona.name,
                variant: fallbackPersona.role,
                status: "queued" as const,
                percent: 0,
              },
            ];

            // Update the test with the selected persona
            if (test.testData) {
              test.testData.selectedPersona = fallbackPersona.id;
              await testStore.saveTest(test);
            }

            toast({
              title: "Persona auto-selected",
              description: `Using "${fallbackPersona.name}" for this test`,
            });
          } else if (personas.length === 0) {
            toast({
              title: "No persona found",
              description: "The test's persona could not be loaded. Please create a persona first.",
              variant: "destructive",
            });
          }

          const steps =
            test.testData?.tasks?.map((task, index) => ({
              index,
              title: task,
            })) || [];

          const startTime = Date.now();
          startedAtRef.current = startTime;

          // Calculate ETA based on past runs
          const estimatedETA = await calculateETA(testId);

          setState({
            runId: testId,
            title: test.title,
            status: "running",
            startedAt: startTime,
            etaLabel: estimatedETA,
            personas,
            events: [],
            logs: [],
            steps,
            tags: [],
            consoleTrace: [],
          });
        } catch (error) {
          toast({
            title: "Error loading test",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      };
      loadTest();
    }

    // Cleanup on unmount
    return () => {
      simulationRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Save state changes to store
  useEffect(() => {
    if (state.status === "running" && sessionIdRef.current) {
      runStore.saveRun(testId, {
        testId,
        sessionId: sessionIdRef.current,
        state,
        agentHistory: agentHistoryRef.current,
      });
    } else if (state.status === "completed" || state.status === "error") {
      // Optional: clear run when completed?
      // runStore.clearRun(testId)
      // For now, let's keep it so they can see the final state if they navigate back
      if (sessionIdRef.current) {
        runStore.saveRun(testId, {
          testId,
          sessionId: sessionIdRef.current,
          state,
          agentHistory: agentHistoryRef.current,
        });
      }
    }
  }, [state, testId]);

  // Helper function to run a single simulation for a specific test_run (background execution)
  const runSingleSimulation = async (
    testRunId: string,
    testId: string,
    figmaUrl: string,
    tasks: string[],
    test: Test | null,
    personaVersionId: string,
    runIndex: number
  ) => {
    try {
      console.log(`[Run ${runIndex + 1}] Starting simulation for test_run ${testRunId}`);

      // Update test_run to 'running'
      await runStore.updateTestRun(testRunId, {
        status: "running",
        started_at: new Date().toISOString(),
      });

      // Start unique session for this run
      console.log(`[LiveRunPage] About to call startSession with figmaUrl: ${figmaUrl}`);
      let startData;
      try {
        startData = await startSession(figmaUrl);
        console.log(`[LiveRunPage] startSession succeeded:`, startData);
      } catch (error) {
        console.error(`[LiveRunPage] startSession failed:`, error);
        throw error;
      }
      const sessionId = startData.sessionId;

      // Wait for server to be ready (optimized: check immediately, then with exponential backoff)
      let serverReady = false;
      const maxHealthChecks = 5; // Reduced from 10

      // First check immediately (session might already be ready)
      try {
        const immediateCheck = await proxyScreenshot(sessionId);
        if (immediateCheck.status === "ok") {
          serverReady = true;
        }
      } catch {
        // Continue to retry loop
      }

      // If not ready, retry with shorter intervals
      if (!serverReady) {
        for (let i = 0; i < maxHealthChecks; i++) {
          // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 2000ms
          const waitTime = Math.min(200 * Math.pow(2, i), 2000);
          await new Promise((r) => setTimeout(r, waitTime));

          try {
            const healthCheck = await proxyScreenshot(sessionId);
            if (healthCheck.status === "ok") {
              serverReady = true;
              break;
            }
            // If session not found, it might not be ready yet, continue waiting
            if (healthCheck.code === "SESSION_NOT_FOUND" && i < maxHealthChecks - 1) {
              continue;
            }
          } catch {
            // Continue waiting
          }
        }
      }

      if (!serverReady) {
        throw new Error("Server failed to become ready");
      }

      // Get persona data from database to get variant and description
      let selectedPersonaData: {
        id: string;
        name: string;
        role: string | null;
        variant: string | null;
        attributes: Record<string, unknown> | null;
      } | null = null;
      if (test?.testData?.selectedPersona) {
        const { data: personaData } = await supabase
          .from("personas")
          .select("id, name, role, variant, attributes")
          .eq("id", test.testData.selectedPersona)
          .single();
        selectedPersonaData = personaData;
      }

      // Initialize state for this run
      const runState: LiveRunState = {
        runId: testRunId,
        title: test?.title || "Test Run",
        status: "running",
        startedAt: Date.now(),
        personas: selectedPersonaData
          ? [
              {
                id: selectedPersonaData.id,
                name: selectedPersonaData.name,
                variant: selectedPersonaData.variant || selectedPersonaData.role || "User",
                status: "running",
                percent: 0,
              },
            ]
          : [],
        events: [],
        logs: [],
        steps: tasks.map((task, idx) => ({ index: idx + 1, title: task })),
        tags: [],
        consoleTrace: [],
      };

      const runSemanticContext: SemanticContext = {
        dom_tree: null,
        accessibility_tree: null,
        page_metadata: null,
        figma_metadata: null,
      };

      // Try to fetch Figma metadata
      if (figmaUrl && figmaUrl.includes("figma.com")) {
        try {
          const figmaMeta = await fetchFigmaMetadata(figmaUrl);
          if (figmaMeta.status === "ok" && figmaMeta.metadata) {
            runSemanticContext.figma_metadata = figmaMeta.metadata;
          }
        } catch {
          console.log(`[Run ${runIndex + 1}] Figma metadata not available`);
        }
      }

      const runAgentHistory: Array<{ role: string; content?: string; tool_calls?: unknown }> = [];
      const runClickHistory: Array<{
        x: number;
        y: number;
        timestamp: number;
        screenshot: string;
      }> = [];
      let runCurrentProgress = 0;
      let runScreenshotIndex = 0;
      const runStartedAt = Date.now();

      // Main simulation loop for this run
      const DECISION_DELAY_MS = 3000;
      let lastDecisionTime = Date.now();

      while (runCurrentProgress < 100) {
        // Get screenshot
        const screenshotData = await proxyScreenshot(sessionId);
        if (screenshotData.status === "error" || !screenshotData.screenshot) {
          // If session not found, stop the background simulation
          if (screenshotData.code === "SESSION_NOT_FOUND") {
            console.error(
              `[Run ${runIndex + 1}] Session not found - stopping simulation:`,
              screenshotData.message
            );
            break;
          }

          // If screenshot timeout, retry a few times before continuing
          if (screenshotData.code === "SCREENSHOT_TIMEOUT") {
            console.warn(`[Run ${runIndex + 1}] Screenshot timeout, retrying...`);
            let retryCount = 0;
            let retrySuccess = false;
            while (retryCount < 2 && !retrySuccess) {
              await new Promise((r) => setTimeout(r, 2000 * (retryCount + 1)));
              const retryResult: ScreenshotResponse = await proxyScreenshot(sessionId);
              if (retryResult.status === "ok" && retryResult.screenshot) {
                // Success - continue with this screenshot
                const b64 = retryResult.screenshot;
                runScreenshotIndex++;
                retrySuccess = true;
                // Break out of the error handling and continue with normal flow
                break;
              }
              retryCount++;
            }

            if (!retrySuccess) {
              console.warn(
                `[Run ${runIndex + 1}] Screenshot timeout after retries, skipping this frame`
              );
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            // If retry succeeded, continue with normal flow (will process screenshot below)
          } else {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }

        const b64 = screenshotData.screenshot;
        runScreenshotIndex++;

        // Extract context periodically
        if (runScreenshotIndex % 5 === 0) {
          try {
            const contextData = await extractContext(sessionId);
            if (contextData.status === "ok" && contextData.context) {
              Object.assign(runSemanticContext, contextData.context);
            }
          } catch {
            // Continue without context
          }
        }

        // Check decision delay
        const now = Date.now();
        if (now - lastDecisionTime < DECISION_DELAY_MS) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        // Get agent decision
        const decideRes = await fetch(`/dashboard/runs/${testId}/api`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenshot: b64,
            tasks,
            history: runAgentHistory,
            persona: selectedPersonaData
              ? {
                  name: selectedPersonaData.name,
                  role: selectedPersonaData.role || selectedPersonaData.variant || "User",
                  variant: selectedPersonaData.variant || selectedPersonaData.role || "User",
                  description: selectedPersonaData.attributes?.description || null,
                }
              : null,
            currentProgress: runCurrentProgress,
            runIndex: runIndex, // Pass run index for variation
            goal: test?.testData?.goal || "", // Pass the test goal
          }),
        });

        const decision = await decideRes.json();
        lastDecisionTime = Date.now();

        if (decision.action === "tool_call") {
          const toolOutputs: Array<{ role: "tool"; tool_call_id: string; content: string }> = [];
          let shouldStop = false;

          for (const toolCall of decision.tool_calls) {
            if (toolCall.function.name === "click") {
              const args = JSON.parse(toolCall.function.arguments);

              if (args.rationale === "Done." || args.rationale === "Done") {
                shouldStop = true;
                break;
              }

              const clickX = Math.round(args.x);
              const clickY = Math.round(args.y);
              const recentClicks = runClickHistory.filter(
                (c) =>
                  Math.abs(c.x - clickX) < 10 &&
                  Math.abs(c.y - clickY) < 10 &&
                  Date.now() - c.timestamp < 30000
              );

              const screenshotBefore = b64;
              if (recentClicks.length >= 2) {
                const lastClick = recentClicks[recentClicks.length - 1];
                if (screenshotBefore === lastClick.screenshot) {
                  // Loop detected, skip
                  toolOutputs.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `ERROR: Clicked at (${clickX}, ${clickY}) multiple times but the screen did not change. Try a different approach.`,
                  });
                  runAgentHistory.push({
                    role: "system",
                    content: `WARNING: Click at (${clickX}, ${clickY}) had no effect. Try a different element.`,
                  });
                  continue;
                }
              }

              runState.events.push({
                id: Date.now().toString(),
                t: Date.now() - runStartedAt,
                type: "click",
                label: args.rationale || `Click at ${args.x}, ${args.y}`,
                personaId: runState.personas[0]?.id || "unknown",
              });

              await proxyClick(sessionId, args.x, args.y);
              await new Promise((r) => setTimeout(r, 1500));
              const screenshotAfter = await proxyScreenshot(sessionId);
              const newScreenshot = screenshotAfter.screenshot || screenshotBefore;

              runClickHistory.push({
                x: clickX,
                y: clickY,
                timestamp: Date.now(),
                screenshot: screenshotBefore || "",
              });

              if (runClickHistory.length > 10) {
                runClickHistory.shift();
              }

              const screenshotChanged = newScreenshot !== screenshotBefore;
              toolOutputs.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: screenshotChanged
                  ? "Clicked successfully. The screen has updated."
                  : "Clicked successfully",
              });
            } else if (toolCall.function.name === "submit_findings") {
              const args = JSON.parse(toolCall.function.arguments);
              const findings = args.findings || [];
              const feedback = args.generalFeedback || "Test completed.";
              const taskCompletionPercentage = Math.max(
                0,
                Math.min(100, args.taskCompletionPercentage ?? 0)
              );
              const nextSteps = args.nextSteps;

              // Enhance findings with reasoning engine if we have context
              let enhancedFindings = findings;
              if (runSemanticContext?.dom_tree || runSemanticContext?.accessibility_tree) {
                try {
                  const personaName = selectedPersonaData?.name || "User";
                  const personaRole =
                    selectedPersonaData?.role || selectedPersonaData?.variant || "User";

                  // Get full persona attributes for persona-specific analysis
                  const personaAttributes = selectedPersonaData?.attributes || {};
                  const fullPersona = {
                    name: personaName,
                    role: personaRole,
                    description: selectedPersonaData?.attributes?.description || null,
                    goals: (personaAttributes.goals as string[]) || [],
                    behaviors: (personaAttributes.behaviors as string[]) || [],
                    frustrations: (personaAttributes.frustrations as string[]) || [],
                    constraints: (personaAttributes.constraints as string[]) || [],
                    accessibility: (personaAttributes.accessibility as string[]) || [],
                    tags: (personaAttributes.tags as string[]) || [],
                  };

                  const reasoningResponse = await fetch(`/dashboard/runs/${testId}/reasoning`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      screenshot: b64,
                      semanticContext: runSemanticContext,
                      tasks,
                      persona: fullPersona,
                      currentProgress: runCurrentProgress,
                      useReasoningEngine: true,
                    }),
                  });

                  if (reasoningResponse.ok) {
                    const reasoningData = await reasoningResponse.json();
                    if (reasoningData.useReasoningEngine && reasoningData.findings) {
                      enhancedFindings = reasoningData.findings;
                    }
                  }
                } catch (error) {
                  console.error(`[Run ${runIndex + 1}] Error enhancing findings:`, error);
                }
              }

              // Capture evidence and cluster findings
              try {
                const { extractEvidenceFromRun } =
                  await import("../../../../lib/reasoning-engine/evidence-capture");
                const { clusterFindings } =
                  await import("../../../../lib/reasoning-engine/clustering");

                enhancedFindings = enhancedFindings.map((finding: EnhancedFinding) => {
                  const taskContext = finding.affectingTasks?.[0] || "General task";
                  const evidence = extractEvidenceFromRun(
                    runState.events,
                    selectedPersonaData?.name || "User",
                    selectedPersonaData?.role || selectedPersonaData?.variant || "User",
                    taskContext,
                    runScreenshotIndex,
                    finding.elementPosition
                      ? {
                          bounding_box: finding.elementPosition,
                          element_selector: finding.elementSelector,
                        }
                      : undefined,
                    runClickHistory, // Pass click history for detailed action sequences
                    runAgentHistory // Pass agent history for rationale/quotes
                  );
                  return {
                    ...finding,
                    evidence_snippets: [evidence],
                  };
                });

                const clusteredFindings = await clusterFindings(
                  enhancedFindings,
                  new Map(),
                  tasks,
                  selectedPersonaData?.name || "User"
                );
                enhancedFindings = clusteredFindings;
              } catch (error) {
                console.error(`[Run ${runIndex + 1}] Error clustering findings:`, error);
              }

              // Calculate completed steps
              const completedStepsCount = Math.round(
                (taskCompletionPercentage / 100) * tasks.length
              );
              const updatedSteps = runState.steps.map((step, index) => ({
                ...step,
                pass: index < completedStepsCount,
              }));

              runState.steps = updatedSteps;
              runState.status = "completed";
              runState.duration = Date.now() - runStartedAt;
              runCurrentProgress = 100;

              // Save this run
              const completedTasks = Math.round((taskCompletionPercentage / 100) * tasks.length);
              const updateData = {
                status: "completed" as const,
                progress_percent: 100,
                completed_tasks: completedTasks,
                total_tasks: tasks.length || 1,
                completed_at: new Date().toISOString(),
                duration_seconds: Math.floor((Date.now() - runStartedAt) / 1000),
                action_count: runState.events.filter((e) => e.type === "click").length,
                task_completion_percentage: taskCompletionPercentage,
                general_feedback: feedback || null,
                next_steps: nextSteps || null,
                events: runState.events || [],
                logs: runState.logs || [],
                semantic_context: runSemanticContext,
              };

              const { error: updateError } = await supabase
                .from("test_runs")
                .update(updateData)
                .eq("id", testRunId);

              if (updateError) {
                console.error(`[Run ${runIndex + 1}] Error updating test_run:`, updateError);
              } else {
                console.log(`[Run ${runIndex + 1}] Test run completed successfully:`, testRunId);
              }

              // Save feedback entries
              if (enhancedFindings && enhancedFindings.length > 0) {
                // Helper function to normalize category to valid enum value
                const normalizeCategory = (
                  category: string | undefined
                ):
                  | "navigation"
                  | "copy"
                  | "affordance_feedback"
                  | "forms"
                  | "hierarchy"
                  | "accessibility"
                  | "conversion"
                  | "other" => {
                  if (!category) return "other";

                  const normalized = category.toLowerCase().trim();

                  // Map valid categories
                  if (
                    [
                      "navigation",
                      "copy",
                      "affordance_feedback",
                      "forms",
                      "hierarchy",
                      "accessibility",
                      "conversion",
                      "other",
                    ].includes(normalized)
                  ) {
                    return normalized as FindingCategory;
                  }

                  // Map heuristic-based categories to valid values
                  const heuristicMap: Record<
                    string,
                    | "navigation"
                    | "copy"
                    | "affordance_feedback"
                    | "forms"
                    | "hierarchy"
                    | "accessibility"
                    | "conversion"
                    | "other"
                  > = {
                    user_control_and_freedom: "affordance_feedback",
                    visibility_of_system_status: "affordance_feedback",
                    match_between_system_and_real_world: "copy",
                    consistency_and_standards: "navigation",
                    error_prevention: "forms",
                    recognition_rather_than_recall: "navigation",
                    flexibility_and_efficiency_of_use: "navigation",
                    aesthetic_and_minimalist_design: "hierarchy",
                    help_users_recognize_diagnose_and_recover_from_errors: "affordance_feedback",
                    help_and_documentation: "other",
                  };

                  // Check if it matches any heuristic name (with underscores, hyphens, or spaces)
                  const heuristicKey = normalized.replace(/[-\s]/g, "_");
                  if (heuristicMap[heuristicKey]) {
                    return heuristicMap[heuristicKey];
                  }

                  // Check if category contains heuristic keywords
                  for (const [heuristic, mappedCategory] of Object.entries(heuristicMap)) {
                    if (normalized.includes(heuristic) || heuristic.includes(normalized)) {
                      return mappedCategory;
                    }
                  }

                  // Default to "other" for unknown categories
                  return "other";
                };

                const feedbackEntries = enhancedFindings.map((finding: EnhancedFinding) => {
                  let severity = "Low";
                  const severityLower = finding.severity?.toLowerCase() || "low";
                  if (severityLower === "blocker") {
                    severity = "Blocker";
                  } else if (severityLower === "high") {
                    severity = "High";
                  } else if (severityLower === "med" || severityLower === "medium") {
                    severity = "Med";
                  }

                  return {
                    test_run_id: testRunId,
                    persona_version_id: personaVersionId,
                    title: finding.title || "Untitled Finding",
                    severity: severity,
                    confidence: finding.confidence ?? 0,
                    confidence_level:
                      finding.confidence >= 70 ? "High" : finding.confidence >= 40 ? "Med" : "Low",
                    category: normalizeCategory(finding.category),
                    description: finding.description || "",
                    suggested_fix: finding.suggestedFix || null,
                    affecting_tasks: finding.affectingTasks || [],
                    evidence_snippets: finding.evidence_snippets || null,
                    frequency: finding.frequency || 1,
                    triggered_by_tasks: finding.triggered_by_tasks || finding.affectingTasks || [],
                    triggered_by_personas: finding.triggered_by_personas || [],
                    knowledge_citations: finding.citations?.length > 0 ? finding.citations : null,
                    developer_outputs:
                      Object.keys(finding.developerOutputs || {}).length > 0
                        ? finding.developerOutputs
                        : null,
                  };
                });

                const { error: feedbackError } = await supabase
                  .from("feedback_entries")
                  .insert(feedbackEntries);

                if (feedbackError) {
                  console.error(
                    `[Run ${runIndex + 1}] Error saving feedback entries:`,
                    feedbackError
                  );
                } else {
                  console.log(
                    `[Run ${runIndex + 1}] Saved ${feedbackEntries.length} feedback entries`
                  );
                }
              }

              shouldStop = true;
            }
          }

          runAgentHistory.push({
            role: "assistant",
            content: undefined,
            tool_calls: decision.tool_calls,
          });
          runAgentHistory.push(...toolOutputs);

          if (shouldStop) {
            break;
          }
        }

        // Update progress
        runCurrentProgress = Math.min(runCurrentProgress + 2, 99);
      }

      console.log(`[Run ${runIndex + 1}] Simulation completed for test_run ${testRunId}`);
    } catch (error) {
      console.error(`[Run ${runIndex + 1}] Simulation error:`, error);
      // Update test_run to error status
      await runStore.updateTestRun(testRunId, {
        status: "error",
      });
    }
  };

  const runSimulation = async (isResuming = false, initialProgress = 0) => {
    // FIX: Generate a unique ID for this specific run
    const executionId = Date.now().toString() + Math.random().toString().slice(2, 6);
    activeExecutionIdRef.current = executionId;

    if (!isResuming && simulationRef.current) {
      // If we are trying to start a new one but one is technically "running",
      // the executionId logic will handle killing the old one, so we can proceed.
    }

    if (!isResuming) {
      simulationRef.current = true;
      setIsSimulating(true);
    }

    const test = await testStore.getTestById(testId);
    const tasks = test?.testData?.tasks || [];
    const figmaUrl = test?.testData?.figmaUrlA || test?.testData?.liveUrl;
    const runCount = test?.testData?.runCount || 1;

    // Initialize semantic context
    semanticContextRef.current = {
      dom_tree: null,
      accessibility_tree: null,
      page_metadata: null,
      figma_metadata: null,
    };

    // If it's a Figma URL, try to fetch metadata (optional)
    if (figmaUrl && figmaUrl.includes("figma.com")) {
      try {
        const figmaMeta = await fetchFigmaMetadata(figmaUrl);
        if (figmaMeta.status === "ok" && figmaMeta.metadata) {
          semanticContextRef.current.figma_metadata = figmaMeta.metadata;
        }
      } catch {
        console.log("Figma metadata not available, using DOM/A11y extraction");
      }
    }

    if (!figmaUrl) {
      toast({
        title: "Configuration Error",
        description: "No Figma URL found for this test.",
        variant: "destructive",
      });
      simulationRef.current = false;
      setIsSimulating(false);
      return;
    }

    let sessionId: string;

    // Get persona version ID for creating test_run records
    let personaVersionId: string | null = null;
    const testRunIds: string[] = [];
    if (!isResuming && test?.testData?.selectedPersona) {
      const { data: personaData } = await supabase
        .from("personas")
        .select("id, current_version_id")
        .eq("id", test.testData.selectedPersona)
        .single();

      personaVersionId = personaData?.current_version_id || null;

      // Create test_run records upfront (for both single and multiple runs)
      if (personaVersionId) {
        for (let i = 0; i < runCount; i++) {
          const testRunId = await runStore.createTestRun(testId, personaVersionId, tasks.length);
          if (testRunId) {
            testRunIds.push(testRunId);
            if (i === 0) {
              // Store first test_run ID for this run (for UI display)
              (window as Window & { __currentTestRunId?: string }).__currentTestRunId = testRunId;
            }
          }
        }
        console.log(`Created ${testRunIds.length} test_run record(s) for execution`);

        // Start additional runs in parallel (background) if runCount > 1
        if (runCount > 1) {
          testRunIds.forEach((testRunId, index) => {
            if (index > 0) {
              // Run additional simulations in background (index 0 is handled by main flow)
              runSingleSimulation(
                testRunId,
                testId,
                figmaUrl,
                tasks,
                test,
                personaVersionId!,
                index
              ).catch((error) => {
                console.error(`Error running simulation ${index + 1}:`, error);
              });
            }
          });
        }
      }
    }

    // Use static EC2 instance via Server Actions
    try {
      if (!isResuming) {
        // Set persona to running
        setState((prev) => ({
          ...prev,
          personas: prev.personas.map((p, idx) =>
            idx === 0 ? { ...p, status: "running" as const, percent: 0 } : p
          ),
        }));

        setState((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              t: Date.now(),
              text:
                runCount > 1 ? `Starting ${runCount} parallel runs...` : `Connecting to server...`,
            },
          ],
        }));

        // Start session on backend via Server Action
        // Main simulation is always run 0
        console.log(`[Main Run] About to call startSession with figmaUrl: ${figmaUrl}`);
        let startData;
        try {
          startData = await startSession(figmaUrl);
          console.log(`[Main Run] startSession succeeded:`, startData);
        } catch (error) {
          console.error(`[Main Run] startSession failed:`, error);
          throw error;
        }
        sessionId = startData.sessionId;
        sessionIdRef.current = sessionId;

        // Update first test_run to 'running' if we created it upfront
        const currentTestRunId = (window as Window & { __currentTestRunId?: string })
          .__currentTestRunId;
        if (personaVersionId && currentTestRunId) {
          await runStore.updateTestRun(currentTestRunId, {
            status: "running",
            started_at: new Date().toISOString(),
          });
        }

        setState((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            {
              t: Date.now(),
              text: `Browser session started`,
            },
          ],
        }));

        // Wait for server to be ready
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, { t: Date.now(), text: "Waiting for server to be ready..." }],
        }));

        // Optimized health check: immediate check, then exponential backoff
        let serverReady = false;
        const maxHealthChecks = 5; // Reduced from 10

        // First check immediately
        try {
          const immediateCheck = await proxyScreenshot(sessionId);
          if (immediateCheck.status === "ok") {
            serverReady = true;
          }
        } catch {
          // Continue to retry loop
        }

        // If not ready, retry with exponential backoff
        if (!serverReady) {
          for (let i = 0; i < maxHealthChecks; i++) {
            // FIX: Check execution ID during wait
            if (activeExecutionIdRef.current !== executionId) return;

            // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 2000ms
            const waitTime = Math.min(200 * Math.pow(2, i), 2000);
            await new Promise((r) => setTimeout(r, waitTime));

            try {
              // Use Server Action for screenshot/health check
              const healthCheck = await proxyScreenshot(sessionId);

              if (healthCheck.status === "ok") {
                serverReady = true;
                break;
              }

              // If session not found (410), the session might not be ready yet, continue waiting
              if (healthCheck.code === "SESSION_NOT_FOUND" && i < maxHealthChecks - 1) {
                // Session might not be created yet, continue waiting
                continue;
              }
            } catch {
              // Server not ready yet, continue waiting
            }
          }
        }

        if (!serverReady) {
          throw new Error("Server failed to become ready within timeout");
        }

        setState((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            { t: Date.now(), text: "✅ Server ready! Starting AI simulation..." },
          ],
        }));
      } else {
        // Resuming
        if (!sessionIdRef.current) {
          throw new Error("Cannot resume without session ID");
        }
        sessionId = sessionIdRef.current;

        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, { t: Date.now(), text: "🔄 Resuming simulation..." }],
        }));
      }
    } catch (error) {
      console.error("Failed to start ECS task:", error);

      // FIX: Don't update state if this thread is dead
      if (activeExecutionIdRef.current !== executionId) return;

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Server Start Failed",
        description: errorMessage,
        variant: "destructive",
      });

      setState((prev) => ({
        ...prev,
        status: "error",
        personas: prev.personas.map((p, idx) =>
          idx === 0 ? { ...p, status: "error" as const } : p
        ),
        logs: [
          ...prev.logs,
          {
            t: Date.now(),
            text: `❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      }));

      simulationRef.current = false;
      setIsSimulating(false);
      return;
    }

    // Start progress tracking
    let currentProgress = initialProgress;
    const progressIncrement = 2;

    // Helper to handle completion
    const handleCompletion = async (feedback?: string) => {
      clearInterval(progressInterval);

      const finalState = {
        ...stateRef.current,
        status: "completed" as const,
        personas: stateRef.current.personas.map((p, idx) =>
          idx === 0 ? { ...p, status: "completed" as const, percent: 100 } : p
        ),
        duration: Date.now() - startedAtRef.current,
      };

      setState(finalState);

      const test = await testStore.getTestById(testId);
      if (test && test.testData?.selectedPersona) {
        // Get the persona's current_version_id
        const { data: personaData, error: personaError } = await supabase
          .from("personas")
          .select("id, current_version_id, name, role, variant, attributes")
          .eq("id", test.testData.selectedPersona)
          .single();

        if (personaError) {
          console.error("Error fetching persona version:", personaError);
        }

        let personaVersionId = personaData?.current_version_id;

        // If no version ID is set on the persona, check if a version exists or create one
        if (!personaVersionId && personaData) {
          console.log("No current_version_id found, checking for existing versions...");

          // First, check if a version already exists (might have been created but not linked)
          const { data: existingVersion, error: checkError } = await supabase
            .from("persona_versions")
            .select("id, version_number")
            .eq("persona_id", personaData.id)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (checkError) {
            console.error("Error checking for existing persona version:", checkError);
          }

          if (existingVersion) {
            // Version exists but persona wasn't linked to it - update the persona
            console.log("Found existing persona version, linking to persona:", existingVersion.id);
            const { error: updateError } = await supabase
              .from("personas")
              .update({ current_version_id: existingVersion.id })
              .eq("id", personaData.id);

            if (updateError) {
              console.error("Error updating persona with existing version ID:", updateError);
            } else {
              personaVersionId = existingVersion.id;
              console.log("Linked existing persona version:", personaVersionId);
            }
          } else {
            // No version exists, create one
            console.log("No version exists, creating new persona version...");
            const { data: newVersion, error: versionError } = await supabase
              .from("persona_versions")
              .insert({
                persona_id: personaData.id,
                version_number: 1,
                name: personaData.name,
                role: personaData.role,
                variant: personaData.variant,
                attributes: personaData.attributes || {},
              })
              .select()
              .single();

            if (versionError) {
              console.error("Error creating persona version:", versionError);
            } else if (newVersion) {
              // Update the persona with the new version ID
              const { error: updateError } = await supabase
                .from("personas")
                .update({ current_version_id: newVersion.id })
                .eq("id", personaData.id);

              if (updateError) {
                console.error("Error updating persona with version ID:", updateError);
              } else {
                personaVersionId = newVersion.id;
                console.log("Created and assigned persona version:", personaVersionId);
              }
            }
          }
        }

        if (!personaVersionId) {
          console.error(
            "No persona version ID found or created for persona:",
            test.testData.selectedPersona
          );
        }

        if (personaVersionId) {
          // Update finalState with findings if available
          const stateWithFindings = {
            ...finalState,
            generalFeedback: findingsRef.current?.feedback,
            taskCompletionPercentage: findingsRef.current?.successRate,
            nextSteps: findingsRef.current?.nextSteps,
          };

          console.log("Saving completed run with state:", {
            testId,
            personaVersionId,
            duration: stateWithFindings.duration,
            actionCount: stateWithFindings.events.filter((e) => e.type === "click").length,
            status: stateWithFindings.status,
          });

          // Save the completed test run to database (with semantic context)
          const stateWithContext = {
            ...stateWithFindings,
            semanticContext: semanticContextRef.current, // Include semantic context
          } as LiveRunState & { semanticContext?: SemanticContext };

          // Use existing test_run ID if we created it upfront, otherwise create new one
          let testRunId: string | null | undefined = (
            window as Window & { __currentTestRunId?: string }
          ).__currentTestRunId;
          if (!testRunId) {
            testRunId = await runStore.saveCompletedRun(
              testId,
              personaVersionId,
              stateWithContext,
              sessionIdRef.current || ""
            );
          } else {
            // Update existing test_run record
            const completedTasks = Math.round(
              ((findingsRef.current?.successRate ?? 0) / 100) *
                (stateWithFindings.steps?.length || 0)
            );
            const updateData = {
              status: "completed" as const,
              progress_percent: 100,
              completed_tasks: completedTasks,
              total_tasks: stateWithFindings.steps?.length || 1,
              completed_at: new Date().toISOString(),
              duration_seconds: stateWithFindings.duration
                ? Math.floor(stateWithFindings.duration / 1000)
                : null,
              action_count: stateWithFindings.events.filter((e) => e.type === "click").length,
              task_completion_percentage: findingsRef.current?.successRate ?? 0,
              general_feedback: findingsRef.current?.feedback || null,
              next_steps: findingsRef.current?.nextSteps || null,
              events: stateWithFindings.events || [],
              logs: stateWithFindings.logs || [],
              semantic_context: semanticContextRef.current,
            };
            const { error: updateError } = await supabase
              .from("test_runs")
              .update(updateData)
              .eq("id", testRunId);
            if (updateError) {
              console.error("Error updating test_run:", updateError);
              // Fallback to creating new record
              testRunId = await runStore.saveCompletedRun(
                testId,
                personaVersionId,
                stateWithContext,
                sessionIdRef.current || ""
              );
            } else {
              console.log("Test run updated successfully with ID:", testRunId);
            }
          }

          if (!testRunId) {
            console.error("Failed to save test run");
          } else {
            console.log("Test run saved successfully with ID:", testRunId);
          }

          // Save feedback entries (findings) if we have a test_run_id
          if (
            testRunId &&
            findingsRef.current?.findings &&
            findingsRef.current.findings.length > 0
          ) {
            const feedbackEntries = (findingsRef.current.findings as EnhancedFinding[]).map(
              (finding) => {
                // Map severity to enum values: 'Blocker', 'High', 'Med', 'Low'
                let severity = "Low";
                const severityLower = finding.severity?.toLowerCase() || "low";
                if (severityLower === "blocker") {
                  severity = "Blocker";
                } else if (severityLower === "high") {
                  severity = "High";
                } else if (severityLower === "med" || severityLower === "medium") {
                  severity = "Med";
                } else {
                  severity = "Low";
                }

                // Extract citations and developer outputs from enhanced findings
                const citations = finding.citations || [];
                const developerOutputs = finding.developerOutputs || {};

                // Get evidence snippets, frequency, and triggered by info from clustered finding
                const evidenceSnippets = finding.evidence_snippets || [];
                const frequency = finding.frequency || 1;
                const triggeredByTasks = finding.triggered_by_tasks || finding.affectingTasks || [];
                const triggeredByPersonas = finding.triggered_by_personas || [];

                console.log(
                  `[Save] Finding "${finding.title}" has ${evidenceSnippets.length} evidence snippets:`,
                  evidenceSnippets
                );

                // Normalize category to valid enum value
                const normalizeCategory = (
                  category: string | undefined
                ):
                  | "navigation"
                  | "copy"
                  | "affordance_feedback"
                  | "forms"
                  | "hierarchy"
                  | "accessibility"
                  | "conversion"
                  | "other" => {
                  if (!category) return "other";

                  const normalized = category.toLowerCase().trim();

                  // Map valid categories
                  if (
                    [
                      "navigation",
                      "copy",
                      "affordance_feedback",
                      "forms",
                      "hierarchy",
                      "accessibility",
                      "conversion",
                      "other",
                    ].includes(normalized)
                  ) {
                    return normalized as FindingCategory;
                  }

                  // Map heuristic-based categories to valid values
                  const heuristicMap: Record<
                    string,
                    | "navigation"
                    | "copy"
                    | "affordance_feedback"
                    | "forms"
                    | "hierarchy"
                    | "accessibility"
                    | "conversion"
                    | "other"
                  > = {
                    user_control_and_freedom: "affordance_feedback",
                    visibility_of_system_status: "affordance_feedback",
                    match_between_system_and_real_world: "copy",
                    consistency_and_standards: "navigation",
                    error_prevention: "forms",
                    recognition_rather_than_recall: "navigation",
                    flexibility_and_efficiency_of_use: "navigation",
                    aesthetic_and_minimalist_design: "hierarchy",
                    help_users_recognize_diagnose_and_recover_from_errors: "affordance_feedback",
                    help_and_documentation: "other",
                  };

                  // Check if it matches any heuristic name (with underscores, hyphens, or spaces)
                  const heuristicKey = normalized.replace(/[-\s]/g, "_");
                  if (heuristicMap[heuristicKey]) {
                    return heuristicMap[heuristicKey];
                  }

                  // Check if category contains heuristic keywords
                  for (const [heuristic, mappedCategory] of Object.entries(heuristicMap)) {
                    if (normalized.includes(heuristic) || heuristic.includes(normalized)) {
                      return mappedCategory;
                    }
                  }

                  // Default to "other" for unknown categories
                  return "other";
                };

                return {
                  test_run_id: testRunId,
                  persona_version_id: personaVersionId,
                  title: finding.title || "Untitled Finding",
                  severity: severity,
                  confidence: finding.confidence ?? 0,
                  confidence_level:
                    finding.confidence_level ||
                    (finding.confidence >= 70 ? "High" : finding.confidence >= 40 ? "Med" : "Low"),
                  category: normalizeCategory(finding.category),
                  description: finding.description || "",
                  suggested_fix: finding.suggestedFix || null,
                  affecting_tasks: finding.affectingTasks || [],
                  evidence_snippets: evidenceSnippets.length > 0 ? evidenceSnippets : null,
                  frequency: frequency,
                  triggered_by_tasks: triggeredByTasks,
                  triggered_by_personas: triggeredByPersonas,
                  knowledge_citations: citations.length > 0 ? citations : null,
                  developer_outputs:
                    Object.keys(developerOutputs).length > 0 ? developerOutputs : null,
                };
              }
            );

            console.log("Inserting feedback entries:", feedbackEntries.length);
            const { error: feedbackError } = await supabase
              .from("feedback_entries")
              .insert(feedbackEntries);

            if (feedbackError) {
              console.error("Error saving feedback entries:", feedbackError);
            } else {
              console.log("Feedback entries saved successfully");
            }
          }
        }

        // Update test status
        test.status = "completed";
        if (feedback) {
          test.feedback = feedback;
        }
        // successRate is set by submit_findings tool
        await testStore.saveTest(test);
      }

      // Clear active run when completed
      runStore.clearRun(testId);

      setTimeout(() => {
        router.push(`/dashboard/reports/${testId}`);
      }, 2000);

      simulationRef.current = false;
      setIsSimulating(false);
    };

    const progressInterval = setInterval(() => {
      // FIX: Check both global flag AND specific execution ID
      if (!simulationRef.current || activeExecutionIdRef.current !== executionId) {
        clearInterval(progressInterval);
        return;
      }

      // Cap at 99% to wait for agent to submit findings
      if (currentProgress < 99) {
        currentProgress = Math.min(currentProgress + progressIncrement, 99);

        setState((prev) => ({
          ...prev,
          personas: prev.personas.map((p, idx) =>
            idx === 0 ? { ...p, percent: currentProgress } : p
          ),
        }));
      }
      // We removed the auto-completion at 100% here.
      // Completion is now solely triggered by the agent calling 'submit_findings' or saying "Done".
    }, 3000);

    // Main simulation loop
    const DECISION_DELAY_MS = 3000;
    let lastDecisionTime = Date.now();
    let screenshotIndex = 0; // Track screenshot index for evidence

    // Track click history to prevent loops
    const clickHistory: Array<{ x: number; y: number; timestamp: number; screenshot: string }> = [];
    const MAX_CLICK_HISTORY = 10; // Keep last 10 clicks
    const CLICK_LOOP_THRESHOLD = 3; // If same location clicked 3+ times with no change, warn

    try {
      while (simulationRef.current && currentProgress < 100) {
        // FIX: Critical guard - if a new execution started, kill this one
        if (activeExecutionIdRef.current !== executionId) {
          break;
        }

        // Always update screenshot
        if (!simulationRef.current) break;

        const screenshotData = await proxyScreenshot(sessionId);

        // FIX: Check again after await
        if (activeExecutionIdRef.current !== executionId) break;

        if (screenshotData.status === "error" || !screenshotData.screenshot) {
          // If session not found, stop the simulation loop
          if (screenshotData.code === "SESSION_NOT_FOUND") {
            console.error("Session not found - stopping simulation:", screenshotData.message);
            setState((prev) => ({
              ...prev,
              status: "error",
              logs: [
                ...prev.logs,
                {
                  t: Date.now(),
                  text: `❌ Session expired or closed: ${screenshotData.message}`,
                },
              ],
            }));
            simulationRef.current = false;
            setIsSimulating(false);
            break;
          }

          // If screenshot timeout, retry a few times before giving up
          if (screenshotData.code === "SCREENSHOT_TIMEOUT") {
            console.warn("Screenshot timeout, retrying...", screenshotData.message);
            // Retry up to 3 times with increasing delays
            let retryCount = 0;
            let retrySuccess = false;
            while (retryCount < 3 && !retrySuccess) {
              await new Promise((r) => setTimeout(r, 2000 * (retryCount + 1))); // 2s, 4s, 6s delays
              const retryResult = await proxyScreenshot(sessionId);
              if (retryResult.status === "ok" && retryResult.screenshot) {
                // Success - use this screenshot
                const b64 = retryResult.screenshot;
                setCurrentScreenshot(b64 || null);
                screenshotIndex++;
                retrySuccess = true;
                // Continue with normal flow - break out of error handling
                break;
              }
              retryCount++;
            }

            if (!retrySuccess) {
              console.error("Screenshot timeout after retries, continuing with last known state");
              // Continue with simulation - don't break, just skip this screenshot
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            // If we got here, we have a valid screenshot from retry, continue normally
          } else {
            console.error("Failed to get screenshot:", screenshotData.message);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }

        const b64 = screenshotData.screenshot;
        setCurrentScreenshot(b64 || null);
        screenshotIndex++; // Increment screenshot index

        // Extract semantic context periodically (every 5th screenshot to avoid overhead)
        // This will be used by the reasoning engine when findings are submitted
        if (Math.random() < 0.2 || !semanticContextRef.current?.dom_tree) {
          try {
            const contextData = await extractContext(sessionId);
            if (contextData.status === "ok" && contextData.context) {
              semanticContextRef.current = {
                ...(semanticContextRef.current || {
                  dom_tree: null,
                  accessibility_tree: null,
                  page_metadata: null,
                  figma_metadata: null,
                }),
                ...contextData.context,
              };
            }
          } catch (error) {
            console.log("Context extraction failed, continuing without it:", error);
          }
        }

        // Check if enough time has passed for next decision
        const now = Date.now();
        if (now - lastDecisionTime < DECISION_DELAY_MS) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (!simulationRef.current) break;
        if (activeExecutionIdRef.current !== executionId) break;

        const test = await testStore.getTestById(testId);
        const decideRes = await fetch(`/dashboard/runs/${testId}/api`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            screenshot: b64,
            tasks,
            history: agentHistoryRef.current,
            persona: stateRef.current.personas[0],
            runIndex: 0, // Main simulation is run 0
            currentProgress,
            goal: test?.testData?.goal || "", // Pass the test goal
          }),
        });

        // FIX: Check again after expensive API call
        if (activeExecutionIdRef.current !== executionId) break;

        const decision = await decideRes.json();
        lastDecisionTime = Date.now();

        if (decision.action === "tool_call") {
          const toolOutputs: Array<{ role: "tool"; tool_call_id: string; content: string }> = [];
          let shouldStop = false;

          for (const toolCall of decision.tool_calls) {
            if (toolCall.function.name === "click") {
              const args = JSON.parse(toolCall.function.arguments);

              // Check for completion rationale
              if (args.rationale === "Done." || args.rationale === "Done") {
                handleCompletion(args.rationale);
                shouldStop = true;
                toolOutputs.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: "Task completed",
                });
                break;
              }

              // Check for click loops: same location clicked multiple times with no visual change
              const clickX = Math.round(args.x);
              const clickY = Math.round(args.y);
              const recentClicksAtLocation = clickHistory.filter(
                (c) =>
                  Math.abs(c.x - clickX) < 10 && // Within 10px tolerance
                  Math.abs(c.y - clickY) < 10 &&
                  Date.now() - c.timestamp < 30000 // Within last 30 seconds
              );

              // Get current screenshot before clicking
              const screenshotBeforeClick = b64;

              // If we've clicked this location multiple times recently, check if screenshots changed
              if (recentClicksAtLocation.length >= CLICK_LOOP_THRESHOLD - 1) {
                // Compare with previous screenshot at this location
                const lastClickAtLocation =
                  recentClicksAtLocation[recentClicksAtLocation.length - 1];
                const screenshotsMatch = screenshotBeforeClick === lastClickAtLocation.screenshot;

                if (screenshotsMatch) {
                  // Same screenshot = no visual change, prevent loop
                  console.warn(
                    `⚠️ Click loop detected: Clicked (${clickX}, ${clickY}) ${recentClicksAtLocation.length + 1} times with no visual change. Blocking click to prevent infinite loop.`
                  );
                  toolOutputs.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `ERROR: You clicked at (${clickX}, ${clickY}) ${recentClicksAtLocation.length + 1} times but the screen did not change. This action has no effect. You MUST try a different element or approach. Do not click this location again.`,
                  });
                  // Add warning to agent history so it knows to avoid this
                  agentHistoryRef.current.push({
                    role: "system",
                    content: `WARNING: You clicked at (${clickX}, ${clickY}) ${recentClicksAtLocation.length + 1} times but the screen did not change. This action appears to have no effect. You MUST try clicking a different element or using a different approach. Do not click this location again.`,
                  });
                  continue; // Skip this click
                }
              }

              const event: RunEvent = {
                id: Date.now().toString(),
                t: Date.now() - startedAtRef.current,
                type: "click",
                label: args.rationale || `Click at ${args.x}, ${args.y}`,
                personaId: stateRef.current.personas[0]?.id || "unknown",
              };

              setState((prev) => ({
                ...prev,
                events: [...prev.events, event],
                logs: [...prev.logs, { t: Date.now(), text: `Agent: ${args.rationale}` }],
              }));

              // Use Server Action for click
              await proxyClick(sessionId, args.x, args.y);

              // Wait a bit for the page to update, then get new screenshot to check for changes
              await new Promise((r) => setTimeout(r, 1500));
              const screenshotAfterClick = await proxyScreenshot(sessionId);
              const newScreenshot = screenshotAfterClick.screenshot || screenshotBeforeClick;

              // Record this click in history
              clickHistory.push({
                x: clickX,
                y: clickY,
                timestamp: Date.now(),
                screenshot: screenshotBeforeClick || "",
              });

              // Keep only recent history
              if (clickHistory.length > MAX_CLICK_HISTORY) {
                clickHistory.shift();
              }

              // Check if screenshot changed after click
              const screenshotChanged = newScreenshot !== screenshotBeforeClick;

              // Update current screenshot display
              if (newScreenshot) {
                setCurrentScreenshot(newScreenshot);
              }

              if (!screenshotChanged && recentClicksAtLocation.length > 0) {
                // Screenshot didn't change, warn agent
                toolOutputs.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: `Clicked at (${clickX}, ${clickY}), but the screen did not change. This may indicate the click had no effect. Consider trying a different element or approach if this happens again.`,
                });
                // Add to agent history
                agentHistoryRef.current.push({
                  role: "system",
                  content: `The click at (${clickX}, ${clickY}) did not change the screen. If this happens multiple times, try a different element.`,
                });
              } else {
                toolOutputs.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: screenshotChanged
                    ? "Clicked successfully. The screen has updated."
                    : "Clicked successfully",
                });
              }
            } else if (toolCall.function.name === "submit_findings") {
              const args = JSON.parse(toolCall.function.arguments);

              const findings = args.findings || [];
              const feedback = args.generalFeedback || "Test completed.";
              let taskCompletionPercentage = args.taskCompletionPercentage ?? 0;
              const nextSteps = args.nextSteps;

              // Get test data for validation
              const testForValidation = await testStore.getTestById(testId);

              // Validation: Prevent early submission
              const totalTasks = testForValidation?.testData?.tasks?.length || 1;
              const actionCount = state.events.filter((e) => e.type === "click").length;
              const minActionsPerTask = 2; // Minimum actions expected per task
              const minActionsRequired = totalTasks * minActionsPerTask;

              // If agent submitted too early (not enough actions), warn and adjust
              if (actionCount < minActionsRequired && currentProgress < 90) {
                console.warn(
                  `⚠️ Early submission detected: Only ${actionCount} actions for ${totalTasks} tasks. Minimum expected: ${minActionsRequired}`
                );
                // Don't block, but log the warning
                // The agent should be prompted better, but we allow it to proceed
              }

              // Validate taskCompletionPercentage is reasonable
              if (taskCompletionPercentage < 0) taskCompletionPercentage = 0;
              if (taskCompletionPercentage > 100) taskCompletionPercentage = 100;

              // Enhance findings using reasoning engine (if enabled)
              let enhancedFindings = findings;
              const evidenceMap = new Map<string, EvidenceSnippet[]>(); // Declare outside try block for catch access

              try {
                const test = await testStore.getTestById(testId);
                const allPersonas = await personaStore.getPersonas();
                const selectedPersona = test?.testData?.selectedPersona
                  ? allPersonas.find((p) => p.id === test.testData?.selectedPersona)
                  : null;

                // Get raw persona data from database for full details
                let personaData: {
                  name: string;
                  role: string | null;
                  variant: string | null;
                  attributes: Record<string, unknown> | null;
                } | null = null;
                if (test?.testData?.selectedPersona) {
                  const { data } = await supabase
                    .from("personas")
                    .select("name, role, variant, attributes")
                    .eq("id", test.testData.selectedPersona)
                    .single();
                  personaData = data;
                }

                const personaName =
                  personaData?.name ||
                  selectedPersona?.name ||
                  state.personas[0]?.name ||
                  "Unknown";
                const personaRole =
                  personaData?.role ||
                  personaData?.variant ||
                  selectedPersona?.role ||
                  state.personas[0]?.variant ||
                  "User";

                // Fix TypeScript error - Persona type doesn't have description
                const personaDescription = personaData?.attributes?.description || null;

                // Only enhance if we have semantic context
                if (
                  semanticContextRef.current?.dom_tree ||
                  semanticContextRef.current?.accessibility_tree
                ) {
                  console.log("🎯 Enhancing findings with reasoning engine...");

                  // Get full persona attributes for persona-specific analysis
                  const personaAttributes = personaData?.attributes || selectedPersona || {};
                  const fullPersona = {
                    name: personaName,
                    role: personaRole,
                    description: personaData?.attributes?.description || null,
                    goals: (personaAttributes.goals as string[]) || selectedPersona?.goals || [],
                    behaviors:
                      (personaAttributes.behaviors as string[]) || selectedPersona?.behaviors || [],
                    frustrations:
                      (personaAttributes.frustrations as string[]) ||
                      selectedPersona?.frustrations ||
                      [],
                    constraints:
                      (personaAttributes.constraints as string[]) ||
                      selectedPersona?.constraints ||
                      [],
                    accessibility:
                      (personaAttributes.accessibility as string[]) ||
                      selectedPersona?.accessibility ||
                      [],
                    tags: (personaAttributes.tags as string[]) || selectedPersona?.tags || [],
                  };

                  const reasoningResponse = await fetch(`/dashboard/runs/${testId}/reasoning`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      screenshot: b64,
                      semanticContext: semanticContextRef.current,
                      tasks: test?.testData?.tasks || [],
                      persona: fullPersona,
                      currentProgress,
                      useReasoningEngine: true,
                    }),
                  });

                  if (reasoningResponse.ok) {
                    const reasoningData = await reasoningResponse.json();
                    if (reasoningData.useReasoningEngine && reasoningData.findings) {
                      enhancedFindings = reasoningData.findings;
                      console.log(
                        `✅ Enhanced ${enhancedFindings.length} findings with citations and developer outputs`
                      );
                    }
                  }
                }

                // Capture evidence for each finding
                const { extractEvidenceFromRun } =
                  await import("../../../../lib/reasoning-engine/evidence-capture");

                // Capture evidence for all findings
                enhancedFindings.forEach((finding: EnhancedFinding, idx: number) => {
                  // Handle both string ("Task 1") and number (1) formats for affectingTasks
                  let taskIndex: number | null = null;
                  let taskContext = "General task";

                  if (finding.affectingTasks && finding.affectingTasks.length > 0) {
                    const firstTask = finding.affectingTasks[0];
                    let taskMatch: RegExpMatchArray | null = null;

                    if (typeof firstTask === "number") {
                      // If it's a number, use it directly (1-indexed)
                      taskIndex = firstTask - 1;
                    } else if (typeof firstTask === "string") {
                      // If it's a string, try to extract the number
                      taskMatch = firstTask.match(/(\d+)/);
                      taskIndex = taskMatch ? parseInt(taskMatch[1]) - 1 : null;
                    }

                    const taskDescription =
                      taskIndex !== null && taskIndex >= 0 && test?.testData?.tasks?.[taskIndex]
                        ? test.testData.tasks[taskIndex]
                        : typeof firstTask === "string"
                          ? firstTask
                          : `Task ${firstTask}`;

                    const taskNumber =
                      typeof firstTask === "number"
                        ? firstTask
                        : taskMatch
                          ? taskMatch[1]
                          : firstTask;

                    taskContext = `Task ${taskNumber}: ${taskDescription}`;
                  }

                  const evidence = extractEvidenceFromRun(
                    state.events,
                    personaName,
                    personaRole,
                    taskContext,
                    screenshotIndex, // Use tracked screenshot index
                    finding.elementPosition
                      ? {
                          bounding_box: finding.elementPosition,
                          element_selector: finding.elementSelector,
                        }
                      : undefined,
                    clickHistory, // Pass click history for detailed action sequences
                    agentHistoryRef.current // Pass agent history for rationale/quotes
                  );

                  evidenceMap.set(idx.toString(), [evidence]);
                  console.log(
                    `[Evidence] Captured evidence for finding "${finding.title}":`,
                    evidence
                  );
                });

                // Attach evidence to findings before clustering (use title as key)
                enhancedFindings = enhancedFindings.map((finding: EnhancedFinding) => {
                  const findingKey =
                    finding.title || `finding_${enhancedFindings.indexOf(finding)}`;
                  const evidence = evidenceMap.get(findingKey) || [];
                  if (evidence.length > 0) {
                    console.log(
                      `[Evidence] Attaching evidence to finding "${finding.title}":`,
                      evidence
                    );
                  }
                  return {
                    ...finding,
                    evidence_snippets: evidence,
                  };
                });

                // Cluster findings to deduplicate (gracefully handle missing API key)
                try {
                  const { clusterFindings } =
                    await import("../../../../lib/reasoning-engine/clustering");
                  const clusteredFindings = await clusterFindings(
                    enhancedFindings,
                    evidenceMap,
                    test?.testData?.tasks || [],
                    personaName
                  );

                  enhancedFindings = clusteredFindings;
                  console.log(
                    `🔗 Clustered ${findings.length} findings into ${clusteredFindings.length} unique findings`
                  );
                } catch (clusteringError) {
                  console.warn(
                    "Clustering failed (may be due to missing OpenAI API key), using findings as-is:",
                    clusteringError
                  );
                  // Evidence already attached above, so findings should have evidence_snippets
                }
              } catch (error) {
                console.error("Error enhancing findings with reasoning engine:", error);
                // Continue with original findings if enhancement fails, but still attach evidence if available
                if (typeof evidenceMap !== "undefined") {
                  enhancedFindings = enhancedFindings.map(
                    (finding: EnhancedFinding, idx: number) => ({
                      ...finding,
                      evidence_snippets: evidenceMap.get(idx.toString()) || [],
                    })
                  );
                }
              }

              // Update test with findings, completion percentage, and next steps
              const test = await testStore.getTestById(testId);
              if (test) {
                test.findings = enhancedFindings;
                test.successRate = taskCompletionPercentage;
                test.nextSteps = nextSteps;
                await testStore.saveTest(test);
              }

              // Update steps based on task completion percentage
              // Mark steps as passed based on completion percentage
              const totalSteps = state.steps.length;
              const completedStepsCount = Math.round((taskCompletionPercentage / 100) * totalSteps);

              setState((prev) => ({
                ...prev,
                steps: prev.steps.map((step, index) => ({
                  ...step,
                  pass: index < completedStepsCount, // Mark first N steps as passed
                })),
              }));

              // Store findings and feedback in ref so handleCompletion can save them to test_run
              findingsRef.current = {
                findings: enhancedFindings,
                feedback,
                successRate: taskCompletionPercentage,
                nextSteps,
              };

              handleCompletion(feedback);
              shouldStop = true;

              toolOutputs.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: "Findings submitted",
              });
              break;
            } else if (toolCall.function.name === "get_screenshot") {
              // No-op, we send screenshot anyway
              toolOutputs.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: "Screenshot taken",
              });
            } else {
              // Fallback for unknown tools
              toolOutputs.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: "Tool executed",
              });
            }
          }

          // If completion was triggered in the loop, break out
          if (shouldStop || !simulationRef.current) break;

          const newHistory = [...agentHistoryRef.current, decision.message, ...toolOutputs];
          agentHistoryRef.current = newHistory;
        } else {
          // Also check content for "Done." just in case
          if (decision.content?.includes("Done.") || decision.content?.includes("Done")) {
            // Extract feedback after "Done."
            const feedback = decision.content.replace(/Done\.?/i, "").trim();
            handleCompletion(feedback || decision.content);
            break;
          }

          if (decision.content) {
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, { t: Date.now(), text: `Agent: ${decision.content}` }],
            }));
          }

          const newHistory = [...agentHistoryRef.current, decision.message];
          agentHistoryRef.current = newHistory;
        }
      }
    } catch (e) {
      // FIX: Only report errors for the active thread
      if (activeExecutionIdRef.current === executionId) {
        console.error("Simulation error:", e);
        toast({
          title: "Simulation Error",
          description: "An error occurred during the simulation.",
          variant: "destructive",
        });
      }
    } finally {
      clearInterval(progressInterval);

      // FIX: Only update global state if this was the active execution
      // This prevents an old "zombie" loop from turning off the flag for a new valid loop
      if (activeExecutionIdRef.current === executionId) {
        simulationRef.current = false;
        setIsSimulating(false);
      }
    }
  };

  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Only start automatically if NOT resuming (resuming is handled in the first useEffect)
    // And only if status is running and we have personas loaded
    if (
      state.status === "running" &&
      !hasStartedRef.current &&
      !sessionIdRef.current &&
      state.personas.length > 0
    ) {
      hasStartedRef.current = true;
      runSimulation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.personas.length]);

  const handleEventClick = (event: RunEvent) => {
    if (videoRef.current) {
      videoRef.current.currentTime = event.t;
    }
    setHighlightedEventId(event.id);
    setTimeout(() => setHighlightedEventId(undefined), 2000);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Run link copied to clipboard",
    });
  };

  const videoUrl =
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/test_video-UOVNF3qfZLAN4grybvKaejGMEHvvPG.mp4";

  return (
    <div className="min-h-screen bg-background">
      <AppLayout>
        <main className="container mx-auto p-6">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{state.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <Badge className={statusColors[state.status]} data-testid="run-status-chip">
                    {statusLabels[state.status]}
                  </Badge>
                  {state.etaLabel ? (
                    <span className="text-sm text-muted-foreground">
                      {state.etaLabel} remaining
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">First run</span>
                  )}
                </div>
              </div>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="lg:sticky lg:top-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Replay</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {currentScreenshot ? (
                        <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/png;base64,${currentScreenshot}`}
                            alt="Live View"
                            className="w-full h-full object-contain"
                          />
                          {isSimulating && (
                            <div className="absolute top-2 right-2">
                              <Badge variant="default" className="animate-pulse bg-red-500">
                                LIVE
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-muted-foreground">
                          Waiting for stream...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="space-y-6 lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Persona Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PersonaProgressList personas={state.personas} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Live Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LiveLog logs={state.logs} startTime={state.startedAt} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Event Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EventTimeline
                      events={state.events}
                      onEventClick={handleEventClick}
                      highlightedEventId={highlightedEventId}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                <SideTabs
                  steps={state.steps}
                  tags={state.tags}
                  consoleTrace={state.consoleTrace}
                  onTagClick={(time) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = time;
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </AppLayout>
    </div>
  );
}
