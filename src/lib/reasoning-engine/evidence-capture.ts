/**
 * Evidence Capture Utility
 * 
 * Captures evidence snippets during test runs for findings
 */

import { EvidenceSnippet } from './orchestrator';
import type { RunEvent } from '../types';

export interface EvidenceCaptureState {
  currentTask: string;
  currentStep: number;
  interactionSteps: string[];
  personaQuotes: string[];
  lastScreenshotIndex: number;
  lastUIAnchor?: {
    frame_name?: string;
    element_label?: string;
    bounding_box?: { x: number; y: number; width: number; height: number };
    element_selector?: string;
  };
}

/**
 * Extract evidence from test run events and state
 */
export function extractEvidenceFromRun(
  events: RunEvent[],
  personaName: string,
  personaRole: string,
  taskContext: string,
  screenshotIndex: number,
  uiAnchor?: {
    frame_name?: string;
    element_label?: string;
    bounding_box?: { x: number; y: number; width: number; height: number };
    element_selector?: string;
  }
): EvidenceSnippet {
  // Extract "what happened" steps from recent events (last 2-6 relevant events)
  const relevantEvents = events
    .filter((e) => e.type === 'click' || e.type === 'submit' || e.type === 'error')
    .slice(-6); // Get last 6 relevant events

  const whatHappenedSteps = relevantEvents.map((event, idx) => {
    if (event.type === 'click') {
      return event.label || `Step ${idx + 1}: Clicked on ${event.details || 'element'}`;
    } else if (event.type === 'submit') {
      return event.label || `Step ${idx + 1}: Submitted form`;
    } else if (event.type === 'error') {
      return event.label || `Step ${idx + 1}: Encountered error`;
    }
    return event.label || `Step ${idx + 1}: ${event.type}`;
  });

  // Extract persona quote from logs (look for agent messages/rationales)
  const logs = events
    .filter((e) => e.details && e.details.includes('Agent:'))
    .map((e) => e.details?.replace('Agent:', '').trim())
    .filter((q) => q && q.length > 0);

  const personaQuote = logs.length > 0 ? logs[logs.length - 1] : undefined;

  return {
    persona_name: personaName,
    persona_role: personaRole,
    task_context: taskContext,
    what_happened_steps: whatHappenedSteps.length > 0 ? whatHappenedSteps : [
      'User interacted with the interface',
      'Issue was encountered during task completion'
    ],
    persona_quote: personaQuote,
    ui_anchor: uiAnchor,
    screenshot_index: screenshotIndex,
  };
}

/**
 * Map agent category to finding category
 */
export function mapAgentCategoryToFindingCategory(
  agentCategory: 'ux' | 'accessibility' | 'conversion'
): 'navigation' | 'copy' | 'affordance_feedback' | 'forms' | 'hierarchy' | 'accessibility' | 'conversion' | 'other' {
  const categoryMap: Record<string, 'navigation' | 'copy' | 'affordance_feedback' | 'forms' | 'hierarchy' | 'accessibility' | 'conversion' | 'other'> = {
    'ux': 'other', // Will be refined by agent
    'accessibility': 'accessibility',
    'conversion': 'conversion',
  };
  return categoryMap[agentCategory] || 'other';
}

/**
 * Map confidence number to confidence level
 */
export function mapConfidenceToLevel(confidence: number): 'Low' | 'Med' | 'High' {
  if (confidence >= 70) return 'High';
  if (confidence >= 40) return 'Med';
  return 'Low';
}

