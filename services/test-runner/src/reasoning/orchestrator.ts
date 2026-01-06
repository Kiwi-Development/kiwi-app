/**
 * Multi-Agent Orchestrator
 *
 * Coordinates the workflow of specialist agents and synthesizes their findings
 */

import { uxAuditorAgent } from "./agents/ux-auditor.js";
import { accessibilitySpecialistAgent } from "./agents/accessibility-specialist.js";
import { conversionExpertAgent } from "./agents/conversion-expert.js";
import { synthesizeFindings } from "./synthesis.js";
import type { AgentContext, AgentFinding, EvidenceSnippet } from "./types.js";

// Re-export types for backwards compatibility
export type { AgentContext, AgentFinding, EvidenceSnippet };

export interface OrchestrationResult {
  findings: AgentFinding[];
  synthesis: {
    highPriorityIssues: AgentFinding[];
    mediumPriorityIssues: AgentFinding[];
    lowPriorityIssues: AgentFinding[];
    summary: string;
  };
  agentReports: {
    uxAuditor: AgentFinding[];
    accessibilitySpecialist: AgentFinding[];
    conversionExpert: AgentFinding[];
  };
}

/**
 * Orchestrate multi-agent analysis
 */
export async function orchestrateAnalysis(context: AgentContext): Promise<OrchestrationResult> {
  console.log("🎯 Starting multi-agent orchestration...");

  // Run all agents in parallel
  const [uxFindings, a11yFindings, conversionFindings] = await Promise.all([
    uxAuditorAgent(context),
    accessibilitySpecialistAgent(context),
    conversionExpertAgent(context),
  ]);

  console.log(`✅ UX Auditor found ${uxFindings.length} issues`);
  console.log(`✅ Accessibility Specialist found ${a11yFindings.length} issues`);
  console.log(`✅ Conversion Expert found ${conversionFindings.length} issues`);

  // Synthesize findings
  const allFindings = [...uxFindings, ...a11yFindings, ...conversionFindings];
  const synthesis = synthesizeFindings(allFindings);

  return {
    findings: synthesis.allFindings,
    synthesis: {
      highPriorityIssues: synthesis.highPriority,
      mediumPriorityIssues: synthesis.mediumPriority,
      lowPriorityIssues: synthesis.lowPriority,
      summary: synthesis.summary,
    },
    agentReports: {
      uxAuditor: uxFindings,
      accessibilitySpecialist: a11yFindings,
      conversionExpert: conversionFindings,
    },
  };
}

/**
 * Format context for agent prompts
 */
export function formatContextForAgent(context: AgentContext): string {
  let formatted = "";

  // Page metadata
  if (context.semanticContext.page_metadata?.data) {
    const meta = context.semanticContext.page_metadata.data;
    formatted += `Page: ${meta.title || "Untitled"}\n`;
    formatted += `URL: ${meta.url || "Unknown"}\n`;
    formatted += `Viewport: ${meta.viewport?.width || 0}x${meta.viewport?.height || 0}\n\n`;
  }

  // DOM structure summary
  if (context.semanticContext.dom_tree) {
    formatted += "DOM Structure: Available\n";
  }

  // Accessibility tree summary
  if (context.semanticContext.accessibility_tree) {
    formatted += "Accessibility Tree: Available\n";
  }

  // Figma metadata (optional - only if available)
  if (context.semanticContext.figma_metadata) {
    const figmaMeta = context.semanticContext.figma_metadata as Record<string, unknown>;
    if (figmaMeta.metadata_available) {
      formatted += "Figma Metadata: Available (enhanced)\n";
    } else if (figmaMeta.public) {
      formatted += "Figma Metadata: Public file (using DOM/A11y extraction)\n";
    } else {
      formatted += "Figma Metadata: Available\n";
    }
  }

  // Tasks
  formatted += `\nTasks to complete:\n`;
  context.tasks.forEach((task, i) => {
    formatted += `${i + 1}. ${task}\n`;
  });

  // Persona - FULL DETAILS for persona-specific analysis
  formatted += `\n=== PERSONA CONTEXT (CRITICAL FOR ANALYSIS) ===\n`;
  formatted += `Name: ${context.persona.name}\n`;
  formatted += `Role: ${context.persona.role}\n`;
  if (context.persona.description) {
    formatted += `Description: ${context.persona.description}\n`;
  }
  if (context.persona.goals && context.persona.goals.length > 0) {
    formatted += `Goals: ${context.persona.goals.join(", ")}\n`;
  }
  if (context.persona.behaviors && context.persona.behaviors.length > 0) {
    formatted += `Behaviors: ${context.persona.behaviors.join(", ")}\n`;
  }
  if (context.persona.frustrations && context.persona.frustrations.length > 0) {
    formatted += `Frustrations: ${context.persona.frustrations.join(", ")}\n`;
  }
  if (context.persona.constraints && context.persona.constraints.length > 0) {
    formatted += `Constraints: ${context.persona.constraints.join(", ")}\n`;
  }
  if (context.persona.accessibility && context.persona.accessibility.length > 0) {
    formatted += `Accessibility Needs: ${context.persona.accessibility.join(", ")}\n`;
  }
  if (context.persona.tags && context.persona.tags.length > 0) {
    formatted += `Tags: ${context.persona.tags.join(", ")}\n`;
  }
  formatted += `\n`;

  return formatted;
}
