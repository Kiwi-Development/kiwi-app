/**
 * UI Anchor - references a specific UI element
 */
export interface UIAnchor {
  frame_name?: string;
  element_label?: string;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  element_selector?: string;
}

/**
 * Evidence Snippet - captures evidence from a test run
 */
export interface EvidenceSnippet {
  persona_name: string;
  persona_role: string;
  task_context: string;
  what_happened_steps: string[]; // 2-6 bullet sequence
  persona_quote?: string; // What the persona "said/thought"
  ui_anchor?: UIAnchor;
  timestamp?: string;
  screenshot_index?: number;
}
