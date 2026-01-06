/**
 * Job Queue
 *
 * Handles test run job processing with BullMQ
 */

import { Queue, Worker, QueueEvents, type ConnectionOptions } from "bullmq";
import type { ConnectionConfig } from "../config/connections.js";
import { SessionManager } from "../execution/session-manager.js";
import { runTest } from "../execution/test-run-orchestrator.js";
import { DatabaseClient } from "../storage/database.js";
import { EvidenceStorage } from "../storage/evidence-storage.js";
import type { TestData, Persona } from "../utils/types.js";

export interface TestRunJobData {
  testRunId: string;
  testId: string;
  testData: TestData;
  persona: Persona;
}

/**
 * Job Queue Manager
 */
export class JobQueueManager {
  private config: ConnectionConfig;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private queueEvents: QueueEvents | null = null;
  private sessionManager: SessionManager;
  private database: DatabaseClient;
  private evidenceStorage: EvidenceStorage;
  // Track active test runs for cancellation
  private activeTestRuns: Map<
    string,
    {
      sessionId: string;
      cancelled: boolean;
      stagehand?: any;
      page?: any;
      startTime?: number;
      logs?: Array<{ t: number; text: string; type?: "reasoning" | "action" }>;
      events?: Array<{
        id: string;
        type: string;
        label: string;
        details?: string;
        stepIndex?: number;
        t: number;
      }>;
    }
  > = new Map();
  // SSE event emitter (set from index.ts)
  public emitSSEEvent?: (testRunId: string, eventType: string, data: unknown) => void;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.sessionManager = new SessionManager(config);
    this.database = new DatabaseClient(config);
    this.evidenceStorage = new EvidenceStorage(config);

