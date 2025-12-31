-- Migration: Add Evidence Snippets and Clustering Support to Feedback Entries
-- This migration adds support for evidence capture and finding clustering/deduplication

-- 1. Update severity enum to include "Blocker"
DO $$
BEGIN
    -- Check if 'Blocker' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'Blocker' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feedback_severity')
    ) THEN
        ALTER TYPE feedback_severity ADD VALUE 'Blocker' BEFORE 'High';
        RAISE NOTICE 'Added "Blocker" to feedback_severity enum.';
    ELSE
        RAISE NOTICE '"Blocker" already exists in feedback_severity enum.';
    END IF;
END $$;

-- 2. Create confidence_level enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confidence_level') THEN
        CREATE TYPE confidence_level AS ENUM ('Low', 'Med', 'High');
        RAISE NOTICE 'Created confidence_level enum.';
    ELSE
        RAISE NOTICE 'confidence_level enum already exists.';
    END IF;
END $$;

-- 3. Create finding_category enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_category') THEN
        CREATE TYPE finding_category AS ENUM (
            'navigation',
            'copy',
            'affordance_feedback',
            'forms',
            'hierarchy',
            'accessibility',
            'conversion',
            'other'
        );
        RAISE NOTICE 'Created finding_category enum.';
    ELSE
        RAISE NOTICE 'finding_category enum already exists.';
    END IF;
END $$;

-- 4. Add new columns to feedback_entries
DO $$
BEGIN
    -- Add category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='category') THEN
        ALTER TABLE feedback_entries ADD COLUMN category finding_category;
        RAISE NOTICE 'Column category added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column category already exists in feedback_entries table.';
    END IF;

    -- Add confidence_level column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='confidence_level') THEN
        ALTER TABLE feedback_entries ADD COLUMN confidence_level confidence_level;
        RAISE NOTICE 'Column confidence_level added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column confidence_level already exists in feedback_entries table.';
    END IF;

    -- Add evidence_snippets column (JSONB array of evidence objects)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='evidence_snippets') THEN
        ALTER TABLE feedback_entries ADD COLUMN evidence_snippets JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Column evidence_snippets added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column evidence_snippets already exists in feedback_entries table.';
    END IF;

    -- Add clustered_finding_id for grouping duplicates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='clustered_finding_id') THEN
        ALTER TABLE feedback_entries ADD COLUMN clustered_finding_id UUID REFERENCES feedback_entries(id) ON DELETE SET NULL;
        RAISE NOTICE 'Column clustered_finding_id added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column clustered_finding_id already exists in feedback_entries table.';
    END IF;

    -- Add frequency count (how many times this finding appeared)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='frequency') THEN
        ALTER TABLE feedback_entries ADD COLUMN frequency INTEGER DEFAULT 1;
        RAISE NOTICE 'Column frequency added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column frequency already exists in feedback_entries table.';
    END IF;

    -- Add triggered_by_tasks (array of task descriptions that triggered this finding)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='triggered_by_tasks') THEN
        ALTER TABLE feedback_entries ADD COLUMN triggered_by_tasks TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Column triggered_by_tasks added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column triggered_by_tasks already exists in feedback_entries table.';
    END IF;

    -- Add triggered_by_personas (array of persona names that triggered this finding)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feedback_entries' AND column_name='triggered_by_personas') THEN
        ALTER TABLE feedback_entries ADD COLUMN triggered_by_personas TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Column triggered_by_personas added to feedback_entries table.';
    ELSE
        RAISE NOTICE 'Column triggered_by_personas already exists in feedback_entries table.';
    END IF;
END $$;

-- 5. Create index for clustering
CREATE INDEX IF NOT EXISTS idx_feedback_entries_clustered_finding_id 
    ON feedback_entries(clustered_finding_id) 
    WHERE clustered_finding_id IS NOT NULL;

-- 6. Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_feedback_entries_category 
    ON feedback_entries(category) 
    WHERE category IS NOT NULL;

-- 7. Create index for frequency sorting
CREATE INDEX IF NOT EXISTS idx_feedback_entries_frequency 
    ON feedback_entries(frequency DESC) 
    WHERE frequency > 1;

-- Note: Evidence snippets structure (stored in JSONB):
-- [
--   {
--     "persona_name": "Alex Chen",
--     "persona_role": "Senior Marketing Manager",
--     "task_context": "Task 1: Select and save a government opportunity",
--     "what_happened_steps": [
--       "User clicked on 'Browse Opportunities' button",
--       "User scrolled through the list of opportunities",
--       "User clicked on an opportunity card",
--       "User looked for a 'Save' button but couldn't find it",
--       "User clicked back and tried again"
--     ],
--     "persona_quote": "I'm not sure where to save this. The interface doesn't make it clear.",
--     "ui_anchor": {
--       "frame_name": "Opportunity Detail View",
--       "element_label": "Save Button",
--       "bounding_box": {
--         "x": 1200,
--         "y": 800,
--         "width": 120,
--         "height": 40
--       },
--       "element_selector": "button.save-opportunity"
--     },
--     "timestamp": "00:45",
--     "screenshot_index": 12
--   }
-- ]

