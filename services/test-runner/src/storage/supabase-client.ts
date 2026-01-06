/**
 * Supabase Client
 * 
 * Creates and manages Supabase client instances
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionConfig } from "../config/connections.js";

/**
 * Create Supabase client from connection config
 */
export function createSupabaseClient(config: ConnectionConfig): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey);
}

