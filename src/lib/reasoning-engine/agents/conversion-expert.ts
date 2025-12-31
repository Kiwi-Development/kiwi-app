/**
 * Conversion Expert Agent
 * 
 * Specializes in identifying conversion optimization issues based on growth patterns
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
 * Conversion Expert Agent
 * Analyzes the design for conversion optimization issues
 */
export async function conversionExpertAgent(context: AgentContext): Promise<AgentFinding[]> {
  console.log('📈 Conversion Expert analyzing...');

  try {
    // Retrieve relevant growth pattern knowledge
    const knowledge = await retrieveKnowledgeForIssue(
      `Analyzing conversion optimization issues in a ${context.semanticContext.page_metadata?.data?.title || 'web interface'}`,
      'conversion'
    );

    // Build system prompt
    const systemPrompt = `You are a Conversion Optimization Expert with expertise in:
- Conversion funnel optimization
- Growth patterns and psychological principles
- A/B testing best practices
- Landing page optimization
- Checkout flow optimization
- Social proof and trust signals
- Friction reduction
- Kiwi UI Critique Rubric (0-3 severity scale)

Your task is to analyze the provided screenshot and semantic context to identify issues that may reduce conversion rates or user engagement.

${knowledge.context}

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

Guidelines:
1. Focus on issues that impact conversion rates or user engagement
2. Be SPECIFIC about the conversion flow - describe the exact user journey, not generic observations
3. Identify WHERE in the conversion funnel the issue occurs (e.g., "At the selection step, users see X but need Y")
4. Explain HOW the issue creates friction (e.g., "This creates decision paralysis because...")
5. Consider the user's journey and friction points (especially in key conversion moments)
6. Identify missing trust signals, social proof, or urgency/scarcity indicators with specific placement suggestions
7. Rate severity based on impact on conversion using the rubric above
8. Only report issues you can clearly identify from the provided context
9. Pay special attention to: CTAs, forms, checkout flows, value propositions, trust signals
10. Reference specific elements, positions, and interactions - not general principles

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
        category: 'conversion',
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
    console.error('Error in Conversion Expert:', error);
    return [];
  }
}

