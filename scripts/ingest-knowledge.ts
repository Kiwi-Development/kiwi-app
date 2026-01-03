/**
 * Knowledge Base Ingestion Script
 *
 * Populates the knowledge_chunks table with UX laws, WCAG guidelines, and growth patterns.
 *
 * Usage:
 *   npm run ingest-knowledge
 *   or
 *   npx tsx scripts/ingest-knowledge.ts
 *
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - SUPABASE_SECRET_KEY in .env.local (or SUPABASE_SERVICE_ROLE_KEY for legacy)
 *   - OPENAI_API_KEY in .env.local
 */

// Load environment variables FIRST before any other imports
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Handle both CommonJS and ES modules for path resolution
const getDirname = () => {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
};

const scriptDir = getDirname();

// Load .env.local file (Next.js priority)
const envLocalPath = path.join(scriptDir, "../.env.local");
const envPath = path.join(scriptDir, "../.env");

// Check if files exist and load them
if (fs.existsSync(envLocalPath)) {
  console.log(`📄 Loading .env.local from: ${envLocalPath}`);
  const result = dotenv.config({ path: envLocalPath });
  if (result.error) {
    console.warn(`⚠️  Warning: Error loading .env.local: ${result.error.message}`);
  }
} else {
  console.warn(`⚠️  Warning: .env.local not found at: ${envLocalPath}`);
}

// Also try .env as fallback
if (fs.existsSync(envPath)) {
  console.log(`📄 Loading .env from: ${envPath}`);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(`⚠️  Warning: Error loading .env: ${result.error.message}`);
  }
}

// Now import the ingestion function after env vars are loaded
import { ingestKnowledgeFile } from "../src/lib/knowledge-base/ingest";

async function main() {
  console.log("📚 Starting knowledge base ingestion...\n");
  console.log("⚠️  This will use OpenAI API to generate embeddings (costs apply)\n");

  // Debug: Show what env vars are loaded (without showing values)
  const hasSecretKey = !!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("🔍 Environment check:");
  console.log(
    `   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `   SUPABASE_SECRET_KEY: ${process.env.SUPABASE_SECRET_KEY ? "✅ Set" : "❌ Missing"}`
  );
  console.log(
    `   SUPABASE_SERVICE_ROLE_KEY (legacy): ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing"}`
  );
  console.log(`   Secret key available: ${hasSecretKey ? "✅ Yes" : "❌ No"}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing"}`);
  console.log("");

  // Check required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL not set in environment");
    console.error("   Make sure it's in .env.local as: NEXT_PUBLIC_SUPABASE_URL=your_url");
    process.exit(1);
  }

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseSecretKey) {
    console.error("❌ Error: SUPABASE_SECRET_KEY not set in environment");
    console.error("   Make sure it's in .env.local as: SUPABASE_SECRET_KEY=your_secret_key");
    console.error("   Get it from: Supabase Dashboard > Settings > API > Secret key");
    console.error("");
    console.error("   Note: This is different from the publishable key (sb_publishable_...)");
    console.error(
      "   The secret key (sb_secret_...) has elevated privileges and is needed for ingestion."
    );
    console.error("");
    console.error(
      "   Legacy support: You can also use SUPABASE_SERVICE_ROLE_KEY for backward compatibility."
    );
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY not set in environment");
    console.error("   Make sure it's in .env.local as: OPENAI_API_KEY=your_key");
    process.exit(1);
  }

  const knowledgeDir = path.join(scriptDir, "../src/lib/knowledge-base/knowledge");

  try {
    console.log("📖 Ingesting UX Laws...");
    await ingestKnowledgeFile(path.join(knowledgeDir, "ux-laws.md"), "ux_laws");

    console.log("\n📖 Ingesting WCAG Guidelines...");
    await ingestKnowledgeFile(path.join(knowledgeDir, "wcag-guidelines.md"), "wcag");

    console.log("\n📖 Ingesting Growth Patterns...");
    await ingestKnowledgeFile(path.join(knowledgeDir, "growth-patterns.md"), "growth_patterns");

    console.log("\n📖 Ingesting Nielsen's 10 Usability Heuristics...");
    await ingestKnowledgeFile(
      path.join(knowledgeDir, "nielsen-heuristics.md"),
      "nielsen_heuristics"
    );

    console.log("\n📖 Ingesting Kiwi UI Critique Rubric...");
    await ingestKnowledgeFile(path.join(knowledgeDir, "kiwi-ui-rubric.md"), "kiwi_rubric");

    console.log("\n✅ Knowledge base populated successfully!");
    console.log("\n💡 You can now use the reasoning engine in your test runs.");
  } catch (error) {
    console.error("\n❌ Error during ingestion:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
