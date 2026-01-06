/**
 * Evidence Capture Utility
 *
 * Captures evidence snippets during test runs for findings
 */

import type { EvidenceSnippet, RunEvent } from "./types.js";

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
 * Enhanced to include detailed action sequences and agent rationale
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
  },
  // Additional context for richer evidence
  clickHistory?: Array<{ x: number; y: number; timestamp: number; screenshot?: string }>,
  agentHistory?: Array<{ role: string; content?: string }>
): EvidenceSnippet {
  // Extract "what happened" steps from recent events (last 2-6 relevant events)
  const relevantEvents = events
    .filter((e) => e.type === "click" || e.type === "submit" || e.type === "error")
    .slice(-6); // Get last 6 relevant events

  // Build detailed action sequence with click coordinates and context
  const whatHappenedSteps: string[] = [];

  relevantEvents.forEach((event, idx) => {
    if (event.type === "click") {
      // Try to get click coordinates from click history by matching index
      // Since events and clickHistory should be in sync, match by position
      const clickInfo =
        clickHistory && clickHistory.length > idx
          ? clickHistory[clickHistory.length - relevantEvents.length + idx]
          : undefined;

      if (clickInfo) {
        whatHappenedSteps.push(
          `Step ${idx + 1}: Clicked at (${clickInfo.x}, ${clickInfo.y}) - ${event.label || event.details || "interacted with element"}`
        );
      } else {
        whatHappenedSteps.push(
          event.label || `Step ${idx + 1}: Clicked on ${event.details || "element"}`
        );
      }
    } else if (event.type === "submit") {
      whatHappenedSteps.push(event.label || `Step ${idx + 1}: Submitted form`);
    } else if (event.type === "error") {
      whatHappenedSteps.push(
        event.label || `Step ${idx + 1}: Encountered error: ${event.details || "Unknown error"}`
      );
    } else {
      whatHappenedSteps.push(event.label || `Step ${idx + 1}: ${event.type}`);
    }
  });

  // If no steps extracted, create default steps
  if (whatHappenedSteps.length === 0) {
    whatHappenedSteps.push("User interacted with the interface");
    whatHappenedSteps.push("Issue was encountered during task completion");
  }

  // Extract persona quote from agent history (more reliable than events)
  let personaQuote: string | undefined = undefined;

  // First, try to get rationale from agent history (tool calls with rationale)
  if (agentHistory) {
    // Look for assistant messages with tool calls that have rationale
    for (let i = agentHistory.length - 1; i >= 0; i--) {
      const msg = agentHistory[i];
      if (msg.role === "assistant" && msg.content) {
        // Try to parse rationale from tool call JSON
        try {
          const toolCallMatch = msg.content.match(/rationale["\s:]+"([^"]+)"/i);
          if (toolCallMatch && toolCallMatch[1]) {
            personaQuote = toolCallMatch[1];
            break;
          }
        } catch {
          // Continue searching
        }

        // If no JSON found, use the content directly if it's short and meaningful
        if (!personaQuote && msg.content.length < 200 && msg.content.length > 10) {
          personaQuote = msg.content;
          break;
        }
      }
    }
  }

  // Fallback: Extract from event logs
  if (!personaQuote) {
    const logs = events
      .filter((e) => e.details && (e.details.includes("Agent:") || e.details.includes("rationale")))
      .map((e) => {
        const match = e.details?.match(/(?:Agent:|rationale["\s:]+")([^"]+)/i);
        return match ? match[1].trim() : e.details?.replace(/Agent:/, "").trim();
      })
      .filter((q) => q && q.length > 0 && q.length < 200);

    personaQuote = logs.length > 0 ? logs[logs.length - 1] : undefined;
  }

  // Add context about what the agent was trying to do (from recent agent history)
  if (agentHistory && agentHistory.length > 0) {
    const recentAssistantMessages = agentHistory
      .slice(-5)
      .filter((m) => m.role === "assistant" && m.content)
      .map((m) => m.content)
      .filter((c) => c && c.length < 300);

    // If we have context but no quote, use the most recent assistant message
    if (!personaQuote && recentAssistantMessages.length > 0) {
      const lastMessage = recentAssistantMessages[recentAssistantMessages.length - 1];
      if (lastMessage && lastMessage.length > 20) {
        // Extract a meaningful snippet (first sentence or first 100 chars)
        personaQuote = lastMessage.split(".")[0].substring(0, 150);
      }
    }
  }

  return {
    persona_name: personaName,
    persona_role: personaRole,
    task_context: taskContext,
    what_happened_steps: whatHappenedSteps,
    persona_quote: personaQuote,
    ui_anchor: uiAnchor,
    screenshot_index: screenshotIndex,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Map agent category to finding category
 */
export function mapAgentCategoryToFindingCategory(
  agentCategory: "ux" | "accessibility" | "conversion"
):
  | "navigation"
  | "copy"
  | "affordance_feedback"
  | "forms"
  | "hierarchy"
  | "accessibility"
  | "conversion"
  | "other" {
  const categoryMap: Record<
    string,
    | "navigation"
    | "copy"
    | "affordance_feedback"
    | "forms"
    | "hierarchy"
    | "accessibility"
    | "conversion"
    | "other"
  > = {
    ux: "other", // Will be refined by agent
    accessibility: "accessibility",
    conversion: "conversion",
  };
  return categoryMap[agentCategory] || "other";
}

/**
 * Map confidence number to confidence level
 */
export function mapConfidenceToLevel(confidence: number): "Low" | "Med" | "High" {
  if (confidence >= 70) return "High";
  if (confidence >= 40) return "Med";
  return "Low";
}
