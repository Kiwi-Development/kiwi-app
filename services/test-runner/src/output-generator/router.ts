/**
 * Output Generator Router
 * 
 * Generates developer-friendly outputs from findings
 */

import type { AgentFinding } from "../reasoning/types.js";
import { generateCodeSnippets } from "./code-snippets.js";
import { generateSpecs } from "./specs.js";
import { generateTickets } from "./tickets.js";

export interface DeveloperOutput {
  codeSnippets?: string[];
  specs?: string[];
  tickets?: string[];
}

export function generateDeveloperOutputs(finding: AgentFinding): DeveloperOutput {
  const outputs: DeveloperOutput = {};

  // Generate code snippets if applicable
  if (finding.suggestedFix) {
    outputs.codeSnippets = generateCodeSnippets(finding);
  }

  // Generate specs if applicable
  if (finding.description) {
    outputs.specs = generateSpecs(finding);
  }

  // Generate tickets if applicable
  outputs.tickets = generateTickets(finding);

  return outputs;
}

