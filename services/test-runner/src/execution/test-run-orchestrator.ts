/**
 * Test Run Orchestrator
 *
 * Orchestrates test execution with comprehensive cleanup
 */

import type { ConnectionConfig } from "../config/connections.js";
import type { Persona, TestData, TestRunResult, TaskResult } from "../utils/types.js";
import { SessionManager } from "./session-manager.js";
import { executeTask } from "./task-executor.js";
import { generateAndSaveReport } from "./report-generator.js";
import type { DatabaseClient } from "../storage/database.js";
import type { EvidenceStorage } from "../storage/evidence-storage.js";

/**
 * Run a test with comprehensive cleanup in all scenarios
 *
 * CRITICAL: Session cleanup in try-catch-finally ensures cleanup in ALL exit paths
 */
export async function runTest(
  testRunId: string,
  testData: TestData,
  persona: Persona,
  config: ConnectionConfig,
  sessionManager: SessionManager,
  onProgress?: (progress: { currentTask: number; totalTasks: number; status: string }) => void,
  onPersonaMessage?: (message: string) => void,
  onEvent?: (event: { type: string; label: string; details?: string; stepIndex?: number }) => void,
  onSessionCreated?: (sessionId: string, browserbaseSessionId: string) => void,
  onStagehandReady?: (stagehand: any, page: any) => void,
  database?: DatabaseClient,
  evidenceStorage?: EvidenceStorage
): Promise<TestRunResult> {
  let sessionId: string | null = null;
  let stagehand: any | null = null;
  let page: any | null = null;
  let lastPersonaExplanation: string | undefined = undefined;
  let browserbaseSessionId: string | undefined = undefined;

  try {
    // Create session
    const sessionInfo = await sessionManager.createSession(testData.url);
    sessionId = sessionInfo.sessionId;
    stagehand = sessionInfo.stagehand;
    page = sessionInfo.page;

    // Store browserbase_session_id
    browserbaseSessionId = sessionInfo.browserbaseSessionId;

    // Notify callback of session creation (for tracking in job queue)
    if (onSessionCreated && browserbaseSessionId) {
      onSessionCreated(sessionId, browserbaseSessionId);
    }

    // Notify callback of stagehand ready (for report generation)
    if (onStagehandReady) {
      onStagehandReady(stagehand, page);
    }

    const results: TaskResult[] = [];
    const startTime = Date.now();

    // Execute tasks sequentially - continue even if one fails
    for (let i = 0; i < testData.tasks.length; i++) {
      const task = testData.tasks[i];

      // Check for cancellation before each task
      // The onProgress callback checks for cancellation internally
      if (onProgress) {
        await onProgress({
          currentTask: i + 1,
          totalTasks: testData.tasks.length,
          status: "running",
        });
      }

      try {
        const result = await executeTask(task, persona, stagehand, config, onPersonaMessage);
        results.push(result);

        // Emit event for task completion
        if (onEvent) {
          const eventType = result.success ? "click" : "error";
          onEvent({
            type: eventType,
            label: result.success ? `Completed: ${task}` : `Failed: ${task}`,
            details: result.personaExplanation || result.error || undefined,
            stepIndex: i,
          });
        }

        // If task failed, log it but continue to next task
        if (!result.success) {
          // Check if this is a "stuck" scenario (has persona explanation) vs error
          if (result.personaExplanation) {
            // Agent got stuck - store persona explanation but continue
            lastPersonaExplanation = result.personaExplanation;
            console.warn(
              `Task ${i + 1} incomplete: ${result.personaExplanation}. Continuing to next task...`
            );
          } else {
            // Task failed with error - continue to next task
            console.warn(
              `Task ${i + 1} failed: ${task} - ${result.error || "Unknown error"}. Continuing to next task...`
            );
          }
        }
      } catch (taskError: unknown) {
        // Task threw an error - log it but continue to next task
        const message = taskError instanceof Error ? taskError.message : String(taskError);
        console.warn(`Task ${i + 1} error: ${message}. Continuing to next task...`);

        // Store error result
        results.push({
          success: false,
          method: "agent",
          duration: 0,
          error: message,
        });

        // Store persona explanation if available from previous result
        const failedResult = results[results.length - 2];
        if (failedResult?.personaExplanation) {
          lastPersonaExplanation = failedResult.personaExplanation;
        }
      }
    }

    // Calculate metrics
    const completedTasks = results.filter((r) => r.success).length;
    const totalTasks = testData.tasks.length;
    const taskCompletionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const totalDuration = Date.now() - startTime;
    const actionCount = results.length; // Each task = 1 action

    // Determine if test run was successful (all tasks completed)
    const allTasksCompleted = completedTasks === totalTasks;

    // Generate report ALWAYS (regardless of task completion status)
    let reportGenerated = false;
    if (database && evidenceStorage) {
      try {
        console.log(`📊 Generating report for test run ${testRunId}...`);
        await generateAndSaveReport(
          testRunId,
          testData,
          persona,
          {
            success: true,
            results,
            browserbaseSessionId: browserbaseSessionId,
          },
          config,
          database,
          evidenceStorage,
          stagehand,
          page
        );
        reportGenerated = true;
        console.log(`✅ Report generated successfully for test run ${testRunId}`);
      } catch (reportError: unknown) {
        // Better error logging
        if (reportError instanceof Error) {
          console.error(
            `❌ Error generating report for test run ${testRunId}:`,
            reportError.message
          );
          console.error("Error stack:", reportError.stack);
          if (reportError.cause) {
            console.error("Error cause:", reportError.cause);
          }
        } else {
          console.error(
            `❌ Error generating report for test run ${testRunId}:`,
            JSON.stringify(reportError, null, 2)
          );
        }
        // Continue with completion even if report generation fails
        // The test run still completed (but no report)
      }
    }

    return {
      success: allTasksCompleted,
      results,
      browserbaseSessionId: browserbaseSessionId,
      reportGenerated,
      metrics: {
        completedTasks,
        totalTasks,
        taskCompletionPercentage,
        duration: totalDuration,
        actionCount,
      },
      // Include persona explanation if any task failed
      personaExplanation: lastPersonaExplanation,
    };
  } catch (error: unknown) {
    // Error occurred - ensure session is cleaned up
    if (sessionId) {
      await sessionManager.closeSession(sessionId).catch((cleanupError) => {
        console.error(`Error closing session ${sessionId} after error:`, cleanupError);
      });
    }

    const message = error instanceof Error ? error.message : String(error);

    // Include persona explanation in error if available
    const errorMessage = lastPersonaExplanation
      ? `${message} (Persona explanation: ${lastPersonaExplanation})`
      : message;

    return {
      success: false,
      results: [],
      error: errorMessage,
      personaExplanation: lastPersonaExplanation, // Include in result
      browserbaseSessionId: browserbaseSessionId, // Include session ID even on failure
    };
  } finally {
    // CRITICAL: Always cleanup session in finally block
    // This ensures cleanup happens even if there's an unhandled error
    if (sessionId && stagehand) {
      try {
        await sessionManager.closeSession(sessionId);
      } catch (cleanupError: unknown) {
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        console.error(`Error in finally cleanup for session ${sessionId}:`, message);
        // Log but don't throw - we're in cleanup
      }
    }
  }
}
