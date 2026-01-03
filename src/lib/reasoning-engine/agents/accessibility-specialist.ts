/**
 * Accessibility Specialist Agent
 *
 * Specializes in identifying accessibility issues based on WCAG guidelines
 */

import { OpenAI } from "openai";
import type { AgentContext, AgentFinding } from "@/types";
import { retrieveKnowledgeForIssue } from "../../knowledge-base/retrieval";
import { formatContextForAgent } from "../orchestrator";
import { mapConfidenceToLevel } from "../evidence-capture";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Accessibility Specialist Agent
 * Analyzes the design for accessibility issues based on WCAG guidelines
 */
export async function accessibilitySpecialistAgent(context: AgentContext): Promise<AgentFinding[]> {
  console.log("♿ Accessibility Specialist analyzing...");

  try {
    // Retrieve relevant WCAG knowledge (secondary - for validation only)
    // Note: Knowledge base is a HELPER, not the primary driver. Persona-specific analysis comes first.
    const knowledge = await retrieveKnowledgeForIssue(
      `Validating persona-specific accessibility findings for ${context.persona.name} (${context.persona.role}). Use WCAG guidelines as validation framework.`,
      "accessibility"
    ).catch(() => ({ context: "", citations: [] })); // Don't fail if knowledge retrieval fails

    // Build persona-specific context
    const personaContext = `
**PERSONA-SPECIFIC ANALYSIS (PRIMARY FOCUS):**
You are analyzing this interface from the perspective of: ${context.persona.name} (${context.persona.role})

${context.persona.description ? `Persona Description: ${context.persona.description}` : ""}
${context.persona.accessibility && context.persona.accessibility.length > 0 ? `\nTheir Accessibility Needs: ${context.persona.accessibility.join(", ")}` : ""}
${context.persona.constraints && context.persona.constraints.length > 0 ? `\nTheir Constraints: ${context.persona.constraints.join(", ")}` : ""}
${context.persona.goals && context.persona.goals.length > 0 ? `\nTheir Goals: ${context.persona.goals.join(", ")}` : ""}
${context.persona.frustrations && context.persona.frustrations.length > 0 ? `\nTheir Frustrations: ${context.persona.frustrations.join(", ")}` : ""}
${context.persona.tags && context.persona.tags.length > 0 ? `\nPersona Tags: ${context.persona.tags.join(", ")}` : ""}

**CRITICAL: Your findings MUST reflect accessibility issues that THIS specific persona would encounter.**
- **ONLY report accessibility issues if:**
  1. The persona has explicit accessibility needs listed (e.g., "Screen reader user", "Keyboard-only navigation", "Low vision")
  2. OR the accessibility issue directly blocks the persona's goals or constraints
  3. OR the accessibility issue creates frustration for this specific persona based on their role/context
- **DO NOT report generic accessibility findings** like "Missing ARIA labels" unless the persona specifically needs them
- Generic accessibility checklists (e.g., "All buttons need ARIA labels") are NOT valuable - focus on barriers THIS persona would actually hit
- The WCAG guidelines should be used as VALIDATION, not as the primary driver
- Ask yourself: "Would ${context.persona.name} (a ${context.persona.role}) with these accessibility needs/constraints specifically encounter this barrier? Why? If not, skip it."
`;

    // Build system prompt
    const systemPrompt = `You are an Accessibility Specialist with expertise in:
- WCAG 2.1 and 2.2 guidelines (Level A, AA, AAA) - use as validation framework
- ARIA attributes and semantic HTML
- Screen reader compatibility
- Keyboard navigation
- Color contrast requirements
- Focus management
- Kiwi UI Critique Rubric (0-3 severity scale)

${personaContext}

**Your PRIMARY task:** Identify accessibility issues that THIS SPECIFIC PERSONA would encounter based on their accessibility needs, constraints, goals, and role.

**Your SECONDARY task:** Use WCAG guidelines to VALIDATE and EXPLAIN why these persona-specific accessibility barriers matter.

**Knowledge Base (Reference Only):**
${knowledge.context || "No additional knowledge context available. Rely on persona-specific analysis."}

**IMPORTANT:** The knowledge base above is for REFERENCE ONLY. Your primary analysis should come from the persona's perspective. Use the knowledge base to validate and explain, not to generate generic findings.

**Severity Rating (Kiwi UI Rubric + WCAG Level):**
- "High" = WCAG Level A violations OR Severity 3 (blocks accessibility, causes errors)
- "Med" = WCAG Level AA violations OR Severity 2 (causes hesitation, slower completion)
- "Low" = WCAG Level AAA violations OR Severity 1 (minor polish, best practices)

**CRITICAL: Be Specific About Design Flow**
Your feedback must be highly specific about how accessibility issues impact the user's journey. Generic feedback that ChatGPT could generate is not acceptable. Focus on:
- The exact sequence of steps a screen reader or keyboard user takes
- Where in the flow the accessibility barrier occurs
- How the issue disrupts the user's ability to complete tasks
- Specific UI elements and their accessibility properties
- The actual accessible path vs. the optimal accessible path

**Guidelines:**
1. **FIRST CHECK**: Does this persona have accessibility needs or constraints that would make them encounter this issue?
   - If NO accessibility needs listed AND the issue doesn't block their goals → SKIP IT
   - If YES → Continue to step 2

2. **START with persona perspective** - What accessibility barriers would ${context.persona.name} encounter?
   - Focus on barriers that affect THIS persona's goals, constraints, or accessibility needs
   - Example: If persona is "Keyboard-friendly" → report keyboard navigation issues
   - Example: If persona has "Low vision" → report color contrast issues
   - Example: If persona uses "Screen reader" → report ARIA label issues
   - Example: If persona has NO accessibility needs → only report if it blocks their goals

3. **THEN validate** with WCAG guidelines (use as supporting evidence, not primary driver)

4. Be SPECIFIC about the accessibility flow from THIS PERSONA's perspective

5. Identify WHERE in the flow THIS PERSONA would encounter the barrier

6. Explain HOW the issue blocks THIS PERSONA's ability to complete their goals

7. **FILTER OUT generic findings**:
   - "Missing ARIA labels" → Only if persona uses screen reader
   - "Color contrast issues" → Only if persona has vision constraints
   - "Keyboard navigation" → Only if persona relies on keyboard
   - Generic WCAG violations → Skip unless they affect THIS persona

8. Map WCAG level to severity based on impact to THIS PERSONA

9. Only report issues THIS PERSONA would actually encounter in their workflow

10. Reference specific elements, positions, and interactions

11. **If you can't find persona-specific accessibility issues, return an empty array** - Don't generate generic findings just to have findings

Output your findings as a JSON array of issues, each with:
- title: Short, specific title
- severity: "Blocker" (completely blocks accessibility), "High" (Level A/Severity 3), "Med" (Level AA/Severity 2), or "Low" (Level AAA/Severity 1)
- confidence: 0-100 (numeric confidence score)
- category: Always "accessibility" for accessibility issues
- description: Detailed description citing the specific WCAG guideline violated (e.g., "WCAG 2.1.1 - Keyboard")
- suggestedFix: Specific, actionable fix with code examples if applicable (format: "Change X to Y because...")
- affectingTasks: Array of task numbers (1-indexed) affected
- elementSelector: CSS selector if applicable
- elementPosition: {x, y, width, height} if applicable`;

    // Build user message with accessibility tree
    const a11yTree = context.semanticContext.accessibility_tree?.data;
    const a11yContext = a11yTree
      ? `\nAccessibility Tree Analysis:\n${JSON.stringify(a11yTree, null, 2).substring(0, 2000)}...`
      : "\nNote: Accessibility tree not available.";

    const userMessage = `${formatContextForAgent(context)}${a11yContext}

**ANALYZE FROM ${context.persona.name.toUpperCase()}'S PERSPECTIVE**

**CRITICAL FILTER**: Only report accessibility issues if:
1. ${context.persona.name} has explicit accessibility needs (${context.persona.accessibility?.join(", ") || "NONE LISTED"})
2. OR the issue directly blocks ${context.persona.name}'s goals (${context.persona.goals?.join(", ") || "N/A"})
3. OR the issue creates frustration for ${context.persona.name} based on their constraints (${context.persona.constraints?.join(", ") || "N/A"})

**If ${context.persona.name} has NO accessibility needs listed and the issue doesn't block their goals → SKIP IT**

Analyze this interface for accessibility issues that ${context.persona.name} would specifically encounter:
${
  context.persona.accessibility && context.persona.accessibility.length > 0
    ? `- Focus on: ${context.persona.accessibility.join(", ")}`
    : `- This persona has NO explicit accessibility needs listed
- Only report accessibility issues if they directly block their goals: ${context.persona.goals?.join(", ") || "N/A"}
- Skip generic accessibility checklists (ARIA labels, color contrast, etc.) unless they affect this persona's workflow`
}

Return a JSON array of findings. If no persona-specific accessibility issues are found, return an empty array.`;

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    let findings = [];

    if (Array.isArray(parsed.findings)) {
      findings = parsed.findings;
    } else if (parsed.findings) {
      findings = [parsed.findings];
    } else if (Array.isArray(parsed)) {
      findings = parsed;
    } else if (parsed.title) {
      findings = [parsed];
    }

    // Add citations and category, ensure all required fields
    // Raw finding from OpenAI API - structure is dynamic
    type RawFinding = Record<string, unknown> & {
      title?: string;
      severity?: string;
      confidence?: number;
      description?: string;
      suggestedFix?: string;
      affectingTasks?: unknown;
      elementSelector?: unknown;
      elementPosition?: unknown;
    };
    return findings.map((finding: RawFinding): AgentFinding => {
      const confidence = finding.confidence || 50;
      return {
        title: finding.title || "Untitled Issue",
        severity: (finding.severity || "Med") as "Blocker" | "High" | "Med" | "Low",
        confidence: confidence,
        confidence_level: mapConfidenceToLevel(confidence),
        description: finding.description || "",
        suggestedFix: finding.suggestedFix || "",
        affectingTasks: Array.isArray(finding.affectingTasks) ? finding.affectingTasks : [],
        category: "accessibility",
        citations: (knowledge.citations || []).map((c) => ({
          chunk_id: c.chunkId,
          source: c.source,
          title: c.title,
          category: c.category,
        })),
        elementSelector: finding.elementSelector as string | undefined,
        elementPosition: finding.elementPosition as
          | { x: number; y: number; width: number; height: number }
          | undefined,
      };
    });
  } catch (error) {
    console.error("Error in Accessibility Specialist:", error);
    return [];
  }
}
