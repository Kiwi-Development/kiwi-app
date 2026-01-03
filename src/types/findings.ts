import type { EvidenceSnippet, UIAnchor } from "./evidence";
import type { KnowledgeCitation } from "./context";

/**
 * Finding severity levels
 */
export type FindingSeverity = "Blocker" | "High" | "Med" | "Low";

/**
 * Finding categories
 */
export type FindingCategory =
  | "navigation"
  | "copy"
  | "affordance_feedback"
  | "forms"
  | "hierarchy"
  | "accessibility"
  | "conversion"
  | "other";

/**
 * Developer Output types
 */
export interface DeveloperOutput {
  codeSnippets?: Array<{
    type: string;
    language: string;
    code: string;
    description: string;
  }>;
  specs?: Array<{
    type: string;
    content: string;
    description: string;
  }>;
  tickets?: Array<{
    type: string;
    title: string;
    body: string;
    labels: string[];
  }>;
}

/**
 * Validation status
 */
export type ValidationStatus = "validated" | "refuted" | null;

/**
 * Finding - full finding structure (from database)
 */
export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  confidence: number;
  description: string;
  suggestedFix: string;
  affectingTasks: string[];
  frequency?: number;
  category?: FindingCategory;
  evidence_snippets?: EvidenceSnippet[];
  knowledge_citations?: KnowledgeCitation[];
  developer_outputs?: DeveloperOutput;
  validated?: ValidationStatus;
  note?: string;
  [key: string]: unknown; // Allow additional properties from database
}

/**
 * Finding from comparison engine (may have different structure)
 */
export interface ComparisonFinding extends Omit<Finding, "id"> {
  id: string;
  // Additional fields specific to comparison
}
