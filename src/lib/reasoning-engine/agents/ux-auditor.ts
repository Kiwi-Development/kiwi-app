/**
 * UX Auditor Agent
 * 
 * Specializes in identifying UX issues based on design principles and UX laws
 */

import { OpenAI } from 'openai';
import { AgentContext, AgentFinding } from '../orchestrator';
import { retrieveKnowledgeForIssue } from '../../knowledge-base/retrieval';
import { formatContextForAgent } from '../orchestrator';
import { mapConfidenceToLevel } from '../evidence-capture';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * UX Auditor Agent
 * Analyzes the design for UX issues based on design principles
 */
export async function uxAuditorAgent(context: AgentContext): Promise<AgentFinding[]> {
  console.log('🔍 UX Auditor analyzing...');

  try {
    // Retrieve relevant UX knowledge (prioritize Nielsen's Heuristics and Kiwi Rubric)
    const knowledge = await retrieveKnowledgeForIssue(
      `Analyzing UX issues using Jakob Nielsen's 10 Usability Heuristics and Kiwi UI Critique Rubric. Interface: ${context.semanticContext.page_metadata?.data?.title || 'web interface'}. Tasks: ${context.tasks.join(', ')}. Persona: ${context.persona.name} (${context.persona.role}).`,
      'ux'
    );

    // Build system prompt
    const systemPrompt = `You are a Senior UX Auditor with 15+ years of experience. Your expertise includes:
- Jakob Nielsen's 10 Usability Heuristics (primary framework)
- UX Laws (Hick's Law, Fitts' Law, Goal Gradient Effect, Miller's Rule, etc.)
- Gestalt Principles (Proximity, Common Region, etc.)
- Cognitive Load Theory
- User Journey Optimization
- Information Architecture
- Kiwi UI Critique Rubric (0-3 severity scale)

Your task is to analyze the provided screenshot and semantic context to identify UX issues that violate established design principles.

${knowledge.context}

**Primary Evaluation Framework:**
Use Jakob Nielsen's 10 Usability Heuristics as your primary lens:
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

**CRITICAL: Be Specific About Design Flow**
Your feedback must be highly specific about the user's journey and flow through the interface. Generic feedback that ChatGPT could generate is not acceptable. Focus on:
- The exact sequence of steps the user takes
- Where in the flow the issue occurs
- How the issue disrupts the user's mental model or expected flow
- Specific UI elements and their relationships in the flow
- The actual path the user must take vs. the optimal path

Guidelines:
1. Evaluate against Nielsen's 10 Heuristics first, then UX laws and principles
2. Be SPECIFIC about the design flow - describe the exact user journey, not generic observations
3. Identify WHERE in the flow the issue occurs (e.g., "After clicking the save button, users expect X but see Y")
4. Explain HOW the issue disrupts the flow (e.g., "This breaks the expected pattern because...")
5. Provide actionable, specific fixes with exact UI changes (not vague suggestions like 'improve UX')
6. Rate severity using the Kiwi UI Rubric scale (map to High/Med/Low)
7. Only report issues you can clearly identify from the provided context
8. Focus on issues that impact the user persona's ability to complete tasks
9. Reference specific elements, positions, and interactions - not general principles

Output your findings as a JSON array of issues, each with:
- title: Short, specific title
- severity: "Blocker" (completely blocks task), "High" (Severity 3), "Med" (Severity 2), or "Low" (Severity 1)
- confidence: 0-100 (numeric confidence score)
- category: One of "navigation", "copy", "affordance_feedback", "forms", "hierarchy", or "other"
- description: Detailed description citing the specific heuristic/law violated
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

Analyze this interface for UX issues using Nielsen's 10 Heuristics and UX laws. Evaluate:

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
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
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
    return findings.map((finding: any): AgentFinding => {
      const confidence = finding.confidence || 50;
      const confidenceLevel = confidence >= 70 ? 'High' : confidence >= 40 ? 'Med' : 'Low';
      const category = finding.category || 'other';
      
      return {
        title: finding.title || 'Untitled Issue',
        severity: (finding.severity || 'Med') as 'Blocker' | 'High' | 'Med' | 'Low',
        confidence: confidence,
        confidence_level: mapConfidenceToLevel(confidence),
        description: finding.description || '',
        suggestedFix: finding.suggestedFix || '',
        affectingTasks: Array.isArray(finding.affectingTasks) ? finding.affectingTasks : [],
        category: category as 'navigation' | 'copy' | 'affordance_feedback' | 'forms' | 'hierarchy' | 'accessibility' | 'conversion' | 'other',
        citations: knowledge.citations.map(c => ({
          chunk_id: c.chunkId,
          source: c.source,
          title: c.title,
          category: c.category,
        })),
        elementSelector: finding.elementSelector,
        elementPosition: finding.elementPosition,
      };
    });
  } catch (error) {
    console.error('Error in UX Auditor:', error);
    return [];
  }
}

