/**
 * Ticket Generator
 *
 * Generates issue tickets in GitHub/JIRA format
 */

import { AgentFinding } from "../reasoning-engine/orchestrator";

export interface Ticket {
  format: "github" | "jira";
  title: string;
  body: string;
  labels: string[];
  priority: "high" | "medium" | "low";
}

/**
 * Generate ticket for a finding
 */
export function generateTicket(
  finding: AgentFinding,
  format: "github" | "jira" = "github"
): Ticket {
  const priority =
    finding.severity === "High" ? "high" : finding.severity === "Med" ? "medium" : "low";

  const labels = [
    finding.category,
    `severity-${finding.severity.toLowerCase()}`,
    "design-intelligence",
  ];

  if (finding.category === "accessibility") {
    labels.push("a11y");
    const wcag = extractWCAGGuideline(finding);
    if (wcag) {
      labels.push(`wcag-${wcag}`);
    }
  }

  const body =
    format === "github" ? generateGitHubIssueBody(finding) : generateJiraIssueBody(finding);

  return {
    format,
    title: `[${finding.severity}] ${finding.title}`,
    body,
    labels,
    priority,
  };
}

/**
 * Generate GitHub issue body
 */
function generateGitHubIssueBody(finding: AgentFinding): string {
  let body = `## Description\n\n${finding.description}\n\n`;

  if (finding.suggestedFix) {
    body += `## Suggested Fix\n\n${finding.suggestedFix}\n\n`;
  }

  if (finding.affectingTasks.length > 0) {
    body += `## Affected Tasks\n\n`;
    finding.affectingTasks.forEach((task) => {
      body += `- ${task}\n`;
    });
    body += `\n`;
  }

  if (finding.elementSelector) {
    body += `## Element\n\n\`\`\`\n${finding.elementSelector}\n\`\`\`\n\n`;
  }

  if (finding.citations.length > 0) {
    body += `## References\n\n`;
    finding.citations.forEach((citation, index) => {
      body += `${index + 1}. **${citation.source}** - ${citation.title}\n`;
    });
    body += `\n`;
  }

  body += `## Metadata\n\n`;
  body += `- **Severity:** ${finding.severity}\n`;
  body += `- **Confidence:** ${finding.confidence}%\n`;
  body += `- **Category:** ${finding.category}\n`;

  return body;
}

/**
 * Generate JIRA issue body
 */
function generateJiraIssueBody(finding: AgentFinding): string {
  let body = `h2. Description\n\n${finding.description}\n\n`;

  if (finding.suggestedFix) {
    body += `h2. Suggested Fix\n\n${finding.suggestedFix}\n\n`;
  }

  if (finding.affectingTasks.length > 0) {
    body += `h2. Affected Tasks\n\n`;
    finding.affectingTasks.forEach((task) => {
      body += `* ${task}\n`;
    });
    body += `\n`;
  }

  if (finding.elementSelector) {
    body += `h2. Element\n\n{code}\n${finding.elementSelector}\n{code}\n\n`;
  }

  if (finding.citations.length > 0) {
    body += `h2. References\n\n`;
    finding.citations.forEach((citation, index) => {
      body += `${index + 1}. *${citation.source}* - ${citation.title}\n`;
    });
    body += `\n`;
  }

  body += `h2. Metadata\n\n`;
  body += `* *Severity:* ${finding.severity}\n`;
  body += `* *Confidence:* ${finding.confidence}%\n`;
  body += `* *Category:* ${finding.category}\n`;

  return body;
}

/**
 * Extract WCAG guideline number
 */
function extractWCAGGuideline(finding: AgentFinding): string | null {
  const wcagMatch = finding.description.match(/WCAG\s+([\d.]+)/i);
  if (wcagMatch) {
    return wcagMatch[1];
  }

  const citation = finding.citations.find((c) => c.category === "wcag");
  if (citation) {
    const match = citation.title.match(/([\d.]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}
