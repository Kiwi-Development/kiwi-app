/**
 * Centralized type exports
 *
 * Import types from this file for better organization:
 * import type { RunStatus, RunEvent } from '@/types';
 */

// Run types
export type { RunStatus, RunEventType, RunEvent, PersonaProgress, LiveRunState } from "./runs";

// Evidence types
export type { UIAnchor, EvidenceSnippet } from "./evidence";

// Context types
export type {
  PageMetadata,
  FigmaMetadata,
  SemanticContext,
  PersonaContext,
  AgentContext,
  KnowledgeCitation,
  AgentFinding,
} from "./context";

// Finding types
export type {
  FindingSeverity,
  FindingCategory,
  DeveloperOutput,
  ValidationStatus,
  Finding,
  ComparisonFinding,
} from "./findings";

// Comparison types
export type {
  Regression,
  ConfusionHotspot,
  FindingCounts,
  ComparisonResult,
  MultiRunComparison,
  MultiTestComparison,
} from "./comparison";

// Knowledge types
export type { KnowledgeCategory, KnowledgeChunkMetadata, KnowledgeChunk } from "./knowledge";

// API types (deprecated - no longer used with Stagehand v3)
// export type {
//   SessionStartResponse,
//   ScreenshotResponse,
//   ClickResponse,
// } from "./api";

// Database types
export type { FeedbackEntryRow, TestRunRow, KnowledgeChunkRow } from "./database";
