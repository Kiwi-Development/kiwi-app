/**
 * Spec Generator
 * 
 * Generates structured specs (JSON/YAML) with element selectors and properties
 */

import { AgentFinding } from '../reasoning-engine/orchestrator';

export interface Spec {
  format: 'json' | 'yaml';
  content: string;
  description: string;
}

/**
 * Generate spec for a finding
 */
export function generateSpec(finding: AgentFinding): Spec {
  const spec = {
    element: finding.elementSelector || 'unknown',
    issue: finding.title,
    severity: finding.severity,
    category: finding.category,
    position: finding.elementPosition || null,
    requiredChanges: {
      attributes: extractRequiredAttributes(finding),
      styles: extractRequiredStyles(finding),
      content: extractRequiredContent(finding),
    },
    wcagGuideline: finding.category === 'accessibility' ? extractWCAGGuideline(finding) : null,
    uxPrinciple: finding.category === 'ux' ? extractUXPrinciple(finding) : null,
  };

  return {
    format: 'json',
    content: JSON.stringify(spec, null, 2),
    description: `Specification for fixing: ${finding.title}`,
  };
}

/**
 * Extract required attributes from finding
 */
function extractRequiredAttributes(finding: AgentFinding): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (finding.description.toLowerCase().includes('alt')) {
    attributes.alt = 'Descriptive text for image';
  }

  if (finding.description.toLowerCase().includes('aria-label')) {
    attributes['aria-label'] = 'Descriptive label for element';
  }

  if (finding.description.toLowerCase().includes('role')) {
    attributes.role = 'button'; // Default, should be extracted from description
  }

  if (finding.description.toLowerCase().includes('tabindex')) {
    attributes.tabindex = '0';
  }

  return attributes;
}

/**
 * Extract required styles from finding
 */
function extractRequiredStyles(finding: AgentFinding): Record<string, string> {
  const styles: Record<string, string> = {};

  if (finding.description.toLowerCase().includes('focus')) {
    styles.outline = '2px solid #0066cc';
    styles['outline-offset'] = '2px';
  }

  if (finding.description.toLowerCase().includes("fitts' law") || finding.description.toLowerCase().includes('size')) {
    styles['min-height'] = '44px';
    styles['min-width'] = '44px';
  }

  if (finding.description.toLowerCase().includes('contrast')) {
    styles.color = '#000000';
    styles['background-color'] = '#ffffff';
  }

  return styles;
}

/**
 * Extract required content changes
 */
function extractRequiredContent(finding: AgentFinding): string[] {
  const changes: string[] = [];

  if (finding.description.toLowerCase().includes('label')) {
    changes.push('Add descriptive label');
  }

  if (finding.description.toLowerCase().includes('text')) {
    changes.push('Update text content');
  }

  return changes;
}

/**
 * Extract WCAG guideline number from finding
 */
function extractWCAGGuideline(finding: AgentFinding): string | null {
  const wcagMatch = finding.description.match(/WCAG\s+([\d.]+)/i);
  if (wcagMatch) {
    return wcagMatch[1];
  }

  const citation = finding.citations.find(c => c.category === 'wcag');
  if (citation) {
    const match = citation.title.match(/([\d.]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract UX principle from finding
 */
function extractUXPrinciple(finding: AgentFinding): string | null {
  const principles = [
    "Hick's Law",
    "Fitts' Law",
    'Goal Gradient Effect',
    "Miller's Rule",
    "Jakob's Law",
    'Law of Proximity',
    'Law of Common Region',
  ];

  for (const principle of principles) {
    if (finding.description.includes(principle) || finding.title.includes(principle)) {
      return principle;
    }
  }

  const citation = finding.citations.find(c => c.category === 'ux_laws');
  return citation ? citation.title : null;
}

