/**
 * Code Snippet Generator
 * 
 * Generates actionable code snippets (Tailwind/CSS, React components, HTML) for fixing issues
 */

import { AgentFinding } from '../reasoning-engine/orchestrator';

export interface CodeSnippet {
  language: 'html' | 'css' | 'tailwind' | 'jsx' | 'tsx';
  code: string;
  description: string;
  elementSelector?: string;
}

/**
 * Generate code snippets for a finding
 */
export function generateCodeSnippets(finding: AgentFinding): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];

  // Accessibility fixes
  if (finding.category === 'accessibility') {
    if (finding.description.toLowerCase().includes('alt text') || finding.description.toLowerCase().includes('missing alt')) {
      snippets.push({
        language: 'html',
        code: `<img src="image.jpg" alt="Descriptive text explaining the image content" />`,
        description: 'Add descriptive alt text to image',
        elementSelector: finding.elementSelector,
      });
    }

    if (finding.description.toLowerCase().includes('aria-label') || finding.description.toLowerCase().includes('missing label')) {
      snippets.push({
        language: 'html',
        code: `<button aria-label="Close dialog">×</button>`,
        description: 'Add aria-label to button',
        elementSelector: finding.elementSelector,
      });
    }

    if (finding.description.toLowerCase().includes('focus') || finding.description.toLowerCase().includes('keyboard')) {
      snippets.push({
        language: 'css',
        code: `.button:focus {\n  outline: 2px solid #0066cc;\n  outline-offset: 2px;\n}`,
        description: 'Add visible focus indicator',
        elementSelector: finding.elementSelector,
      });
    }

    if (finding.description.toLowerCase().includes('contrast')) {
      snippets.push({
        language: 'tailwind',
        code: `className="text-gray-900 bg-white" // Ensure 4.5:1 contrast ratio`,
        description: 'Use high contrast colors',
        elementSelector: finding.elementSelector,
      });
    }
  }

  // UX fixes (check for UX-related categories)
  if (finding.category === 'navigation' || finding.category === 'copy' || finding.category === 'affordance_feedback' || finding.category === 'forms' || finding.category === 'hierarchy') {
    if (finding.description.toLowerCase().includes("fitts' law") || finding.description.toLowerCase().includes('button size')) {
      snippets.push({
        language: 'tailwind',
        code: `className="px-6 py-3 min-h-[44px] min-w-[44px]" // Minimum 44x44px touch target`,
        description: 'Increase button size for better touch targets',
        elementSelector: finding.elementSelector,
      });
    }

    if (finding.description.toLowerCase().includes("hick's law") || finding.description.toLowerCase().includes('too many choices')) {
      snippets.push({
        language: 'jsx',
        code: `// Reduce options, use progressive disclosure\n<Select>\n  <option>Option 1</option>\n  <option>Option 2</option>\n  <option>Option 3</option>\n</Select>`,
        description: 'Reduce number of choices',
        elementSelector: finding.elementSelector,
      });
    }

    if (finding.description.toLowerCase().includes('progress') || finding.description.toLowerCase().includes('goal gradient')) {
      snippets.push({
        language: 'jsx',
        code: `<div className="progress-bar">\n  <div className="progress-fill" style={{ width: '${finding.affectingTasks.length * 20}%' }} />\n</div>`,
        description: 'Add progress indicator',
        elementSelector: finding.elementSelector,
      });
    }
  }

  // Conversion fixes
  if (finding.category === 'conversion') {
    if (finding.description.toLowerCase().includes('cta') || finding.description.toLowerCase().includes('call to action')) {
      snippets.push({
        language: 'tailwind',
        code: `className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700"`,
        description: 'Make CTA more prominent',
        elementSelector: finding.elementSelector,
      });
    }

    if (finding.description.toLowerCase().includes('social proof') || finding.description.toLowerCase().includes('testimonial')) {
      snippets.push({
        language: 'jsx',
        code: `<div className="testimonial">\n  <p>"Great product!" - John Doe</p>\n  <p className="text-sm text-gray-600">Join 10,000+ happy users</p>\n</div>`,
        description: 'Add social proof',
        elementSelector: finding.elementSelector,
      });
    }
  }

  // Generic fixes based on suggested fix
  if (snippets.length === 0 && finding.suggestedFix) {
    // Try to extract code from suggested fix
    const codeMatch = finding.suggestedFix.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      snippets.push({
        language: (codeMatch[1] as CodeSnippet['language']) || 'html',
        code: codeMatch[2].trim(),
        description: finding.suggestedFix.split('\n')[0] || 'Fix implementation',
        elementSelector: finding.elementSelector,
      });
    }
  }

  return snippets;
}

