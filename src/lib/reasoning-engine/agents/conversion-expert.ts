/**
 * Conversion Expert Agent
 *
 * Specializes in identifying conversion optimization issues based on growth patterns
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
 * Conversion Expert Agent
 * Analyzes the design for conversion optimization issues
 */
export async function conversionExpertAgent(context: AgentContext): Promise<AgentFinding[]> {
  console.log("📈 Conversion Expert analyzing...");

  try {
    // Retrieve relevant growth pattern knowledge (secondary - for validation only)
    // Note: Knowledge base is a HELPER, not the primary driver. Persona-specific analysis comes first.
    const knowledge = await retrieveKnowledgeForIssue(
      `Validating persona-specific conversion findings for ${context.persona.name} (${context.persona.role}). Use growth patterns as validation framework.`,
      "conversion"
    ).catch(() => ({ context: "", citations: [] })); // Don't fail if knowledge retrieval fails

    // Build persona-specific context
    const personaContext = `
**PERSONA-SPECIFIC ANALYSIS (PRIMARY FOCUS):**
You are analyzing this interface from the perspective of: ${context.persona.name} (${context.persona.role})

${context.persona.description ? `Persona Description: ${context.persona.description}` : ""}
${context.persona.goals && context.persona.goals.length > 0 ? `\nTheir Goals: ${context.persona.goals.join(", ")}` : ""}
${context.persona.behaviors && context.persona.behaviors.length > 0 ? `\nTheir Behaviors: ${context.persona.behaviors.join(", ")}` : ""}
${context.persona.frustrations && context.persona.frustrations.length > 0 ? `\nTheir Frustrations: ${context.persona.frustrations.join(", ")}` : ""}
${context.persona.constraints && context.persona.constraints.length > 0 ? `\nTheir Constraints: ${context.persona.constraints.join(", ")}` : ""}
${context.persona.tags && context.persona.tags.length > 0 ? `\nPersona Tags: ${context.persona.tags.join(", ")}` : ""}

**CRITICAL: Your findings MUST reflect conversion issues that THIS specific persona would encounter.**
- A Marketing Manager would notice different conversion barriers than a Senior Designer or a College Student
- Focus on conversion friction that affects THIS persona's goals, behaviors, and decision-making process
- Generic conversion findings that apply to everyone are NOT valuable - focus on persona-specific friction
- The growth patterns/knowledge base should be used as VALIDATION, not as the primary driver
- Ask yourself: "Would ${context.persona.name} (a ${context.persona.role}) specifically encounter this conversion barrier? Why?"
`;

    // Build system prompt
    const systemPrompt = `You are a Conversion Optimization Expert with expertise in:
- Conversion funnel optimization
- Growth patterns and psychological principles (use as validation framework)
- A/B testing best practices
- Landing page optimization
- Checkout flow optimization
- Social proof and trust signals
- Friction reduction
- Kiwi UI Critique Rubric (0-3 severity scale)

${personaContext}

**Your PRIMARY task:** Identify conversion issues that THIS SPECIFIC PERSONA would encounter based on their role, goals, behaviors, frustrations, and decision-making process.

**Your SECONDARY task:** Use growth patterns and conversion principles to VALIDATE and EXPLAIN why these persona-specific conversion barriers matter.

**Knowledge Base (Reference Only):**
${knowledge.context || "No additional knowledge context available. Rely on persona-specific analysis."}

**IMPORTANT:** The knowledge base above is for REFERENCE ONLY. Your primary analysis should come from the persona's perspective. Use the knowledge base to validate and explain, not to generate generic findings.

**Severity Rating (Kiwi UI Rubric):**
- "High" = Severity 3: Likely to cause abandonment, significant friction, blocks conversion
- "Med" = Severity 2: Causes hesitation, reduces conversion likelihood, moderate friction
- "Low" = Severity 1: Minor optimization opportunity, doesn't block but could improve

**CRITICAL: Be Specific About Design Flow**
Your feedback must be highly specific about the user's journey and flow through the interface. Generic feedback that ChatGPT could generate is not acceptable. Focus on:
- The exact sequence of steps in the conversion funnel
- Where in the flow friction occurs (be specific about the step)
- How the issue disrupts the user's decision-making process
- Specific UI elements and their placement in the conversion path
- The actual user journey vs. the optimal conversion path

**Guidelines:**
1. **START with persona perspective** - What conversion barriers would ${context.persona.name} encounter?
2. **THEN validate** with conversion principles (use as supporting evidence, not primary driver)
3. Be SPECIFIC about the conversion flow from THIS PERSONA's perspective
4. Identify WHERE in the conversion funnel THIS PERSONA would encounter friction
5. Explain HOW the issue creates friction for THIS PERSONA specifically (not generic users)
6. Consider THIS PERSONA's journey and decision-making process
7. Identify missing trust signals, social proof, or information THIS PERSONA needs based on their role/goals
8. Rate severity based on impact to THIS PERSONA's conversion likelihood
9. Only report issues THIS PERSONA would actually encounter
10. Pay special attention to what THIS PERSONA needs to convert (based on their goals and role)
11. Reference specific elements, positions, and interactions
12. **Avoid generic findings** - If it applies to everyone, it's not persona-specific enough

Output your findings as a JSON array of issues, each with:
- title: Short, specific title
- severity: "Blocker" (completely blocks conversion), "High" (Severity 3), "Med" (Severity 2), or "Low" (Severity 1)
- confidence: 0-100 (numeric confidence score)
- category: Always "conversion" for conversion issues
- description: Detailed description citing the specific principle violated and conversion impact
- suggestedFix: Specific, actionable fix with concrete changes (format: "Change X to Y because...")
- affectingTasks: Array of task numbers (1-indexed) affected
- elementSelector: CSS selector if applicable
- elementPosition: {x, y, width, height} if applicable`;

    // Build user message
    const userMessage = `${formatContextForAgent(context)}

Analyze this interface for conversion optimization issues. Consider:
- Friction in key flows (sign-up, checkout, etc.)
- Missing social proof or trust signals
- CTA visibility and placement
- Form complexity (too many fields)
- Progress indicators
- Scarcity and urgency signals
- Value proposition clarity

Return a JSON array of findings.`;

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
        category: "conversion",
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
    console.error("Error in Conversion Expert:", error);
    return [];
  }
}
