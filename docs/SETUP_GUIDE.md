# Design Intelligence Platform - Setup Guide

This guide will help you set up the Design Intelligence Platform with semantic context extraction, multi-agent reasoning, and knowledge base.

## Prerequisites

- Supabase project with database access
- OpenAI API key
- Node.js and npm installed
- Python 3.9+ with pip

## Step 1: Database Setup

### 1.1 Enable pgvector Extension

In your Supabase SQL Editor, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 1.2 Create Knowledge Base Schema

Copy and paste the entire contents of `docs/knowledge_base_schema.sql` into Supabase SQL Editor and execute it.

This creates:

- `knowledge_chunks` table for storing design knowledge
- Vector search indexes
- RLS policies

### 1.3 Update Existing Tables (if you have an existing database)

Copy and paste the entire contents of `docs/database_schema_migration.sql` into Supabase SQL Editor and execute it.

This adds:

- `semantic_context` column to `test_runs` table
- `knowledge_citations` column to `feedback_entries` table
- `developer_outputs` column to `feedback_entries` table

**Note:** If you're setting up a fresh database, these columns are already included in `docs/database_schema.sql`.

## Step 2: Populate Knowledge Base

### 2.1 Install Dependencies

Make sure you have the required packages:

```bash
npm install
```

### 2.2 Set Up Environment Variables

Add to your `.env.local`:

```bash
# Existing variables
OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key  # Or use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

# Required for knowledge base ingestion (use new secret key format)
SUPABASE_SECRET_KEY=your_secret_key  # Get from Supabase Dashboard > Settings > API > Secret key (sb_secret_...)

# Legacy support (optional, if you're still using old keys)
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional (for enhanced Figma metadata - not required)
FIGMA_API_TOKEN=your_figma_token  # Only if you want enhanced Figma metadata
```

**Important:**

- The `SUPABASE_SECRET_KEY` (new format: `sb_secret_...`) is only needed for the ingestion script.
- This is different from the publishable key (`sb_publishable_...`) which is safe to expose.
- The secret key has elevated privileges and bypasses RLS - keep it secure!
- You can find it in your Supabase Dashboard > Settings > API > Secret key.
- Legacy support: The script also accepts `SUPABASE_SERVICE_ROLE_KEY` for backward compatibility.

### 2.3 Run Knowledge Base Ingestion

Create a script file `scripts/ingest-knowledge.ts`:

```typescript
import { ingestKnowledgeFile } from "../src/lib/knowledge-base/ingest";
import * as path from "path";

async function main() {
  const knowledgeDir = path.join(__dirname, "../src/lib/knowledge-base/knowledge");

  console.log("📚 Starting knowledge base ingestion...\n");

  await ingestKnowledgeFile(path.join(knowledgeDir, "ux-laws.md"), "ux_laws");

  await ingestKnowledgeFile(path.join(knowledgeDir, "wcag-guidelines.md"), "wcag");

  await ingestKnowledgeFile(path.join(knowledgeDir, "growth-patterns.md"), "growth_patterns");

  console.log("\n✅ Knowledge base populated!");
}

main().catch(console.error);
```

Then run:

```bash
npx tsx scripts/ingest-knowledge.ts
```

**Note:** This will:

- Read the knowledge markdown files
- Generate embeddings using OpenAI
- Insert chunks into the `knowledge_chunks` table
- May take a few minutes and cost a small amount in OpenAI API usage

## Step 3: Backend Setup

### 3.1 Install Python Dependencies

```bash
cd backend
source venv/bin/activate  # or your venv activation command
pip install -r requirements.txt
```

The `requirements.txt` already includes `aiohttp` which was added for the new endpoints.

### 3.2 Test Backend Endpoints

Start your backend server:

```bash
cd backend
python server.py
```

Test the new endpoints:

```bash
# Test context extraction (requires an active session)
curl -X POST http://localhost:5001/extract-context \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "your-session-id"}'

# Test Figma metadata (optional)
curl -X POST http://localhost:5001/figma-metadata \
  -H "Content-Type: application/json" \
  -d '{"url": "https://figma.com/file/..."}'
```

## Step 4: Verify Integration

### 4.1 Test a Run

1. Create a new test in the dashboard
2. Start a test run
3. The system will now:
   - Extract semantic context periodically during the run
   - Enhance findings with reasoning engine when test completes
   - Save citations and developer outputs to database

### 4.2 Check Database

Verify that data is being saved:

```sql
-- Check if semantic context is being saved
SELECT id, semantic_context IS NOT NULL as has_context
FROM test_runs
ORDER BY created_at DESC
LIMIT 5;

-- Check if citations are being saved
SELECT id, title, knowledge_citations, developer_outputs
FROM feedback_entries
WHERE knowledge_citations IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

## Step 5: Model Configuration (Optional)

The system uses the model specified in `OPENAI_MODEL` environment variable, or defaults to `gpt-4o`.

See "Model Recommendations" section below for guidance on choosing the best model.

## Troubleshooting

### Knowledge Base Not Populating

- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Verify pgvector extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'vector';`
- Check OpenAI API key is valid and has credits

### Context Extraction Failing

- Ensure backend server is running
- Check that browser session is active
- Verify backend logs for errors

### Reasoning Engine Not Enhancing Findings

- Check browser console for errors
- Verify semantic context is being extracted (check `semanticContextRef` in console)
- Ensure reasoning API endpoint is accessible: `/dashboard/runs/[id]/reasoning`

### Citations Not Appearing

- Verify knowledge base was populated (check `knowledge_chunks` table)
- Check that embeddings were generated correctly
- Ensure RLS policies allow reading `knowledge_chunks`

## Next Steps

- Customize knowledge base content in `src/lib/knowledge-base/knowledge/`
- Adjust agent prompts in `src/lib/reasoning-engine/agents/`
- Customize output generators in `src/lib/output-generator/`
- Update UI to display citations and developer outputs in reports page
