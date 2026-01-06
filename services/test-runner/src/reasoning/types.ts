/**
 * Reasoning Engine Types
 * 
 * Type definitions for the reasoning engine
 */

export type KnowledgeCategory =
  | "ux_laws"
  | "wcag"
  | "growth_patterns"
  | "design_principles"
  | "nielsen_heuristics"
  | "kiwi_rubric";

export interface KnowledgeChunk {
  id: string;
  category: KnowledgeCategory | string;
  source: string;
  title: string;
  content: string;
  embedding?: number[];
  similarity?: number;
}

export interface EvidenceSnippet {
  persona_name: string;
  persona_role: string;
  task_context: string;
  what_happened_steps: string[];
  persona_quote?: string;
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

export interface RunEvent {
  id: string;
  t: number;
  type: string;
  label: string;
  details?: string;
}

export interface KnowledgeCitation {
  chunk_id: string;
  source: string;
  title: string;
  category: string;
  content?: string;
}

/**
 * Agent Finding - finding from an agent
 */
export interface AgentFinding {
  title: string;
  severity: "Blocker" | "High" | "Med" | "Low";
  confidence: number;
  confidence_level: "Low" | "Med" | "High"; // Derived from confidence number
  description: string;
  suggestedFix: string;
  affectingTasks?: string[];
  triggeredByTasks?: string[];
  triggeredByPersonas?: string[];
  category:
    | "navigation"
    | "copy"
    | "affordance_feedback"
    | "forms"
    | "hierarchy"
    | "accessibility"
    | "conversion"
    | "other";
  citations: KnowledgeCitation[];
  elementSelector?: string;
  elementPosition?: { x: number; y: number; width: number; height: number };
  evidenceSnippets?: EvidenceSnippet[];
  evidence_snippets?: EvidenceSnippet[]; // Legacy field name for compatibility
}

export interface SemanticContext {
  dom_tree?: Record<string, unknown>;
  accessibility_tree?: Record<string, unknown>;
  page_metadata?: {
    data?: {
      title?: string;
      url?: string;
      viewport?: { width?: number; height?: number };
    };
  };
  figma_metadata?: Record<string, unknown>;
}

export interface PersonaContext {
  name: string;
  role: string;
  description?: string;
  goals?: string[];
  behaviors?: string[];
  frustrations?: string[];
  constraints?: string[];
  accessibility?: string[];
  tags?: string[];
}

export interface AgentContext {
  screenshot: string; // base64 encoded
  semanticContext: SemanticContext;
  tasks: string[];
  persona: PersonaContext;
  currentProgress?: number;
  history?: Array<{ role: string; content?: string }>;
}
