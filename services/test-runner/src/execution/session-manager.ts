/**
 * Session Manager
 *
 * Manages Stagehand v3 + Browserbase sessions with proper cleanup
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import type { ConnectionConfig } from "../config/connections.js";
import type { SessionInfo } from "../utils/types.js";

/**
 * Session Manager class
 * Tracks and manages browser sessions with proper cleanup
 */
export class SessionManager {
  private config: ConnectionConfig;
  private activeSessions: Map<string, Stagehand> = new Map();

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /**
   * Create a new browser session
   */
  async createSession(url: string): Promise<SessionInfo> {
    // Configure model with API key if provided
    const modelConfig = this.config.model.apiKey
      ? {
          modelName: this.config.model.name,
          apiKey: this.config.model.apiKey,
        }
      : this.config.model.name;

    const stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: this.config.browserbase.apiKey,
      projectId: this.config.browserbase.projectId,
      model: modelConfig,
      verbose: this.config.nodeEnv === "development" ? 2 : 1,
      experimental: true, // Required for agent callbacks (onStepFinish)
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    await page.goto(url);

    // Hide the scrollbar
    await page.evaluate(() => {
      // @ts-ignore - This code runs in the browser context where document exists
      const style = document.createElement("style");
      style.textContent = `
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
        body { overflow: -moz-scrollbars-none; }
      `;
      // @ts-ignore - This code runs in the browser context where document exists
      document.head.appendChild(style);
    });

    const sessionId = this.generateSessionId();
    this.activeSessions.set(sessionId, stagehand);

    // Get Browserbase session ID from stagehand instance (Stagehand v3 stores it on the instance)
    const browserbaseSessionId = (stagehand as any).browserbaseSessionID || "";

    return {
      sessionId,
      stagehand,
      browserbaseSessionId,
      page,
    };
  }

  /**
   * Close a session (CRITICAL: Always call this)
   */
  async closeSession(sessionId: string): Promise<void> {
    const stagehand = this.activeSessions.get(sessionId);
    if (stagehand) {
      try {
        await stagehand.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error closing session ${sessionId}:`, message);
        // Continue cleanup even if close() fails
      } finally {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get live view URL for iframe embedding (public, no auth required)
   */
  async getLiveViewUrl(sessionId: string): Promise<string> {
    const stagehand = this.activeSessions.get(sessionId);
    if (!stagehand) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Get Browserbase session ID
    // Try multiple possible property names
    const browserbaseSessionId =
      (stagehand as any).browserbaseSessionID ||
      (stagehand as any).sessionId ||
      (stagehand as any).session_id ||
      "";

    if (!browserbaseSessionId) {
      throw new Error(`Browserbase session ID not found for session ${sessionId}`);
    }

    // Use Browserbase SDK to get debug URL (public, no auth required)
    try {
      const browserbase = new Browserbase({
        apiKey: this.config.browserbase.apiKey,
      });

      const debugLinks = await browserbase.sessions.debug(browserbaseSessionId);
      // debuggerFullscreenUrl is public and doesn't require authentication
      // Add navbar=false parameter to hide the navbar
      const baseUrl = debugLinks.debuggerFullscreenUrl;
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}navbar=false`;
    } catch (error) {
      console.warn(
        `Failed to get debug URL from Browserbase SDK, falling back to embed URL:`,
        error
      );
      // Fallback to embed URL if SDK call fails, with navbar=false
      return `https://www.browserbase.com/sessions/${browserbaseSessionId}/embed?navbar=false`;
    }
  }

  /**
   * Cleanup all active sessions (for graceful shutdown)
   */
  async cleanupAllSessions(): Promise<void> {
    const cleanupPromises = Array.from(this.activeSessions.keys()).map((sessionId) =>
      this.closeSession(sessionId)
    );
    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
