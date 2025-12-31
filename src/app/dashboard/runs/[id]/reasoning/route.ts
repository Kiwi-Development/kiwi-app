/**
 * Reasoning Engine API Route
 * 
 * Uses the multi-agent reasoning engine to analyze designs
 */

import { NextResponse } from "next/server";
import { orchestrateAnalysis, AgentContext } from "../../../../../lib/reasoning-engine/orchestrator";
import { generateDeveloperOutputs } from "../../../../../lib/output-generator/router";

export async function POST(req: Request) {
  try {
    const {
      screenshot,
      semanticContext,
      tasks,
      persona,
      currentProgress,
      useReasoningEngine = true, // Feature flag for backward compatibility
    } = await req.json();

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot is required" }, { status: 400 });
    }

    // If reasoning engine is disabled, return early (fallback to old system)
    if (!useReasoningEngine) {
      return NextResponse.json({
        useReasoningEngine: false,
        message: "Reasoning engine disabled, using legacy system",
      });
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
    const findingsWithOutputs = result.findings.map(finding => {
      const outputs = generateDeveloperOutputs(finding);
      return {
        ...finding,
        developerOutputs: outputs,
      };
    });

    return NextResponse.json({
      useReasoningEngine: true,
      findings: findingsWithOutputs,
      synthesis: result.synthesis,
      agentReports: result.agentReports,
    });
  } catch (error) {
    console.error("[Reasoning Engine] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

