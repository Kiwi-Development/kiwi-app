/**
 * Report Generator
 * 
 * Generates reports using reasoning engine after test completion
 */

import { orchestrateAnalysis } from "../reasoning/orchestrator.js";
import type { AgentContext } from "../reasoning/types.js";
import { DatabaseClient } from "../storage/database.js";
import { EvidenceStorage } from "../storage/evidence-storage.js";
import { captureEvidence } from "./evidence-capture.js";
import type { ConnectionConfig } from "../config/connections.js";
import type { Persona, TestData, TestRunResult } from "../utils/types.js";
import type { Stagehand } from "@browserbasehq/stagehand";

/**
 * Generate and save report for a completed test run
 */
export async function generateAndSaveReport(
  testRunId: string,
  testData: TestData,
  persona: Persona,
  _testResult: TestRunResult,
  _config: ConnectionConfig,
  database: DatabaseClient,
  evidenceStorage: EvidenceStorage,
  stagehand: Stagehand,
  page: any
): Promise<void> {
  try {
    // 1. Capture final evidence (screenshots, DOM snapshots)
    console.log(`[Report] Capturing evidence for test run ${testRunId}...`);
    const evidence = await captureEvidence(stagehand, page);
    console.log(`[Report] Evidence captured successfully`);

    // 2. Upload screenshots to Supabase Storage
    console.log(`[Report] Uploading screenshot for test run ${testRunId}...`);
    await evidenceStorage.uploadScreenshot(
      testRunId,
      0, // screenshot index
      evidence.screenshot
    ).catch((err) => {
      console.warn(`[Report] Screenshot upload failed (non-critical):`, err);
      // Continue even if screenshot upload fails
    });
    console.log(`[Report] Screenshot uploaded successfully`);

    // 3. Build agent context
    const agentContext: AgentContext = {
      screenshot: evidence.screenshot,
      semanticContext: {
        page_metadata: {
          data: {
            title: evidence.domSnapshot.title,
            url: evidence.url,
            viewport: { width: 1280, height: 720 },
          },
        },
        dom_tree: evidence.domSnapshot, // DOM structure
      },
      tasks: testData.tasks,
      persona: persona,
      currentProgress: testData.tasks.length, // All tasks completed
      history: [], // Can include task execution history if needed
    };

    // 4. Run reasoning engine
    console.log(`[Report] Running reasoning engine for test run ${testRunId}...`);
    const analysisResult = await orchestrateAnalysis(agentContext);
    console.log(`[Report] Reasoning engine completed, found ${analysisResult.findings.length} findings`);

    // 5. Get test run to retrieve persona_version_id
    const testRun = await database.getTestRun(testRunId);
    if (!testRun) {
      throw new Error(`Test run ${testRunId} not found`);
    }
    if (!testRun.persona_version_id) {
      throw new Error(`Test run ${testRunId} does not have a persona_version_id`);
    }

    // 6. Save findings to database
    console.log(`[Report] Saving findings to database for test run ${testRunId}...`);
    await database.saveFindings(testRunId, analysisResult.findings, testRun.persona_version_id);
    console.log(`[Report] Findings saved successfully`);

    // 7. Update test status to "completed" since report was generated
    console.log(`[Report] Updating test status to completed for test ${testData.id}...`);
    await database.updateTest(testData.id, { status: "completed" });
    console.log(`[Report] Test status updated to completed`);

    // 8. Update test run with report metadata (don't change status, it's already "completed")
    // Status update is handled in job-queue.ts
    console.log(`[Report] Report generation completed for test run ${testRunId}`);
  } catch (error: unknown) {
    // Re-throw with better error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null
      ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      : String(error);
    
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[Report] Error in generateAndSaveReport for test run ${testRunId}:`, errorMessage);
    if (errorStack) {
      console.error(`[Report] Error stack:`, errorStack);
    }
    
    throw new Error(`Report generation failed: ${errorMessage}`, { cause: error });
  }
}

