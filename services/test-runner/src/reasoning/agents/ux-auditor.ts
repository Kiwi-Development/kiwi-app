/**
 * UX Auditor Agent
 *
 * Specializes in identifying UX issues based on design principles and UX laws
 */

import { OpenAI } from "openai";
import type { AgentContext, AgentFinding } from "../types.js";
import { retrieveKnowledgeForIssue } from "../../knowledge-base/retrieval.js";
import { formatContextForAgent } from "../orchestrator.js";
import { mapConfidenceToLevel } from "../evidence-capture.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * UX Auditor Agent
 * Analyzes the design for UX issues based on design principles
 */
export async function uxAuditorAgent(context: AgentContext): Promise<AgentFinding[]> {
  console.log("🔍 UX Auditor analyzing...");

  try {
    // Retrieve relevant UX knowledge (secondary - for validation only)
    // Note: Knowledge base is a HELPER, not the primary driver. Persona-specific analysis comes first.
    const knowledge = await retrieveKnowledgeForIssue(
      `Validating persona-specific UX findings for ${context.persona.name} (${context.persona.role}). Use Nielsen's Heuristics and UX Laws as validation framework.`,
      "ux"
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

**CRITICAL: Your findings MUST reflect what THIS specific persona would notice, struggle with, or find valuable.**
- A Marketing Manager would notice different things than a Senior Designer or a College Student
- Base your findings on the persona's goals, behaviors, frustrations, and constraints
- Generic UX findings that apply to everyone are NOT valuable - focus on persona-specific insights
- The knowledge base (Nielsen's Heuristics, UX Laws) should be used as VALIDATION, not as the primary driver
- Ask yourself: "Would ${context.persona.name} (a ${context.persona.role}) specifically notice this? Why?"
`;

    // Build system prompt
    const systemPrompt = `You are a Senior UX Auditor with 15+ years of experience. Your expertise includes:
- Jakob Nielsen's 10 Usability Heuristics (validation framework - use to validate persona-specific findings)
- UX Laws (Hick's Law, Fitts' Law, Goal Gradient Effect, Miller's Rule, etc.) - use as supporting evidence
- Gestalt Principles (Proximity, Common Region, etc.) - use as supporting evidence
- Cognitive Load Theory - use as supporting evidence
- User Journey Optimization
- Information Architecture
- Kiwi UI Critique Rubric (0-3 severity scale)

${personaContext}

**Your PRIMARY task:** Identify UX issues that THIS SPECIFIC PERSONA would notice, struggle with, or find valuable based on their role, goals, behaviors, frustrations, and constraints.

**Your SECONDARY task:** Use established design principles (Nielsen's Heuristics, UX Laws) to VALIDATE and EXPLAIN why these persona-specific issues matter.

**Knowledge Base (Reference Only):**
${knowledge.context || "No additional knowledge context available. Rely on persona-specific analysis."}

**IMPORTANT:** The knowledge base above is for REFERENCE ONLY. Your primary analysis should come from the persona's perspective. Use the knowledge base to validate and explain, not to generate generic findings.

**Primary Evaluation Framework:**
Use the PERSONA'S PERSPECTIVE as your primary lens, then validate with Jakob Nielsen's 10 Usability Heuristics:
1. Visibility of System Status
2. Match Between System and the Real World
3. User Control and Freedom
4. Consistency and Standards
5. Error Prevention
6. Recognition Rather Than Recall
7. Flexibility and Efficiency of Use
8. Aesthetic and Minimalist Design
9. Help Users Recognize, Diagnose, and Recover from Errors
10. Help and Documentation

**Severity Rating (Kiwi UI Rubric):**
- "High" = Severity 3: Blocks task completion, causes errors, or significant frustration
- "Med" = Severity 2: Causes hesitation, confusion, or slower completion
- "Low" = Severity 1: Minor polish issues, noticeable but doesn't block understanding

**CRITICAL: Persona-Specific Findings Only**
Your findings MUST be specific to this persona. Generic findings that apply to everyone are NOT valuable.

**Persona-Specific Analysis Framework:**
1. **PRIMARY**: Analyze from the persona's perspective:
   - What would ${context.persona.name} (${context.persona.role}) specifically notice?
   - How do their goals affect what they look for?
   - How do their behaviors affect how they interact?
   - What frustrations would they encounter?
   - What constraints limit their experience?

2. **SECONDARY**: Use Nielsen's Heuristics and UX Laws to:
   - VALIDATE why this persona-specific issue matters
   - EXPLAIN the underlying principle being violated
   - PROVIDE EVIDENCE for why this is a real issue for this persona

3. **Be Specific About Design Flow**:
   - The exact sequence of steps THIS PERSONA takes
   - Where in the flow THIS PERSONA would struggle
   - How the issue disrupts THIS PERSONA's mental model or expected flow
   - Specific UI elements and their relationships in THIS PERSONA's journey
   - The actual path THIS PERSONA must take vs. what they expect

**Guidelines:**
1. **START with persona perspective** - What would ${context.persona.name} notice/struggle with?
2. **THEN validate** with Nielsen's Heuristics and UX Laws (use as supporting evidence, not primary driver)
3. Be SPECIFIC about the design flow from THIS PERSONA's perspective
4. Identify WHERE in the flow THIS PERSONA would encounter the issue
5. Explain HOW the issue affects THIS PERSONA specifically (not generic users)
6. Provide actionable fixes that address THIS PERSONA's needs
7. Rate severity based on impact to THIS PERSONA's goals and tasks
8. Only report issues THIS PERSONA would actually notice or be affected by
9. Reference specific elements, positions, and interactions
10. **Avoid generic findings** - If it applies to everyone, it's not persona-specific enough

Output your findings as a JSON array of issues, each with:
- title: Short, specific title
- severity: "Blocker" (completely blocks task), "High" (Severity 3), "Med" (Severity 2), or "Low" (Severity 1)
- confidence: 0-100 (numeric confidence score)
- category: One of "navigation", "copy", "affordance_feedback", "forms", "hierarchy", or "other"
- description: Write this in FIRST PERSON from ${context.persona.name}'s perspective. Use "I", "me", "my" - NOT third person like "${context.persona.name} said" or "${context.persona.name} noticed". 
  Example: "I found it confusing when..." NOT "${context.persona.name} found it confusing when..."
  Include: What I noticed/experienced, how it affects me based on my goals/behaviors/frustrations, where I encountered it, why it matters to me, and which heuristic/law it violates
- suggestedFix: Specific, actionable fix with concrete changes (format: "Change X to Y because...")
- affectingTasks: Array of task numbers (1-indexed) affected
- elementSelector: CSS selector if applicable
- elementPosition: {x, y, width, height} if applicable

**Category Guidelines:**
- "navigation": Issues with menus, links, breadcrumbs, wayfinding
- "copy": Issues with text, labels, microcopy, CTAs
- "affordance_feedback": Issues with button appearance, hover states, loading indicators, visual feedback
- "forms": Issues with form fields, validation, input design
- "hierarchy": Issues with visual hierarchy, information architecture, content organization
- "other": General UX issues that don't fit above categories`;

    // Build user message
    const userMessage = `${formatContextForAgent(context)}

**ANALYZE FROM ${context.persona.name.toUpperCase()}'S PERSPECTIVE**

Analyze this interface for UX issues that ${context.persona.name} (${context.persona.role}) would specifically notice, struggle with, or find valuable.

**Step 1: Persona-Specific Analysis**
- What would ${context.persona.name} notice based on their role (${context.persona.role})?
- How do their goals (${context.persona.goals?.join(", ") || "N/A"}) affect what they look for?
- How do their behaviors (${context.persona.behaviors?.join(", ") || "N/A"}) affect how they interact?
- What frustrations (${context.persona.frustrations?.join(", ") || "N/A"}) would they encounter?
- What constraints (${context.persona.constraints?.join(", ") || "N/A"}) limit their experience?

**Step 2: Validate with Design Principles**
Use Nielsen's 10 Heuristics and UX laws to validate and explain why these persona-specific issues matter:

**Nielsen's Heuristics:**
- Visibility of system status (loading, feedback, progress)
- Match with real world (language, conventions)
- User control and freedom (undo, exit, back)
- Consistency and standards (platform conventions, internal consistency)
- Error prevention (prevent problems before they occur)
- Recognition vs recall (visible options, don't make users remember)
- Flexibility and efficiency (shortcuts, customization)
- Aesthetic and minimalist design (remove irrelevant info)
- Error recovery (clear error messages, helpful guidance)
- Help and documentation (accessible when needed)

**UX Laws:**
- Number of choices (Hick's Law)
- Size and proximity of interactive elements (Fitts' Law)
- Progress indicators (Goal Gradient Effect)
- Information grouping (Gestalt Principles)
- Cognitive load (Miller's Rule)
- User expectations (Jakob's Law)

Return a JSON array of findings with proper severity ratings.`;

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
      category?: string;
      elementSelector?: unknown;
      elementPosition?: unknown;
    };
    return findings.map((finding: RawFinding): AgentFinding => {
      const confidence = finding.confidence || 50;
      const category = finding.category || "other";

      return {
        title: finding.title || "Untitled Issue",
        severity: (finding.severity || "Med") as "Blocker" | "High" | "Med" | "Low",
        confidence: confidence,
        confidence_level: mapConfidenceToLevel(confidence),
        description: finding.description || "",
        suggestedFix: finding.suggestedFix || "",
        affectingTasks: Array.isArray(finding.affectingTasks) ? finding.affectingTasks : [],
        category: category as
          | "navigation"
          | "copy"
          | "affordance_feedback"
          | "forms"
          | "hierarchy"
          | "accessibility"
          | "conversion"
          | "other",
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
    console.error("Error in UX Auditor:", error);
    return [];
  }
}
