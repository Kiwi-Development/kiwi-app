/**
 * Accessibility Specialist Agent
 * 
 * Specializes in identifying accessibility issues based on WCAG guidelines
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
 * Accessibility Specialist Agent
 * Analyzes the design for accessibility issues based on WCAG guidelines
 */
export async function accessibilitySpecialistAgent(context: AgentContext): Promise<AgentFinding[]> {
  console.log('♿ Accessibility Specialist analyzing...');

  try {
    // Retrieve relevant WCAG knowledge
    const knowledge = await retrieveKnowledgeForIssue(
      `Analyzing accessibility issues in a ${context.semanticContext.page_metadata?.data?.title || 'web interface'}`,
      'accessibility'
    );

    // Build system prompt
    const systemPrompt = `You are an Accessibility Specialist with expertise in:
- WCAG 2.1 and 2.2 guidelines (Level A, AA, AAA)
- ARIA attributes and semantic HTML
- Screen reader compatibility
- Keyboard navigation
- Color contrast requirements
- Focus management
- Kiwi UI Critique Rubric (0-3 severity scale)

Your task is to analyze the provided screenshot and semantic context (especially the accessibility tree) to identify accessibility issues that violate WCAG guidelines.

${knowledge.context}

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

Guidelines:
1. Focus on WCAG violations (cite specific guideline numbers like "WCAG 2.1.1", "WCAG 4.1.2")
2. Be SPECIFIC about the accessibility flow - describe the exact user journey for users with disabilities
3. Identify WHERE in the flow the barrier occurs (e.g., "When navigating with Tab, users encounter X at step Y")
4. Explain HOW the issue blocks task completion (e.g., "Screen reader users cannot proceed because...")
5. Check the accessibility tree for missing ARIA attributes, labels, roles
6. Verify keyboard accessibility (tab order, focus indicators, keyboard traps) with specific element references
7. Check color contrast ratios (WCAG AA: 4.5:1 for text, 3:1 for UI components) with specific color values
8. Identify focus management issues (visible focus, logical tab order) with specific element positions
9. Map WCAG level to severity using the rubric above
10. Only report issues you can clearly identify from the provided context
11. Prioritize issues that block users with disabilities from completing tasks
12. Reference specific elements, positions, and interactions - not general principles

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
      : '\nNote: Accessibility tree not available.';

    const userMessage = `${formatContextForAgent(context)}${a11yContext}

Analyze this interface for accessibility issues. Check:
- Missing alt text on images
- Missing ARIA labels
- Keyboard navigation issues
- Focus indicators
- Color contrast
- Semantic HTML usage
- Screen reader compatibility

Return a JSON array of findings.`;

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
      return {
        title: finding.title || 'Untitled Issue',
        severity: (finding.severity || 'Med') as 'Blocker' | 'High' | 'Med' | 'Low',
        confidence: confidence,
        confidence_level: mapConfidenceToLevel(confidence),
        description: finding.description || '',
        suggestedFix: finding.suggestedFix || '',
        affectingTasks: Array.isArray(finding.affectingTasks) ? finding.affectingTasks : [],
        category: 'accessibility',
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
    console.error('Error in Accessibility Specialist:', error);
    return [];
  }
}

