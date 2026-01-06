/**
 * Health Check Routes
 * 
 * Validates all connections and service health
 */

import type { ConnectionConfig } from "../../config/connections.js";
import { validateConnections } from "../../config/connections.js";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  connections: {
    browserbase: "ok" | "error";
    openai: "ok" | "error";
    supabase: "ok" | "error";
    redis?: "ok" | "error";
  };
  timestamp: number;
  error?: string;
}

/**
 * Health check endpoint handler
 */
export async function healthCheck(config: ConnectionConfig): Promise<HealthStatus> {
  try {
    await validateConnections(config);
    return {
      status: "healthy",
      connections: {
        browserbase: "ok",
        openai: "ok",
        supabase: "ok",
        ...(config.redis ? { redis: "ok" } : {}),
      },
      timestamp: Date.now(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "unhealthy",
      connections: {
        browserbase: "error",
        openai: "error",
        supabase: "error",
        ...(config.redis ? { redis: "error" } : {}),
      },
      timestamp: Date.now(),
      error: message,
    };
  }
}

