# Adding Knowledge to the Knowledge Base

This guide explains how to add new knowledge sources to the Design Intelligence Platform.

## Quick Steps

1. **Create a markdown file** in `src/lib/knowledge-base/knowledge/`
2. **Update the database schema** (if adding a new category)
3. **Update TypeScript types** (if adding a new category)
4. **Update the ingestion script** to include the new file
5. **Run the ingestion script**

## Step-by-Step Guide

### Step 1: Create Knowledge File

Create a new markdown file in `src/lib/knowledge-base/knowledge/` with your content.

**Format Guidelines:**
- Use `##` for main sections/topics
- Use `**Source:**` to cite the origin
- Use `**Category:**` to indicate the type
- Use `**Description:**` for explanations
- Use `**Application:**` for how to apply it
- Use `**Example Violation:**` for what not to do
- Use `**Example Fix:**` for solutions

**Example structure:**
```markdown
# Your Knowledge Source Title

## Topic 1
**Source:** Author/Organization Name
**Category:** Category Name
**Description:** What this principle/law/guideline is about.

**Application:** How to apply this in design.

**Example Violation:** What violates this principle.

**Example Fix:** How to fix violations.
```

### Step 2: Update Database Schema (if new category)

If you're adding a **new category** (not using existing ones), update the database:

1. **Update the schema file:**
   - Edit `docs/knowledge_base_schema.sql`
   - Add your new category to the CHECK constraint:
   ```sql
   category TEXT NOT NULL CHECK (category IN ('ux_laws', 'wcag', 'growth_patterns', 'design_principles', 'nielsen_heuristics', 'kiwi_rubric', 'your_new_category')),
   ```

2. **Create a migration (if database already exists):**
   - Create `docs/knowledge_base_category_migration.sql` or add to existing migration
   - Run the migration in Supabase SQL Editor

### Step 3: Update TypeScript Types

Update the category type in these files:

1. **`src/lib/knowledge-base/ingest.ts`:**
   ```typescript
   category: 'ux_laws' | 'wcag' | 'growth_patterns' | 'design_principles' | 'nielsen_heuristics' | 'kiwi_rubric' | 'your_new_category';
   ```

2. **`src/lib/knowledge-base/vector-store.ts`:**
   ```typescript
   category: 'ux_laws' | 'wcag' | 'growth_patterns' | 'design_principles' | 'nielsen_heuristics' | 'kiwi_rubric' | 'your_new_category';
   ```

### Step 4: Update Ingestion Script

Add your new file to `scripts/ingest-knowledge.ts`:

```typescript
console.log("\n📖 Ingesting Your Knowledge Source...");
await ingestKnowledgeFile(
  path.join(knowledgeDir, "your-file.md"),
  "your_category"
);
```

### Step 5: Update Retrieval Logic (if needed)

If you want UX agents to search your new category, update `src/lib/knowledge-base/retrieval.ts`:

```typescript
const categoryMap: Record<string, KnowledgeChunk['category'] | null> = {
  ux: null, // Searches all UX categories
  accessibility: 'wcag',
  conversion: 'growth_patterns',
  // Add mapping if needed
};
```

### Step 6: Run Ingestion

```bash
npm run ingest-knowledge
```

## Existing Categories

You can use these existing categories without schema changes:

- **`ux_laws`** - UX laws and principles (Hick's Law, Fitts' Law, etc.)
- **`wcag`** - WCAG accessibility guidelines
- **`growth_patterns`** - Conversion optimization and growth patterns
- **`design_principles`** - General design principles
- **`nielsen_heuristics`** - Nielsen's 10 Usability Heuristics
- **`kiwi_rubric`** - Kiwi-specific UI critique rubric

## Best Practices

1. **Chunk Size:** Keep sections focused. The ingestion script splits content into ~1000 character chunks.

2. **Structure:** Use consistent formatting so the parser can extract titles and sources.

3. **Examples:** Include concrete examples of violations and fixes - these help agents provide better feedback.

4. **Citations:** Always include source citations so findings can reference authoritative sources.

5. **Actionability:** Focus on principles that lead to actionable fixes, not just theory.

## Example: Adding a New Category

Let's say you want to add "Material Design Guidelines":

1. **Create file:** `src/lib/knowledge-base/knowledge/material-design.md`

2. **Update schema:** Add `'material_design'` to CHECK constraint

3. **Update types:** Add `'material_design'` to TypeScript category types

4. **Update script:**
   ```typescript
   await ingestKnowledgeFile(path.join(knowledgeDir, "material-design.md"), "material_design");
   ```

5. **Run:** `npm run ingest-knowledge`

## Troubleshooting

**Error: "category check constraint violation"**
- You need to run the database migration to add the new category

**Error: "Type 'X' is not assignable to type..."**
- Update the TypeScript types in `ingest.ts` and `vector-store.ts`

**Knowledge not appearing in searches**
- Verify embeddings were generated (check `knowledge_chunks` table)
- Check that category matches exactly (case-sensitive)
- Verify RLS policies allow reading the chunks

## What You Just Added

You've successfully added:
- ✅ **Nielsen's 10 Usability Heuristics** - Classic UX principles
- ✅ **Kiwi UI Critique Rubric** - Custom 0-3 severity scale rubric

These are now available for the reasoning engine to cite in findings!

