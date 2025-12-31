# Supabase Database Schema

This document contains the complete SQL schema for the Kiwi persona-driven testing platform. The schema supports multi-tenancy, subscription management, persona versioning, audit trails, and comprehensive security.

## Table of Contents

1. [Enums and Types](#enums-and-types)
2. [Core Tables](#core-tables)
3. [Indexes](#indexes)
4. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
5. [Triggers](#triggers)
6. [Functions](#functions)
7. [Migration Notes](#migration-notes)

---

## Enums and Types

```sql
-- Organization member roles
CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');

-- Test status
CREATE TYPE test_status AS ENUM ('draft', 'queued', 'running', 'completed', 'needs-validation', 'error');

-- Test run status
CREATE TYPE test_run_status AS ENUM ('queued', 'running', 'completed', 'error');

-- Feedback severity
CREATE TYPE feedback_severity AS ENUM ('High', 'Med', 'Low');

-- Subscription tier
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');

-- Activity action types
CREATE TYPE activity_action AS ENUM (
  'create', 'update', 'delete', 'archive', 'restore',
  'share', 'unshare', 'invite', 'remove_member', 'change_role',
  'start_run', 'complete_run', 'cancel_run'
);

-- Resource types for activity log
CREATE TYPE resource_type AS ENUM (
  'profile', 'organization', 'persona', 'test', 'test_run', 'feedback', 'subscription'
);
```

---

## Core Tables

### 1. Profiles

User profiles linked to Supabase auth.users.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### 2. Organizations

Multi-tenancy support for teams/workspaces.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
```

### 3. Organization Members

Membership table with roles for access control.

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role organization_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
```

### 4. Personas

User personas with versioning support. Can be private (user_id only) or shared (organization_id).

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  variant TEXT, -- e.g., "Novice", "Expert"

  -- Ownership: either user_id (private) or organization_id (shared), or both
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Current version pointer
  current_version_id UUID,

  -- Flexible attributes stored as JSONB
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "tags": string[],
  --   "goals": string[],
  --   "behaviors": string[],
  --   "frustrations": string[],
  --   "constraints": string[],
  --   "accessibility": string[]
  -- }

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,

  -- Ensure persona has at least one owner
  CONSTRAINT personas_ownership_check CHECK (
    (user_id IS NOT NULL) OR (organization_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
```

### 5. Persona Versions

Historical versions of personas for accurate feedback attribution.

```sql
CREATE TABLE persona_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of persona data at this version
  name TEXT NOT NULL,
  role TEXT,
  variant TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),

  UNIQUE(persona_id, version_number)
);

-- Enable RLS
ALTER TABLE persona_versions ENABLE ROW LEVEL SECURITY;
```

### 6. Tests

Test definitions/projects.

```sql
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status test_status NOT NULL DEFAULT 'draft',

  -- Ownership
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Test configuration
  goal TEXT,
  use_case TEXT,
  artifact_type TEXT NOT NULL, -- "Figma" or "Live URL"
  figma_url_a TEXT,
  figma_url_b TEXT,
  live_url TEXT,

  -- Tasks as JSONB array
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: string[]

  -- Heuristics configuration
  heuristics JSONB DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "visibility": boolean,
  --   "realWorld": boolean,
  --   "userControl": boolean,
  --   "errorPrevention": boolean,
  --   "recognition": boolean,
  --   "consistency": boolean,
  --   "a11y": boolean
  -- }

  -- Aggregated metrics
  success_rate NUMERIC(5, 2), -- 0-100
  avg_time_seconds INTEGER,
  last_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
```

### 7. Test Runs

Individual test execution instances.

```sql
CREATE TABLE test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,

  -- Links to persona version (not current persona) for historical accuracy
  persona_version_id UUID NOT NULL REFERENCES persona_versions(id) ON DELETE RESTRICT,

  status test_run_status NOT NULL DEFAULT 'queued',

  -- Progress tracking
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed_tasks INTEGER DEFAULT 0,
  total_tasks INTEGER NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  estimated_duration_seconds INTEGER,

  -- Action tracking
  action_count INTEGER DEFAULT 0,

  -- Results
  task_completion_percentage NUMERIC(5, 2), -- 0-100

  -- General feedback
  general_feedback TEXT,

  -- Next steps (structured)
  next_steps JSONB,
  -- Structure: {
  --   "userExperience": string[],
  --   "informationArchitecture": string[],
  --   "accessibility": string[]
  -- }

  -- Run events/logs (for replay)
  events JSONB DEFAULT '[]'::jsonb,
  -- Structure: Array<{
  --   "id": string,
  --   "t": number, // seconds into replay
  --   "type": "click" | "submit" | "backtrack" | "error" | "rage" | "copy-risk" | "focus-trap",
  --   "label": string,
  --   "details"?: string,
  --   "personaId"?: string,
  --   "stepIndex"?: number
  -- }>

  logs JSONB DEFAULT '[]'::jsonb,
  -- Structure: Array<{ "t": number, "text": string }>

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
```

### 8. Feedback Entries

Granular feedback/findings from test runs.

```sql
CREATE TABLE feedback_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  persona_version_id UUID NOT NULL REFERENCES persona_versions(id) ON DELETE RESTRICT,

  title TEXT NOT NULL,
  severity feedback_severity NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  description TEXT NOT NULL,
  suggested_fix TEXT,

  -- Affecting tasks as JSONB array
  affecting_tasks JSONB DEFAULT '[]'::jsonb,
  -- Structure: string[]

  -- Validation tracking
  validated BOOLEAN,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  validation_note TEXT,

  -- Out of distribution flag
  out_of_distribution BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback_entries ENABLE ROW LEVEL SECURITY;
```

### 9. Subscription Tiers

Tier definitions with limits.

```sql
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Limits
  max_tests_per_month INTEGER,
  max_personas INTEGER,
  max_organization_members INTEGER,
  max_test_runs_per_test INTEGER,
  max_feedback_entries_per_run INTEGER,

  -- Features (JSONB for flexibility)
  features JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Insert default tiers
INSERT INTO subscription_tiers (tier, name, description, max_tests_per_month, max_personas, max_organization_members, max_test_runs_per_test, max_feedback_entries_per_run) VALUES
  ('free', 'Free', 'Basic testing for individuals', 5, 3, 1, 1, 10),
  ('pro', 'Pro', 'Advanced testing for small teams', 50, 20, 10, 5, 50),
  ('enterprise', 'Enterprise', 'Unlimited testing for large organizations', NULL, NULL, NULL, NULL, NULL);
```

### 10. Subscriptions

Active subscriptions with Stripe integration.

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id) ON DELETE RESTRICT,

  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
```

### 11. Usage Limits

Tracks current usage vs limits per organization.

```sql
CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Current period (monthly)
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage counters
  tests_created INTEGER DEFAULT 0,
  test_runs_completed INTEGER DEFAULT 0,
  personas_created INTEGER DEFAULT 0,
  feedback_entries_created INTEGER DEFAULT 0,

  -- Limits (snapshot from subscription_tier at period start)
  max_tests_per_month INTEGER,
  max_personas INTEGER,
  max_test_runs_per_test INTEGER,
  max_feedback_entries_per_run INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, period_start)
);

-- Enable RLS
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
```

### 12. Activity Log

System-wide audit trail.

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Action details
  action activity_action NOT NULL,
  resource_type resource_type NOT NULL,
  resource_id UUID,

  -- Context
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
```

---

## Indexes

### Performance Indexes

```sql
-- Profiles
CREATE INDEX idx_profiles_email ON profiles(email);

-- Organizations
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Organization Members
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(organization_id, role);

-- Personas
CREATE INDEX idx_personas_user_id ON personas(user_id);
CREATE INDEX idx_personas_organization_id ON personas(organization_id);
CREATE INDEX idx_personas_current_version_id ON personas(current_version_id);
CREATE INDEX idx_personas_deleted_at ON personas(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_personas_last_used_at ON personas(last_used_at DESC);

-- Persona Versions
CREATE INDEX idx_persona_versions_persona_id ON persona_versions(persona_id);
CREATE INDEX idx_persona_versions_version_number ON persona_versions(persona_id, version_number DESC);

-- Tests
CREATE INDEX idx_tests_user_id ON tests(user_id);
CREATE INDEX idx_tests_organization_id ON tests(organization_id);
CREATE INDEX idx_tests_status ON tests(status);
CREATE INDEX idx_tests_deleted_at ON tests(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX idx_tests_last_run_at ON tests(last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- Test Runs
CREATE INDEX idx_test_runs_test_id ON test_runs(test_id);
CREATE INDEX idx_test_runs_persona_version_id ON test_runs(persona_version_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_started_at ON test_runs(started_at DESC);
CREATE INDEX idx_test_runs_completed_at ON test_runs(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Feedback Entries
CREATE INDEX idx_feedback_entries_test_run_id ON feedback_entries(test_run_id);
CREATE INDEX idx_feedback_entries_persona_version_id ON feedback_entries(persona_version_id);
CREATE INDEX idx_feedback_entries_severity ON feedback_entries(severity);
CREATE INDEX idx_feedback_entries_validated ON feedback_entries(validated) WHERE validated IS NOT NULL;
CREATE INDEX idx_feedback_entries_created_at ON feedback_entries(created_at DESC);

-- Subscriptions
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Usage Limits
CREATE INDEX idx_usage_limits_organization_id ON usage_limits(organization_id);
CREATE INDEX idx_usage_limits_period ON usage_limits(organization_id, period_start DESC);

-- Activity Log
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_organization_id ON activity_log(organization_id);
CREATE INDEX idx_activity_log_resource ON activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action ON activity_log(action, created_at DESC);
```

---

## Row Level Security (RLS) Policies

### Helper Functions

```sql
-- Check if user is organization owner
CREATE OR REPLACE FUNCTION is_organization_owner(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = org_id AND owner_id = user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is organization admin or owner
CREATE OR REPLACE FUNCTION is_organization_admin(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = is_organization_admin.user_id
      AND role IN ('owner', 'admin')
  ) OR is_organization_owner(org_id, user_id);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is organization member
CREATE OR REPLACE FUNCTION is_organization_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = is_organization_member.user_id
  ) OR is_organization_owner(org_id, user_id);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get user's organization role
CREATE OR REPLACE FUNCTION get_organization_role(org_id UUID, user_id UUID)
RETURNS organization_role AS $$
  SELECT COALESCE(
    (SELECT role FROM organization_members
     WHERE organization_id = org_id AND user_id = get_organization_role.user_id),
    CASE WHEN is_organization_owner(org_id, user_id) THEN 'owner'::organization_role ELSE NULL END
  );
$$ LANGUAGE SQL SECURITY DEFINER;
```

### Profiles Policies

```sql
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### Organizations Policies

```sql
-- Users can view organizations they're members of
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_organization_member(id, auth.uid())
  );

-- Only owners can create organizations
CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Only owners can update organizations
CREATE POLICY "Owners can update organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- Only owners can delete organizations (soft delete)
CREATE POLICY "Owners can delete organizations"
  ON organizations FOR DELETE
  USING (owner_id = auth.uid());
```

### Organization Members Policies

```sql
-- Members can view members of their organizations
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

-- Owners and admins can add members
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

-- Owners and admins can update member roles
CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  USING (is_organization_admin(organization_id, auth.uid()));

-- Owners can remove members, admins can remove non-owners
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  USING (
    is_organization_admin(organization_id, auth.uid()) AND
    (get_organization_role(organization_id, user_id) != 'owner' OR
     auth.uid() = (SELECT owner_id FROM organizations WHERE id = organization_id))
  );
```

### Personas Policies

```sql
-- Users can view personas they own or that belong to their organizations
CREATE POLICY "Users can view accessible personas"
  ON personas FOR SELECT
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

-- Users can create personas (private or in their organizations)
CREATE POLICY "Users can create personas"
  ON personas FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

-- Users can update personas they own or in their organizations (if admin/owner)
CREATE POLICY "Users can update accessible personas"
  ON personas FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );

-- Users can delete personas they own or in their organizations (if admin/owner)
CREATE POLICY "Users can delete accessible personas"
  ON personas FOR DELETE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );
```

### Persona Versions Policies

```sql
-- Users can view persona versions for personas they can access
CREATE POLICY "Users can view accessible persona versions"
  ON persona_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_versions.persona_id
        AND (
          personas.user_id = auth.uid() OR
          (personas.organization_id IS NOT NULL AND
           is_organization_member(personas.organization_id, auth.uid()))
        )
    )
  );

-- Users can create persona versions for personas they can update
CREATE POLICY "Users can create persona versions"
  ON persona_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_versions.persona_id
        AND (
          personas.user_id = auth.uid() OR
          (personas.organization_id IS NOT NULL AND
           is_organization_admin(personas.organization_id, auth.uid()))
        )
    )
  );
```

### Tests Policies

```sql
-- Users can view tests they own or in their organizations
CREATE POLICY "Users can view accessible tests"
  ON tests FOR SELECT
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

-- Users can create tests
CREATE POLICY "Users can create tests"
  ON tests FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    (organization_id IS NULL OR is_organization_member(organization_id, auth.uid()))
  );

-- Users can update tests they own or in their organizations (if admin/owner)
CREATE POLICY "Users can update accessible tests"
  ON tests FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );

-- Users can delete tests they own or in their organizations (if admin/owner)
CREATE POLICY "Users can delete accessible tests"
  ON tests FOR DELETE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );
```

### Test Runs Policies

```sql
-- Users can view test runs for tests they can access
CREATE POLICY "Users can view accessible test runs"
  ON test_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_runs.test_id
        AND (
          tests.user_id = auth.uid() OR
          (tests.organization_id IS NOT NULL AND
           is_organization_member(tests.organization_id, auth.uid()))
        )
    )
  );

-- Users can create test runs for tests they can access
CREATE POLICY "Users can create test runs"
  ON test_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_runs.test_id
        AND (
          tests.user_id = auth.uid() OR
          (tests.organization_id IS NOT NULL AND
           is_organization_member(tests.organization_id, auth.uid()))
        )
    )
  );

-- Users can update test runs for tests they can access
CREATE POLICY "Users can update accessible test runs"
  ON test_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_runs.test_id
        AND (
          tests.user_id = auth.uid() OR
          (tests.organization_id IS NOT NULL AND
           is_organization_member(tests.organization_id, auth.uid()))
        )
    )
  );
```

### Feedback Entries Policies

```sql
-- Users can view feedback for test runs they can access
CREATE POLICY "Users can view accessible feedback"
  ON feedback_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM test_runs
      JOIN tests ON tests.id = test_runs.test_id
      WHERE test_runs.id = feedback_entries.test_run_id
        AND (
          tests.user_id = auth.uid() OR
          (tests.organization_id IS NOT NULL AND
           is_organization_member(tests.organization_id, auth.uid()))
        )
    )
  );

-- Users can create feedback for test runs they can access
CREATE POLICY "Users can create feedback"
  ON feedback_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_runs
      JOIN tests ON tests.id = test_runs.test_id
      WHERE test_runs.id = feedback_entries.test_run_id
        AND (
          tests.user_id = auth.uid() OR
          (tests.organization_id IS NOT NULL AND
           is_organization_member(tests.organization_id, auth.uid()))
        )
    )
  );

-- Users can update feedback for test runs they can access
CREATE POLICY "Users can update accessible feedback"
  ON feedback_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM test_runs
      JOIN tests ON tests.id = test_runs.test_id
      WHERE test_runs.id = feedback_entries.test_run_id
        AND (
          tests.user_id = auth.uid() OR
          (tests.organization_id IS NOT NULL AND
           is_organization_member(tests.organization_id, auth.uid()))
        )
    )
  );
```

### Subscription Tiers Policies

```sql
-- Everyone can view subscription tiers (public information)
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  USING (true);
```

### Subscriptions Policies

```sql
-- Users can view subscriptions for organizations they belong to
CREATE POLICY "Users can view organization subscriptions"
  ON subscriptions FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

-- Only owners can create/update subscriptions
CREATE POLICY "Owners can manage subscriptions"
  ON subscriptions FOR ALL
  USING (is_organization_owner(organization_id, auth.uid()));
```

### Usage Limits Policies

```sql
-- Users can view usage limits for organizations they belong to
CREATE POLICY "Users can view organization usage"
  ON usage_limits FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));
```

### Activity Log Policies

```sql
-- Users can view activity logs for their organizations
CREATE POLICY "Users can view organization activity"
  ON activity_log FOR SELECT
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

-- System can insert activity logs (via triggers/functions)
CREATE POLICY "System can log activity"
  ON activity_log FOR INSERT
  WITH CHECK (true);
```

---

## Triggers

### Auto-create Profile on Signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Update updated_at Timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_runs_updated_at
  BEFORE UPDATE ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_entries_updated_at
  BEFORE UPDATE ON feedback_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_limits_updated_at
  BEFORE UPDATE ON usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Auto-create Persona Version on Persona Update

```sql
CREATE OR REPLACE FUNCTION create_persona_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  new_version_number INTEGER;
  new_version_id UUID;
BEGIN
  -- Only create version if persona data actually changed
  IF OLD.name IS DISTINCT FROM NEW.name OR
     OLD.role IS DISTINCT FROM NEW.role OR
     OLD.variant IS DISTINCT FROM NEW.variant OR
     OLD.attributes::text IS DISTINCT FROM NEW.attributes::text THEN

    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO new_version_number
    FROM persona_versions
    WHERE persona_id = NEW.id;

    -- Create new version
    INSERT INTO persona_versions (
      persona_id,
      version_number,
      name,
      role,
      variant,
      attributes,
      created_by
    )
    VALUES (
      NEW.id,
      new_version_number,
      NEW.name,
      NEW.role,
      NEW.variant,
      NEW.attributes,
      auth.uid()
    )
    RETURNING id INTO new_version_id;

    -- Update current_version_id
    NEW.current_version_id = new_version_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER persona_version_on_update
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION create_persona_version_on_update();
```

### Auto-create Initial Persona Version

```sql
CREATE OR REPLACE FUNCTION create_initial_persona_version()
RETURNS TRIGGER AS $$
DECLARE
  new_version_id UUID;
BEGIN
  -- Create initial version
  INSERT INTO persona_versions (
    persona_id,
    version_number,
    name,
    role,
    variant,
    attributes,
    created_by
  )
  VALUES (
    NEW.id,
    1,
    NEW.name,
    NEW.role,
    NEW.variant,
    NEW.attributes,
    auth.uid()
  )
  RETURNING id INTO new_version_id;

  -- Set as current version
  NEW.current_version_id = new_version_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER persona_initial_version
  AFTER INSERT ON personas
  FOR EACH ROW EXECUTE FUNCTION create_initial_persona_version();
```

### Log Activity

```sql
CREATE OR REPLACE FUNCTION log_activity(
  p_action activity_action,
  p_resource_type resource_type,
  p_resource_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
  org_id UUID;
BEGIN
  -- Determine organization_id from resource
  CASE p_resource_type
    WHEN 'organization' THEN
      SELECT id INTO org_id FROM organizations WHERE id = p_resource_id;
    WHEN 'persona' THEN
      SELECT organization_id INTO org_id FROM personas WHERE id = p_resource_id;
    WHEN 'test' THEN
      SELECT organization_id INTO org_id FROM tests WHERE id = p_resource_id;
    WHEN 'test_run' THEN
      SELECT tests.organization_id INTO org_id
      FROM test_runs
      JOIN tests ON tests.id = test_runs.test_id
      WHERE test_runs.id = p_resource_id;
    WHEN 'feedback' THEN
      SELECT tests.organization_id INTO org_id
      FROM feedback_entries
      JOIN test_runs ON test_runs.id = feedback_entries.test_run_id
      JOIN tests ON tests.id = test_runs.test_id
      WHERE feedback_entries.id = p_resource_id;
    WHEN 'subscription' THEN
      SELECT organization_id INTO org_id FROM subscriptions WHERE id = p_resource_id;
    ELSE
      org_id := NULL;
  END CASE;

  -- Insert activity log
  INSERT INTO activity_log (
    user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    auth.uid(),
    org_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example trigger for logging test creation
CREATE OR REPLACE FUNCTION log_test_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('create', 'test', NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_activity('update', 'test', NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity('delete', 'test', OLD.id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_activity_log
  AFTER INSERT OR UPDATE OR DELETE ON tests
  FOR EACH ROW EXECUTE FUNCTION log_test_activity();
```

### Update Persona last_used_at

```sql
CREATE OR REPLACE FUNCTION update_persona_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE personas
  SET last_used_at = NOW()
  WHERE id = (
    SELECT persona_id
    FROM persona_versions
    WHERE id = NEW.persona_version_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_run_persona_usage
  AFTER INSERT ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_persona_last_used();
```

### Update Test Metrics on Test Run Completion

```sql
CREATE OR REPLACE FUNCTION update_test_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE tests
    SET
      last_run_at = NEW.completed_at,
      success_rate = NEW.task_completion_percentage,
      avg_time_seconds = NEW.duration_seconds
    WHERE id = NEW.test_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_run_metrics_update
  AFTER UPDATE ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_test_metrics();
```

---

## Functions

### Get or Create Current Usage Period

```sql
CREATE OR REPLACE FUNCTION get_or_create_usage_period(p_organization_id UUID)
RETURNS usage_limits AS $$
DECLARE
  current_period usage_limits;
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
BEGIN
  -- Calculate current period (monthly, starting from 1st of month)
  period_start := date_trunc('month', NOW());
  period_end := period_start + INTERVAL '1 month';

  -- Try to get existing period
  SELECT * INTO current_period
  FROM usage_limits
  WHERE organization_id = p_organization_id
    AND period_start = get_or_create_usage_period.period_start;

  -- If doesn't exist, create it
  IF current_period IS NULL THEN
    -- Get limits from current subscription
    INSERT INTO usage_limits (
      organization_id,
      period_start,
      period_end,
      max_tests_per_month,
      max_personas,
      max_test_runs_per_test,
      max_feedback_entries_per_run
    )
    SELECT
      p_organization_id,
      period_start,
      period_end,
      st.max_tests_per_month,
      st.max_personas,
      st.max_test_runs_per_test,
      st.max_feedback_entries_per_run
    FROM subscriptions s
    JOIN subscription_tiers st ON st.id = s.tier_id
    WHERE s.organization_id = p_organization_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
    ORDER BY s.created_at DESC
    LIMIT 1
    RETURNING * INTO current_period;

    -- If no subscription, use free tier defaults
    IF current_period IS NULL THEN
      INSERT INTO usage_limits (
        organization_id,
        period_start,
        period_end,
        max_tests_per_month,
        max_personas,
        max_test_runs_per_test,
        max_feedback_entries_per_run
      )
      SELECT
        p_organization_id,
        period_start,
        period_end,
        st.max_tests_per_month,
        st.max_personas,
        st.max_test_runs_per_test,
        st.max_feedback_entries_per_run
      FROM subscription_tiers st
      WHERE st.tier = 'free'
      RETURNING * INTO current_period;
    END IF;
  END IF;

  RETURN current_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Check Usage Limits

```sql
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_organization_id UUID,
  p_limit_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  usage usage_limits;
  current_count INTEGER;
  max_count INTEGER;
BEGIN
  -- Get or create current usage period
  usage := get_or_create_usage_period(p_organization_id);

  -- Check specific limit
  CASE p_limit_type
    WHEN 'tests' THEN
      current_count := usage.tests_created;
      max_count := usage.max_tests_per_month;
    WHEN 'personas' THEN
      current_count := usage.personas_created;
      max_count := usage.max_personas;
    WHEN 'test_runs' THEN
      -- This would need test_id context, simplified here
      RETURN TRUE; -- Assume unlimited for now
    WHEN 'feedback' THEN
      -- This would need test_run_id context, simplified here
      RETURN TRUE; -- Assume unlimited for now
    ELSE
      RETURN FALSE;
  END CASE;

  -- Check if limit would be exceeded
  IF max_count IS NULL THEN
    RETURN TRUE; -- Unlimited
  END IF;

  RETURN (current_count + p_increment) <= max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Increment Usage Counter

```sql
CREATE OR REPLACE FUNCTION increment_usage(
  p_organization_id UUID,
  p_counter_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  usage usage_limits;
BEGIN
  usage := get_or_create_usage_period(p_organization_id);

  CASE p_counter_type
    WHEN 'tests' THEN
      UPDATE usage_limits
      SET tests_created = tests_created + p_increment
      WHERE id = usage.id;
    WHEN 'test_runs' THEN
      UPDATE usage_limits
      SET test_runs_completed = test_runs_completed + p_increment
      WHERE id = usage.id;
    WHEN 'personas' THEN
      UPDATE usage_limits
      SET personas_created = personas_created + p_increment
      WHERE id = usage.id;
    WHEN 'feedback' THEN
      UPDATE usage_limits
      SET feedback_entries_created = feedback_entries_created + p_increment
      WHERE id = usage.id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Migration Notes

### Running the Schema

1. **Run in Supabase SQL Editor** - Execute each section in order:
   - Enums and Types
   - Core Tables
   - Indexes
   - Functions (helper functions first)
   - RLS Policies
   - Triggers

2. **Verify Setup**:

   ```sql
   -- Check all tables exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;

   -- Check RLS is enabled
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public';

   -- Check indexes
   SELECT indexname, tablename FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

### Migrating from localStorage

The current application uses localStorage for:

- `kiwi_personas` - Migrate to `personas` table
- `kiwi_tests` - Migrate to `tests` and `test_runs` tables

**Migration Strategy**:

1. Create a migration script that:
   - Reads from localStorage (via frontend)
   - Creates profiles for users
   - Creates default organization for each user
   - Migrates personas to `personas` table
   - Migrates tests to `tests` table
   - Creates initial persona versions

2. Example migration query structure:
   ```sql
   -- For each user's localStorage data:
   -- 1. Ensure profile exists
   -- 2. Create default organization
   -- 3. Insert personas (with initial versions)
   -- 4. Insert tests
   -- 5. If test has runs, insert test_runs and feedback_entries
   ```

### Common Queries

**Get user's accessible personas**:

```sql
SELECT p.*, pv.*
FROM personas p
LEFT JOIN persona_versions pv ON pv.id = p.current_version_id
WHERE p.user_id = auth.uid()
   OR (p.organization_id IS NOT NULL AND
       is_organization_member(p.organization_id, auth.uid()))
ORDER BY p.last_used_at DESC NULLS LAST;
```

**Get organization's tests with latest run**:

```sql
SELECT t.*, tr.status as latest_run_status, tr.completed_at as latest_run_completed
FROM tests t
LEFT JOIN LATERAL (
  SELECT status, completed_at
  FROM test_runs
  WHERE test_id = t.id
  ORDER BY created_at DESC
  LIMIT 1
) tr ON true
WHERE t.organization_id = $1
ORDER BY t.created_at DESC;
```

**Get test run with feedback**:

```sql
SELECT
  tr.*,
  pv.name as persona_name,
  pv.variant as persona_variant,
  json_agg(fe.*) FILTER (WHERE fe.id IS NOT NULL) as feedback
FROM test_runs tr
JOIN persona_versions pv ON pv.id = tr.persona_version_id
LEFT JOIN feedback_entries fe ON fe.test_run_id = tr.id
WHERE tr.test_id = $1
GROUP BY tr.id, pv.id;
```

### Performance Optimization Tips

1. **Partition activity_log** by month if it grows large
2. **Archive old test_runs** after a retention period
3. **Use materialized views** for dashboard aggregations
4. **Monitor slow queries** using `pg_stat_statements`
5. **Consider read replicas** for analytics queries

### Security Checklist

- [x] RLS enabled on all tables
- [x] Policies enforce organization membership
- [x] Policies differentiate owner/admin/member roles
- [x] Private resources (user_id only) are protected
- [x] Helper functions use `SECURITY DEFINER` appropriately
- [x] Triggers use `SECURITY DEFINER` for system operations

---

## Next Steps

1. Review and run the schema in Supabase SQL editor
2. Test RLS policies with different user roles
3. Create migration scripts for existing localStorage data
4. Update application code to use new schema
5. Set up Stripe webhook handlers for subscription management
6. Implement usage limit checks in application logic
7. Set up monitoring and alerts for database performance
