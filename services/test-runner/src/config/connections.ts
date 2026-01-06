/**
 * Connection Validation Module
 * 
 * Validates all external service connections at startup
 */

import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import type { EnvConfig } from "./env.js";

export type ConnectionConfig = EnvConfig;

/**
 * Validate all external service connections
 */
export async function validateConnections(config: ConnectionConfig): Promise<void> {
  const errors: string[] = [];

  // Validate Browserbase
  try {
    // Test Browserbase API key with a simple API call
    const response = await fetch("https://www.browserbase.com/v1/sessions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.browserbase.apiKey}`,
        "X-Browserbase-Project-Id": config.browserbase.projectId,
      },
    });
    if (!response.ok && response.status !== 404) {
      errors.push(`Browserbase connection failed: ${response.statusText}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Browserbase connection error: ${message}`);
  }

  // Validate OpenAI
  try {
    const openai = new OpenAI({ apiKey: config.openai.apiKey });
    await openai.models.list(); // Simple API call to validate
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`OpenAI connection failed: ${message}`);
  }

  // Validate Supabase Database
  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const { error } = await supabase.from("tests").select("id").limit(1);
    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (acceptable)
      errors.push(`Supabase database connection failed: ${error.message}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Supabase database connection error: ${message}`);
  }

  // Validate Supabase Storage
  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const { error } = await supabase.storage.from(config.supabase.storageBucket).list("", {
      limit: 1,
    });
    if (error) {
      errors.push(`Supabase storage connection failed: ${error.message}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Supabase storage connection error: ${message}`);
  }

  // Validate Redis (if provided)
  // In development, Redis is optional - warn but don't fail
  if (config.redis) {
    try {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: false,
      });
      await redis.ping();
      redis.disconnect();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (config.nodeEnv === "development") {
        // In development, warn but don't fail
        console.warn(`⚠️  Redis connection failed (optional in development): ${message}`);
        console.warn("   Service will run in synchronous mode without job queue");
      } else {
        // In production, fail if Redis is configured but unavailable
        errors.push(`Redis connection failed: ${message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Connection validation failed:\n${errors.join("\n")}`);
  }
}

