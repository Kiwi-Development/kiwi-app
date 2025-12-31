/**
 * Output Format Router
 * 
 * Routes findings to appropriate output format based on issue type
 */

import { AgentFinding } from '../reasoning-engine/orchestrator';
import { generateCodeSnippets, CodeSnippet } from './code-snippets';
import { generateSpec, Spec } from './specs';
import { generateTicket, Ticket } from './tickets';

export interface DeveloperOutputs {
  code_snippets: CodeSnippet[];
  specs: Spec | null;
  tickets: {
    github: Ticket | null;
    jira: Ticket | null;
  };
}

/**
 * Generate all developer outputs for a finding
 */
export function generateDeveloperOutputs(finding: AgentFinding): DeveloperOutputs {
  return {
    code_snippets: generateCodeSnippets(finding),
    specs: generateSpec(finding),
    tickets: {
      github: generateTicket(finding, 'github'),
      jira: generateTicket(finding, 'jira'),
    },
  };
}

/**
 * Determine which output format is most appropriate for a finding
 */
export function getRecommendedFormat(finding: AgentFinding): 'code' | 'spec' | 'ticket' {
  // Code snippets for visual/styling issues
  if (
    finding.category === 'accessibility' ||
    finding.description.toLowerCase().includes('css') ||
    finding.description.toLowerCase().includes('style') ||
    finding.description.toLowerCase().includes('tailwind')
  ) {
    return 'code';
  }

  // Specs for component/architecture issues
  if (
    finding.description.toLowerCase().includes('component') ||
    finding.description.toLowerCase().includes('architecture') ||
    finding.description.toLowerCase().includes('structure')
  ) {
    return 'spec';
  }

  // Tickets for complex multi-step fixes
  if (finding.severity === 'High' || finding.affectingTasks.length > 1) {
    return 'ticket';
  }

  // Default to code for most issues
  return 'code';
}

