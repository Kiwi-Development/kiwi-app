/**
 * Multi-Agent Orchestrator
 * 
 * Coordinates the workflow of specialist agents and synthesizes their findings
 */

import { retrieveKnowledgeForIssue } from '../knowledge-base/retrieval';
import { uxAuditorAgent } from './agents/ux-auditor';
import { accessibilitySpecialistAgent } from './agents/accessibility-specialist';
import { conversionExpertAgent } from './agents/conversion-expert';
import { synthesizeFindings } from './synthesis';

export interface AgentContext {
  screenshot: string; // Base64 encoded screenshot
  semanticContext: {
    dom_tree?: any;
    accessibility_tree?: any;
    page_metadata?: any;
    figma_metadata?: any;
  };
  tasks: string[];
  persona: {
    name: string;
    role: string;
    description?: string;
  };
  currentProgress?: number;
  history?: Array<{ role: string; content?: string }>;
}

export interface EvidenceSnippet {
  persona_name: string;
  persona_role: string;
  task_context: string;
  what_happened_steps: string[]; // 2-6 bullet sequence
  persona_quote?: string; // What the persona "said/thought"
  ui_anchor?: {
    frame_name?: string;
    element_label?: string;
    bounding_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    element_selector?: string;
  };
  timestamp?: string;
  screenshot_index?: number;
}

export interface AgentFinding {
  title: string;
  severity: 'Blocker' | 'High' | 'Med' | 'Low';
  confidence: number;
  confidence_level: 'Low' | 'Med' | 'High'; // Derived from confidence number
  description: string;
  suggestedFix: string;
  affectingTasks: string[];
  category: 'navigation' | 'copy' | 'affordance_feedback' | 'forms' | 'hierarchy' | 'accessibility' | 'conversion' | 'other';
  citations: Array<{
    chunk_id: string;
    source: string;
    title: string;
    category: string;
  }>;
  elementSelector?: string;
  elementPosition?: { x: number; y: number; width: number; height: number };
  evidence_snippets?: EvidenceSnippet[]; // Evidence for this finding
}

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
export async function orchestrateAnalysis(
  context: AgentContext
): Promise<OrchestrationResult> {
  console.log('🎯 Starting multi-agent orchestration...');

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
  let formatted = '';

  // Page metadata
  if (context.semanticContext.page_metadata) {
    const meta = context.semanticContext.page_metadata.data;
    formatted += `Page: ${meta.title || 'Untitled'}\n`;
    formatted += `URL: ${meta.url || 'Unknown'}\n`;
    formatted += `Viewport: ${meta.viewport?.width || 0}x${meta.viewport?.height || 0}\n\n`;
  }

  // DOM structure summary
  if (context.semanticContext.dom_tree) {
    formatted += 'DOM Structure: Available\n';
  }

  // Accessibility tree summary
  if (context.semanticContext.accessibility_tree) {
    formatted += 'Accessibility Tree: Available\n';
  }

  // Figma metadata (optional - only if available)
  if (context.semanticContext.figma_metadata) {
    const figmaMeta = context.semanticContext.figma_metadata;
    if (figmaMeta.metadata_available) {
      formatted += 'Figma Metadata: Available (enhanced)\n';
    } else if (figmaMeta.public) {
      formatted += 'Figma Metadata: Public file (using DOM/A11y extraction)\n';
    } else {
      formatted += 'Figma Metadata: Available\n';
    }
  }

  // Tasks
  formatted += `\nTasks to complete:\n`;
  context.tasks.forEach((task, i) => {
    formatted += `${i + 1}. ${task}\n`;
  });

  // Persona
  formatted += `\nPersona: ${context.persona.name} (${context.persona.role})\n`;
  if (context.persona.description) {
    formatted += `Context: ${context.persona.description}\n`;
  }

  return formatted;
}

