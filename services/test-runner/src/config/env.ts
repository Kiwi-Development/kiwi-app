/**
 * Environment Configuration
 *
 * Loads and validates environment variables
 */

import dotenv from "dotenv";

dotenv.config();

export interface EnvConfig {
  // Browserbase
  browserbase: {
    apiKey: string;
    projectId: string;
  };
  // AI Models
  openai: {
    apiKey: string;
  };
  model: {
    name: string;
    apiKey?: string;
  };
  // Supabase
  supabase: {
    url: string;
    serviceRoleKey: string;
    storageBucket: string;
  };
  // Service
  port: number;
  nodeEnv: string;
  // Job Queue
  redis?: {
    url: string;
  };
  maxConcurrentRuns: number;
}

function getEnvVar(key: string, required = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value || "";
}

export function loadConfig(): EnvConfig {
  return {
    browserbase: {
      apiKey: getEnvVar("BROWSERBASE_API_KEY"),
      projectId: getEnvVar("BROWSERBASE_PROJECT_ID"),
    },
    openai: {
      apiKey: getEnvVar("OPENAI_API_KEY"),
    },
    model: {
      name: getEnvVar("MODEL_NAME"),
      // API key for the model (e.g., Google Gemini, OpenAI, etc.)
      apiKey: getEnvVar("MODEL_API_KEY", false) || undefined,
    },
    supabase: {
      url: getEnvVar("SUPABASE_URL"),
      serviceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
      storageBucket: getEnvVar("SUPABASE_STORAGE_BUCKET"),
    },
    port: parseInt(getEnvVar("PORT", false) || "3001", 10),
    nodeEnv: getEnvVar("NODE_ENV", false) || "development",
    redis: process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
        }
      : undefined,
    maxConcurrentRuns: parseInt(getEnvVar("MAX_CONCURRENT_RUNS", false) || "5", 10),
  };
}
