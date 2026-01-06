/**
 * Evidence Storage
 * 
 * Handles storage of evidence (screenshots, DOM snapshots) in Supabase Storage
 */

import { createSupabaseClient } from "./supabase-client.js";
import type { ConnectionConfig } from "../config/connections.js";

/**
 * Store evidence in Supabase Storage
 */
export class EvidenceStorage {
  private config: ConnectionConfig;
  private bucket: string;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.bucket = config.supabase.storageBucket;
  }

  /**
   * Upload screenshot (base64 encoded) to storage
   */
  async uploadScreenshot(
    testRunId: string,
    screenshotIndex: number,
    screenshotBase64: string
  ): Promise<string> {
    const supabase = createSupabaseClient(this.config);
    const fileName = `${testRunId}/screenshots/${screenshotIndex}.png`;
    const buffer = Buffer.from(screenshotBase64, "base64");

    const { error } = await supabase.storage.from(this.bucket).upload(fileName, buffer, {
      contentType: "image/png",
      upsert: true,
    });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(this.bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  /**
   * Upload evidence JSON to storage
   */
  async uploadEvidence(
    testRunId: string,
    evidenceData: unknown
  ): Promise<string> {
    const supabase = createSupabaseClient(this.config);
    const fileName = `${testRunId}/evidence.json`;
    const content = JSON.stringify(evidenceData, null, 2);
    const buffer = Buffer.from(content, "utf-8");

    const { error } = await supabase.storage.from(this.bucket).upload(fileName, buffer, {
      contentType: "application/json",
      upsert: true,
    });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(this.bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  /**
   * Delete evidence for a test run (cleanup)
   */
  async deleteEvidence(testRunId: string): Promise<void> {
    const supabase = createSupabaseClient(this.config);
    const { error } = await supabase.storage.from(this.bucket).remove([`${testRunId}/`]);

    if (error) {
      // Log but don't throw - cleanup should be best-effort
      console.error(`Error deleting evidence for test run ${testRunId}:`, error);
    }
  }
}

