import type { EvidenceSnippet } from "./evidence";

/**
 * Page Metadata structure
 */
export interface PageMetadata {
  data: {
    title?: string;
    url?: string;
    viewport?: {
      width: number;
      height: number;
    };
  };
}

/**
 * Figma Metadata structure
 */
export interface FigmaMetadata {
  public?: boolean;
  metadata_available?: boolean;
  note?: string;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Semantic Context - contains DOM, accessibility, and metadata
 */
export interface SemanticContext {
  dom_tree?: Record<string, unknown>; // DOM structure (can be complex, using Record for flexibility)
  accessibility_tree?: Record<string, unknown>; // Accessibility tree (can be complex, using Record for flexibility)
  page_metadata?: PageMetadata;
  figma_metadata?: FigmaMetadata;
}

/**
 * Persona structure for agent context
 */
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

/**
 * Agent Context - full context passed to agents
 */
export interface AgentContext {
  screenshot: string; // Base64 encoded screenshot
  semanticContext: SemanticContext;
  tasks: string[];
  persona: PersonaContext;
  currentProgress?: number;
  history?: Array<{ role: string; content?: string }>;
}

/**
 * Knowledge Citation
 */
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
  affectingTasks: string[];
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
  evidence_snippets?: EvidenceSnippet[]; // Evidence for this finding
}