    // Initialize Redis connection for BullMQ
    // Only initialize if Redis is configured (required for production, optional for development)
    if (config.redis) {
      const connection: ConnectionOptions = {
        host: new URL(config.redis.url).hostname,
        port: parseInt(new URL(config.redis.url).port || "6379", 10),
        password: new URL(config.redis.url).password || undefined,
        username: new URL(config.redis.url).username || undefined,
      };

      this.queue = new Queue("test-runs", {
        connection,
      });

      this.queueEvents = new QueueEvents("test-runs", {
        connection,
      });

      // Setup worker
      this.worker = new Worker(
        "test-runs",
        async (job) => {
          return await this.processTestRunJob(job.data as TestRunJobData);
        },
        {
          connection,
          concurrency: config.maxConcurrentRuns || 5,
        }
      );

      this.setupWorkerEventHandlers();
    } else {
      // Development mode: Redis not configured
      // Queue operations will be handled synchronously
      console.warn("⚠️  Redis not configured - running in development mode without job queue");
      console.warn(
        "   Test runs will be processed synchronously. For production, configure Redis."
      );
    }
  }

  /**
   * Add test run job to queue
   * In development mode (no Redis), processes synchronously
   */
  async addTestRunJob(jobData: TestRunJobData): Promise<void> {
    // If Redis is not configured, process synchronously (development mode)
    if (!this.queue) {
      console.log("📦 Processing test run synchronously (Redis not configured)");
      await this.processTestRunJob(jobData);
      return;
    }

    await this.queue.add("test-run", jobData, {
      attempts: 1, // No retries for now
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for debugging
    });
  }

  /**
   * Cancel a test run
   */
  async cancelTestRunJob(testRunId: string): Promise<boolean> {
    // Mark as cancelled in active runs map
    const activeRun = this.activeTestRuns.get(testRunId);
    if (activeRun) {
      activeRun.cancelled = true;
    }

    // If using BullMQ, cancel the job
    if (this.queue) {
      const jobs = await this.queue.getJobs(["active", "waiting"]);
      const job = jobs.find((j) => (j.data as TestRunJobData).testRunId === testRunId);
      if (job) {
        await job.remove();
      }
    }

    // Get test run to find browserbase session ID
    const testRun = await this.database.getTestRun(testRunId);
    if (testRun?.browserbase_session_id) {
      // Close Browserbase session via SessionManager
      // Note: SessionManager tracks sessions by internal sessionId, not browserbase_session_id
      // We'll need to close via Browserbase API directly or maintain a mapping
      // For now, mark as cancelled and let the cleanup in runTest handle it
      try {
        // Get session ID from active runs if available
        if (activeRun?.sessionId) {
          await this.sessionManager.closeSession(activeRun.sessionId);
        } else {
          // If we don't have sessionId, we can't close via SessionManager
          // The session will be cleaned up when runTest completes or errors
          console.warn(`Cannot close session for test run ${testRunId} - sessionId not available`);
        }
      } catch (error) {
        console.error(`Error closing session for cancelled test run ${testRunId}:`, error);
      }
    }

    // Update database status
    await this.database.updateTestRun(testRunId, {
      status: "error", // Database enum doesn't have "cancelled", use "error"
      general_feedback: "Test run cancelled by user",
      completed_at: new Date().toISOString(),
    });

    // Remove from active runs
    this.activeTestRuns.delete(testRunId);

    return true;
  }

  /**
   * Process test run job
   */
  private async processTestRunJob(jobData: TestRunJobData): Promise<void> {
    const { testRunId, testData, persona } = jobData;
    let browserbaseSessionId: string | null = null;

    try {
      // Update status to running
      await this.database.updateTestRun(testRunId, {
        status: "running",
        started_at: new Date().toISOString(),
      });

      // Track active run for cancellation and collect logs/events
      const startTime = Date.now();
      const accumulatedLogs: Array<{ t: number; text: string; type?: "reasoning" | "action" }> = [];
      const accumulatedEvents: Array<{
        id: string;
        type: string;
        label: string;
        details?: string;
        stepIndex?: number;
        t: number;
      }> = [];

      this.activeTestRuns.set(testRunId, {
        sessionId: "",
        cancelled: false,
        startTime: startTime,
        logs: accumulatedLogs,
        events: accumulatedEvents,
      });

      // Emit initial status event to let frontend know we're starting
      if (this.emitSSEEvent) {
        this.emitSSEEvent(testRunId, "progress", {
          currentTask: 0,
          totalTasks: testData.tasks.length,
          status: "starting",
        });
      }

      // Wait 2 seconds to allow frontend to connect to SSE stream
      // This ensures the frontend can receive all events from the start
      console.log(
        `⏳ Waiting 2 seconds for frontend SSE connection to establish for test run ${testRunId}...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Run the test
      const result = await runTest(
        testRunId,
        testData,
        persona,
        this.config,
        this.sessionManager,
        async (progress) => {
          // Progress callback - can be used for real-time updates
          console.log(
            `Test run ${testRunId}: ${progress.currentTask}/${progress.totalTasks} - ${progress.status}`
          );

          // Emit progress event via SSE
          if (this.emitSSEEvent) {
            this.emitSSEEvent(testRunId, "progress", progress);
          }

          // Check for cancellation
          const activeRun = this.activeTestRuns.get(testRunId);
          if (activeRun?.cancelled) {
            throw new Error("Test run cancelled by user");
          }
        },
        async (message) => {
          // Persona message callback - can be used for SSE streaming
          console.log(`[Persona] ${message}`);

          // Store log entry
          const activeRun = this.activeTestRuns.get(testRunId);
          if (activeRun && activeRun.logs) {
            activeRun.logs.push({
              t: Date.now() - (activeRun.startTime || Date.now()),
              text: message,
              type: "reasoning" as const,
            });
          }

          // Emit persona message event via SSE
          if (this.emitSSEEvent) {
            this.emitSSEEvent(testRunId, "persona_message", {
              message,
              timestamp: new Date().toISOString(),
            });
          }
        },
        async (event) => {
          // Event callback for timeline events (clicks, submits, etc.)
          const activeRun = this.activeTestRuns.get(testRunId);
          const eventTime = Date.now() - (activeRun?.startTime || Date.now());
          const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Store event
          if (activeRun && activeRun.events) {
            activeRun.events.push({
              id: eventId,
              type: event.type,
              label: event.label,
              details: event.details,
              stepIndex: event.stepIndex,
              t: eventTime,
            });
          }

          // Emit event via SSE
          if (this.emitSSEEvent) {
            this.emitSSEEvent(testRunId, "event", {
              id: eventId,
              type: event.type,
              label: event.label,
              details: event.details,
              stepIndex: event.stepIndex,
              t: eventTime,
            });
          }
        },
        async (sessionId, bSessionId) => {
          // Session created callback - track session ID for cancellation
          const activeRun = this.activeTestRuns.get(testRunId);
          if (activeRun) {
            activeRun.sessionId = sessionId;
          }
          // Store browserbase session ID
          browserbaseSessionId = bSessionId;
          // Store in database immediately
          this.database
            .updateTestRun(testRunId, {
              browserbase_session_id: bSessionId,
            })
            .catch((err) => {
              console.error(`Error storing browserbase session ID: ${err}`);
            });

          // Get public Live View URL using Browserbase SDK (no auth required)
          let liveViewUrl = `https://www.browserbase.com/sessions/${bSessionId}/embed`; // Fallback
          try {
            const { Browserbase } = await import("@browserbasehq/sdk");
            const browserbase = new Browserbase({
              apiKey: this.config.browserbase.apiKey,
            });
            const debugLinks = await browserbase.sessions.debug(bSessionId);
            liveViewUrl = debugLinks.debuggerFullscreenUrl; // Public, no auth required
          } catch (error) {
            console.warn(`Failed to get debug URL from Browserbase SDK, using embed URL:`, error);
          }

          if (this.emitSSEEvent) {
            this.emitSSEEvent(testRunId, "SESSION_READY", {
              browserbaseSessionId: bSessionId,
              liveViewUrl: liveViewUrl,
            });
          }
        },
        (stagehand, page) => {
          // Store stagehand and page for report generation
          const activeRun = this.activeTestRuns.get(testRunId);
          if (activeRun) {
            activeRun.stagehand = stagehand;
            activeRun.page = page;
          }
        },
        this.database, // Pass database for report generation
        this.evidenceStorage // Pass evidence storage for report generation
      );

      // Get browserbase session ID from result (fallback if callback didn't set it)
      if (!browserbaseSessionId) {
        browserbaseSessionId = result.browserbaseSessionId || null;
        // Store in database if we got it from result
        if (browserbaseSessionId) {
          await this.database.updateTestRun(testRunId, {
            browserbase_session_id: browserbaseSessionId,
          });
        }
      }

      // Convert null to undefined for database updates
      const browserbaseSessionIdForDb = browserbaseSessionId || undefined;

      // Calculate metrics from result
      const metrics = result.metrics || {
        completedTasks: result.results.filter((r) => r.success).length,
        totalTasks: testData.tasks.length,
        taskCompletionPercentage: 0,
        duration: 0,
        actionCount: result.results.length,
      };

      // Determine final status: "completed" if all tasks done, "error" if some failed
      // But always mark as "completed" when test run finishes (even if some tasks failed)
      const finalStatus = "completed"; // Always mark as completed when run finishes

      // Build general feedback if there were failures
      let generalFeedback = result.personaExplanation || result.error || undefined;
      if (metrics.completedTasks < metrics.totalTasks) {
        const failureMsg = `${metrics.completedTasks}/${metrics.totalTasks} tasks completed.`;
        generalFeedback = generalFeedback ? `${failureMsg} ${generalFeedback}` : failureMsg;
      }

      // Emit completion event via SSE (always emit, even if partial completion)
      if (this.emitSSEEvent) {
        this.emitSSEEvent(testRunId, "completed", {
          testRunId,
          success: result.success,
          reportGenerated: result.reportGenerated || false,
          metrics: {
            completedTasks: metrics.completedTasks,
            totalTasks: metrics.totalTasks,
            taskCompletionPercentage: metrics.taskCompletionPercentage,
            duration: metrics.duration,
            actionCount: metrics.actionCount,
          },
          personaExplanation: result.personaExplanation,
        });
      }

      // Get accumulated logs and events
      const activeRun = this.activeTestRuns.get(testRunId);
      const logs = activeRun?.logs || [];
      const events = activeRun?.events || [];

      // Update test run with status, metrics, logs, and events
      await this.database.updateTestRun(testRunId, {
        status: finalStatus,
        completed_at: new Date().toISOString(),
        browserbase_session_id: browserbaseSessionIdForDb,
        general_feedback: generalFeedback,
        completed_tasks: metrics.completedTasks,
        task_completion_percentage: metrics.taskCompletionPercentage,
        duration_seconds: Math.round(metrics.duration / 1000), // Convert ms to seconds
        action_count: metrics.actionCount,
        logs: logs.length > 0 ? logs : undefined,
        events: events.length > 0 ? events : undefined,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error processing test run ${testRunId}:`, message);

      // Update status to error
      const browserbaseSessionIdForDb = browserbaseSessionId || undefined;
      await this.database.updateTestRun(testRunId, {
        status: "error",
        general_feedback: message,
        completed_at: new Date().toISOString(),
        browserbase_session_id: browserbaseSessionIdForDb,
      });

      throw error; // Re-throw to mark job as failed
    } finally {
      // Remove from active runs
      this.activeTestRuns.delete(testRunId);
    }
  }

  /**
   * Setup worker event handlers
   */
  private setupWorkerEventHandlers(): void {
    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    this.worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on("failed", (job, error) => {
      console.error(`Job ${job?.id} failed:`, error);
    });

    this.worker.on("error", (error) => {
      console.error("Worker error:", error);
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    if (!this.queue) {
      return null; // No queue in development mode
    }

    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      data: job.data,
    };
  }

  /**
   * Close queue and worker
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
