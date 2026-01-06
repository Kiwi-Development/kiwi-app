/**
 * Evidence Capture
 * 
 * Captures evidence (screenshots, DOM snapshots, logs) for analysis
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

/**
 * DOM Snapshot Schema
 * BEST PRACTICE: Use descriptive field names and .describe() (per AGENTS.md)
 */
const DOMSnapshotSchema = z.object({
  title: z.string().describe("The page title from the <title> tag"),
  headings: z
    .array(
      z.object({
        level: z.number().describe("Heading level (1-6)"),
        text: z.string().describe("The heading text content"),
      })
    )
    .describe("All headings on the page"),
  interactiveElements: z
    .array(
      z.object({
        type: z.string().describe("Element type (button, input, link, etc.)"),
        text: z.string().optional().describe("Visible text or label"),
        selector: z.string().describe("CSS selector for the element"),
      })
    )
    .describe("All clickable or interactive elements"),
});

export type DOMSnapshot = z.infer<typeof DOMSnapshotSchema>;

/**
 * Capture DOM snapshot using extract()
 * BEST PRACTICE: Use extract() with schema for structured data (per AGENTS.md)
 */
export async function captureDOMSnapshot(stagehand: Stagehand): Promise<DOMSnapshot> {
  const snapshot = await stagehand.extract(
    "extract the page structure including title, headings, and interactive elements",
    DOMSnapshotSchema
  );
  return snapshot;
}

/**
 * Capture screenshot (base64 encoded)
 */
export async function captureScreenshot(page: any): Promise<string> {
  const screenshot = await page.screenshot({ encoding: "base64" });
  return screenshot as string;
}

/**
 * Evidence capture result
 */
export interface EvidenceCapture {
  screenshot: string; // base64 encoded
  domSnapshot: DOMSnapshot;
  timestamp: number;
  url: string;
}

/**
 * Capture all evidence types
 */
export async function captureEvidence(
  stagehand: Stagehand,
  page: any
): Promise<EvidenceCapture> {
  const screenshot = await captureScreenshot(page);
  const domSnapshot = await captureDOMSnapshot(stagehand);
  const url = page.url();

  return {
    screenshot,
    domSnapshot,
    timestamp: Date.now(),
    url,
  };
}

