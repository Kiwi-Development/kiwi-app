/**
 * Main Entry Point
 * 
 * Starts the Express server with connection validation
 */

import express from "express";
import { loadConfig } from "./config/env.js";
import { validateConnections } from "./config/connections.js";
import { healthCheck } from "./api/routes/health.js";
import { errorHandler } from "./api/middleware/error-handler.js";
import { handleReasoningRequest } from "./api/routes/reasoning.js";
import { JobQueueManager } from "./queue/job-queue.js";
import { DatabaseClient } from "./storage/database.js";

async function main() {
  console.log("🚀 Starting Test Runner Service...");

  // Load configuration
  const config = loadConfig();
  console.log("✅ Configuration loaded");

  // Validate all connections at startup (fail fast)
  try {
    console.log("🔍 Validating connections...");
    await validateConnections(config);
    console.log("✅ All connections validated successfully");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Connection validation failed:", message);
    process.exit(1); // Fail fast
  }

  // Initialize job queue manager
  const jobQueue = new JobQueueManager(config);
  const database = new DatabaseClient(config);

  // Store active SSE connections for real-time updates
  const activeSSEConnections = new Map<string, express.Response>();

  // Create Express app
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", async (_req, res) => {
    try {
      const status = await healthCheck(config);
      res.status(status.status === "healthy" ? 200 : 503).json(status);
    } catch (error: unknown) {
      res.status(503).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

          // Create test run endpoint
          app.post("/api/test-runs", async (req, res, next) => {
            try {
              const { testId } = req.body;

              console.log("Received test run request:", { testId, body: req.body });

              if (!testId) {
                console.error("Missing testId in request body:", req.body);
                res.status(400).json({ error: "testId is required" });
                return;
              }

              if (testId === "undefined" || testId === undefined) {
                console.error("testId is undefined or string 'undefined':", testId);
                res.status(400).json({ error: "testId must be a valid UUID" });
                return;
              }

      // Get test data
      const test = await database.getTest(testId);
      if (!test) {
        console.error("Test not found for testId:", testId);
        res.status(404).json({ error: "Test not found" });
        return;
      }

      // Extract persona_id from test (may be in heuristics.selectedPersona)
      const personaId = test.persona_id;
      if (!personaId) {
        console.error("Test has no persona_id:", test);
        res.status(400).json({ error: "Test does not have a persona assigned" });
        return;
      }

      console.log("Test found, persona_id:", personaId);

      // Get persona data
      const persona = await database.getPersona(personaId);
      if (!persona) {
        console.error("Persona not found for personaId:", personaId);
        res.status(404).json({ error: "Persona not found" });
        return;
      }

      // Get persona version ID (required for test_runs table)
      const personaVersionId = await database.getPersonaVersionId(personaId);
      if (!personaVersionId) {
        console.error("Could not get persona version ID for personaId:", personaId);
        res.status(400).json({ 
          error: "Persona version not found. Please ensure the persona has at least one version." 
        });
        return;
      }

      console.log("Persona version ID:", personaVersionId);

      // Get task count (required for test_runs.total_tasks)
      const taskCount = Array.isArray(test.tasks) ? test.tasks.length : 0;
      if (taskCount === 0) {
        res.status(400).json({ error: "Test must have at least one task" });
        return;
      }

      // Create test run record
      const testRun = await database.createTestRun(testId, personaVersionId, taskCount);

      // Convert to internal types
      const testData = {
        id: test.id,
        title: test.title,
        goal: test.goal,
        tasks: test.tasks,
        url: test.url,
        personaId: test.persona_id || "", // Ensure personaId is always a string
      };

      const personaData = {
        id: persona.id,
        name: persona.name,
        role: persona.role,
        goals: persona.goals,
        behaviors: persona.behaviors,
        frustrations: persona.frustrations,
        constraints: persona.constraints,
        accessibility: persona.accessibility,
        tags: persona.tags || [],
      };

      // Add job to queue
      await jobQueue.addTestRunJob({
        testRunId: testRun.id,
        testId: test.id,
        testData,
        persona: personaData,
      });

      res.status(201).json({
        testRunId: testRun.id,
        status: testRun.status,
        message: "Test run queued successfully",
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  // Get test runs by testId (for polling)
  app.get("/api/test-runs", async (req, res, next) => {
    try {
      const testId = req.query.testId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      if (!testId) {
        res.status(400).json({ error: "testId query parameter is required" });
        return;
      }

      // Get test runs for this test, ordered by created_at descending
      const testRuns = await database.getTestRunsByTestId(testId, limit);
      res.json({ testRuns });
    } catch (error: unknown) {
      next(error);
    }
  });

  // Get test run status endpoint
  app.get("/api/test-runs/:testRunId", async (req, res, next) => {
    try {
      const { testRunId } = req.params;

      const testRun = await database.getTestRun(testRunId);
      if (!testRun) {
        res.status(404).json({ error: "Test run not found" });
        return;
      }

      res.json(testRun);
    } catch (error: unknown) {
      next(error);
    }
  });

  // Cancel test run endpoint
  app.post("/api/test-runs/:testRunId/cancel", async (req, res, next) => {
    try {
      const { testRunId } = req.params;

      const testRun = await database.getTestRun(testRunId);
      if (!testRun) {
        res.status(404).json({ error: "Test run not found" });
        return;
      }

      if (testRun.status === "completed" || testRun.status === "error") {
        res.status(400).json({ error: "Test run is already finished" });
        return;
      }

      const cancelled = await jobQueue.cancelTestRunJob(testRunId);
      if (cancelled) {
        // Emit cancellation event to SSE if connected
        const sseConnection = activeSSEConnections.get(testRunId);
        if (sseConnection) {
          sseConnection.write(`data: ${JSON.stringify({ type: "cancelled", data: { testRunId } })}\n\n`);
        }
        res.json({ message: "Test run cancelled successfully", testRunId });
      } else {
        res.status(500).json({ error: "Failed to cancel test run" });
      }
    } catch (error: unknown) {
      next(error);
    }
  });

  // SSE stream endpoint for real-time updates
  app.get("/api/test-runs/:testRunId/stream", (req, res, next) => {
    try {
      const { testRunId } = req.params;

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      // Store connection
      activeSSEConnections.set(testRunId, res);

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: "connected", data: { testRunId } })}\n\n`);

      // Handle client disconnect
      req.on("close", () => {
        activeSSEConnections.delete(testRunId);
        res.end();
      });

      // Handle errors
      req.on("error", (error) => {
        console.error(`SSE connection error for test run ${testRunId}:`, error);
        activeSSEConnections.delete(testRunId);
        res.end();
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  // Helper function to emit SSE events (used by job queue)
  function emitSSEEvent(testRunId: string, eventType: string, data: unknown): void {
    const connection = activeSSEConnections.get(testRunId);
    if (connection) {
      try {
        connection.write(`data: ${JSON.stringify({ type: eventType, data })}\n\n`);
      } catch (error) {
        console.error(`Error emitting SSE event for test run ${testRunId}:`, error);
        activeSSEConnections.delete(testRunId);
      }
    }
  }

  // Make emitSSEEvent available to job queue
  jobQueue.emitSSEEvent = emitSSEEvent;

  // Reasoning/analysis endpoint
  app.post("/api/reasoning", async (req, res, next) => {
    try {
      await handleReasoningRequest(req, res);
    } catch (error: unknown) {
      next(error);
    }
  });

  // Get report/findings endpoint
  // Get session recording events endpoint
  app.get("/api/sessions/:sessionId/recording", async (req, res, next) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({ error: "Session ID is required" });
        return;
      }

      console.log(`Fetching recording for session: ${sessionId}`);

      // Import Browserbase SDK dynamically
      const { Browserbase } = await import("@browserbasehq/sdk");
      const browserbase = new Browserbase({
        apiKey: config.browserbase.apiKey,
      });

      // First, check if the session exists and its status
      try {
        const session = await browserbase.sessions.retrieve(sessionId);
        console.log(`Session status: ${session.status}, created: ${session.createdAt}`);
        
        // If session is still active, recording won't be available yet
        // Browserbase session statuses are uppercase: "RUNNING", "ERROR", "TIMED_OUT", "COMPLETED"
        if (session.status === "RUNNING") {
          res.status(404).json({
            error: "Recording not available yet. The session is still active. Recordings are available about 30 seconds after the session closes.",
          });
          return;
        }
      } catch (sessionError: unknown) {
        console.warn("Could not retrieve session info:", sessionError);
        // Continue to try fetching recording anyway
      }

      // Retrieve recording events
      // RecordingRetrieveResponse is an Array<SessionRecording>, where each SessionRecording has:
      // { data: Record<string, unknown>, sessionId: string, timestamp: number, type: number }
      try {
        const replay = await browserbase.sessions.recording.retrieve(sessionId);

        // replay is an array of SessionRecording objects
        if (!replay || !Array.isArray(replay) || replay.length === 0) {
          res.status(404).json({
            error: "Recording not available. Recordings are available about 30 seconds after session close. If the session closed recently, please wait a moment and try again.",
          });
          return;
        }

        console.log(`Retrieved ${replay.length} recording events for session ${sessionId}`);

        // Return the array of events (each SessionRecording is an event)
        res.json({
          events: replay,
          sessionId: sessionId,
        });
      } catch (recordingError: unknown) {
        console.error("Error retrieving recording:", recordingError);
        
        if (recordingError instanceof Error) {
          // Check for specific Browserbase API errors
          if (recordingError.message.includes("not found") || 
              recordingError.message.includes("404") ||
              recordingError.message.includes("does not exist")) {
            res.status(404).json({
              error: "Recording not found. Recordings are available about 30 seconds after session close. If the session closed recently, please wait a moment and try again.",
            });
            return;
          }
        }

        // Re-throw to be handled by error handler
        throw recordingError;
      }
    } catch (error: unknown) {
      console.error("Error fetching recording events:", error);

      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });

        if (error.message.includes("not found") || error.message.includes("404")) {
          res.status(404).json({
            error: "Recording not found. Recordings are available about 30 seconds after session close.",
          });
          return;
        }
      }

      next(error);
    }
  });

  app.get("/api/reports/:testRunId", async (req, res, next) => {
    try {
      const { testRunId } = req.params;

      const findings = await database.getFindings(testRunId);
      
      if (findings.length === 0) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      res.json({
        testRunId,
        findings,
        findingsCount: findings.length,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  // Root endpoint
  app.get("/", (_req, res) => {
    res.json({
      service: "test-runner",
      version: "1.0.0",
      status: "running",
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  // Start server
  const port = config.port || 3001;
  app.listen(port, () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutdown signal received, closing connections...");
    try {
      await jobQueue.close();
    } catch (error: unknown) {
      console.error("Error closing job queue:", error);
    }
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
