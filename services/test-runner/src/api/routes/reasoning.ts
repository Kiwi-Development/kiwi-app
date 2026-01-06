/**
 * Reasoning API Route
 * 
 * Handles reasoning/analysis requests
 * This endpoint can be called from the Next.js frontend
 */

import type { Request, Response } from "express";
import { orchestrateAnalysis } from "../../reasoning/orchestrator.js";
import type { AgentContext } from "../../reasoning/types.js";
import { generateDeveloperOutputs } from "../../output-generator/router.js";

export async function handleReasoningRequest(req: Request, res: Response) {
  try {
    const {
      screenshot,
      semanticContext,
      tasks,
      persona,
      currentProgress,
      useReasoningEngine = true,
    } = req.body;

    if (!screenshot) {
      res.status(400).json({ error: "Screenshot is required" });
      return;
    }

    // If reasoning engine is disabled, return early (fallback to old system)
    if (!useReasoningEngine) {
      res.json({
        useReasoningEngine: false,
        message: "Reasoning engine disabled, using legacy system",
      });
      return;
    }

    // Build agent context
    const agentContext: AgentContext = {
      screenshot,
      semanticContext: semanticContext || {},
      tasks: tasks || [],
      persona: persona || { name: "Unknown", role: "User" },
      currentProgress,
      history: [],
    };

    // Run orchestration
    console.log("[Reasoning Engine] Starting analysis...");
    const result = await orchestrateAnalysis(agentContext);

    // Generate developer outputs for each finding
    const findingsWithOutputs = result.findings.map((finding) => {
      const outputs = generateDeveloperOutputs(finding);
      return {
        ...finding,
        developerOutputs: outputs,
      };
    });

    res.json({
      useReasoningEngine: true,
      findings: findingsWithOutputs,
      synthesis: result.synthesis,
      agentReports: result.agentReports,
    });
  } catch (error: unknown) {
    console.error("[Reasoning Engine] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}

