/**
 * Session start response
 */
export interface SessionStartResponse {
  sessionId: string;
  [key: string]: unknown; // Allow additional properties from backend
}

/**
 * Screenshot response
 */
export interface ScreenshotResponse {
  status: "ok" | "error";
  screenshot?: string; // Base64 encoded screenshot
  message?: string;
  code?: string; // Error code (e.g., "SESSION_NOT_FOUND", "SCREENSHOT_TIMEOUT")
}

/**
 * Click response
 */
export interface ClickResponse {
  [key: string]: unknown; // Backend click response structure
}

/**
 * Extract context response
 */
export interface ExtractContextResponse {
  status: "ok" | "error";
  context?: unknown; // Context data from backend
  message?: string;
}

/**
 * Figma metadata response
 */
export interface FigmaMetadataResponse {
  status: "ok" | "error";
  metadata?: {
    public?: boolean;
    metadata_available?: boolean;
    note?: string;
    [key: string]: unknown;
  } | null;
  enhanced?: boolean;
}
