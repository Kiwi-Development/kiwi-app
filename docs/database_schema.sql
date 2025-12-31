-- ============================================================================
-- Supabase Database Schema for Kiwi Platform
-- ============================================================================
-- Execute this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. ENUMS AND TYPES
-- ============================================================================

-- Organization member roles
CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');

-- Test status
CREATE TYPE test_status AS ENUM ('draft', 'queued', 'running', 'completed', 'needs-validation', 'error');

-- Test run status
CREATE TYPE test_run_status AS ENUM ('queued', 'running', 'completed', 'error');

-- Feedback severity
CREATE TYPE feedback_severity AS ENUM ('High', 'Med', 'Low');

-- Subscription tier
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'team', 'growth');

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

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Organizations
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
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Organization Members
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
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Personas
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  variant TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  current_version_id UUID,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  CONSTRAINT personas_ownership_check CHECK (
    (user_id IS NOT NULL) OR (organization_id IS NOT NULL)
  )
);
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Persona Versions
CREATE TABLE persona_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  variant TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(persona_id, version_number)
);
ALTER TABLE persona_versions ENABLE ROW LEVEL SECURITY;

-- Tests
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status test_status NOT NULL DEFAULT 'draft',
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  goal TEXT,
  use_case TEXT,
  artifact_type TEXT NOT NULL,
  figma_url_a TEXT,
  figma_url_b TEXT,
  live_url TEXT,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  heuristics JSONB DEFAULT '{}'::jsonb,
  success_rate NUMERIC(5, 2),
  avg_time_seconds INTEGER,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

-- Test Runs
CREATE TABLE test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  persona_version_id UUID NOT NULL REFERENCES persona_versions(id) ON DELETE RESTRICT,
  status test_run_status NOT NULL DEFAULT 'queued',
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed_tasks INTEGER DEFAULT 0,
  total_tasks INTEGER NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  estimated_duration_seconds INTEGER,
  action_count INTEGER DEFAULT 0,
  task_completion_percentage NUMERIC(5, 2),
  general_feedback TEXT,
  next_steps JSONB,
  events JSONB DEFAULT '[]'::jsonb,
  logs JSONB DEFAULT '[]'::jsonb,
  semantic_context JSONB, -- DOM tree, accessibility tree, page metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;

-- Feedback Entries
CREATE TABLE feedback_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  persona_version_id UUID NOT NULL REFERENCES persona_versions(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  severity feedback_severity NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  description TEXT NOT NULL,
  suggested_fix TEXT,
  affecting_tasks JSONB DEFAULT '[]'::jsonb,
  validated BOOLEAN,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES profiles(id),
  validation_note TEXT,
  out_of_distribution BOOLEAN DEFAULT FALSE,
  knowledge_citations JSONB DEFAULT '[]'::jsonb, -- Array of {source, title, category, chunk_id} references
  developer_outputs JSONB DEFAULT '{}'::jsonb, -- {code_snippets: [], specs: {}, tickets: []}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE feedback_entries ENABLE ROW LEVEL SECURITY;

-- Subscription Tiers
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  credits_per_month INTEGER,
  max_editor_seats INTEGER,
  max_questions_per_survey INTEGER,
  max_screens_per_test INTEGER,
  max_personas INTEGER,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Insert default tiers
INSERT INTO subscription_tiers (tier, name, description, monthly_price_cents, credits_per_month, max_editor_seats, max_questions_per_survey, max_screens_per_test, max_personas) VALUES
  ('free', 'Free', 'Basic testing for individuals', 0, 5, 1, 5, 5, 1),
  ('pro', 'Pro', 'Advanced testing for small teams', 4900, 20, 2, 10, 10, 5),
  ('team', 'Team', 'Collaborative testing for growing teams', 14900, 80, 5, 25, 25, 15),
  ('growth', 'Growth', 'Scalable testing for large organizations', 34900, 200, 10, 50, 50, 30);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Usage Limits
CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  credits_used INTEGER DEFAULT 0,
  personas_created INTEGER DEFAULT 0,
  editor_seats_used INTEGER DEFAULT 0,
  -- Limits (snapshot from subscription_tier at period start)
  credits_per_month INTEGER,
  max_personas INTEGER,
  max_editor_seats INTEGER,
  max_questions_per_survey INTEGER,
  max_screens_per_test INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, period_start)
);
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

-- Activity Log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action activity_action NOT NULL,
  resource_type resource_type NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

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

-- ============================================================================
-- 4. HELPER FUNCTIONS (for RLS policies)
-- ============================================================================

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

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Profiles Policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organizations Policies
CREATE POLICY "Users can view organizations they belong to"
  ON organizations FOR SELECT
  USING (
    owner_id = auth.uid() OR
    is_organization_member(id, auth.uid())
  );

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete organizations"
  ON organizations FOR DELETE
  USING (owner_id = auth.uid());

-- Organization Members Policies
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  USING (is_organization_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  USING (
    is_organization_admin(organization_id, auth.uid()) AND
    (get_organization_role(organization_id, user_id) != 'owner' OR
     auth.uid() = (SELECT owner_id FROM organizations WHERE id = organization_id))
  );

-- Personas Policies
CREATE POLICY "Users can view accessible personas"
  ON personas FOR SELECT
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

CREATE POLICY "Users can create personas"
  ON personas FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

CREATE POLICY "Users can update accessible personas"
  ON personas FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );

CREATE POLICY "Users can delete accessible personas"
  ON personas FOR DELETE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );

-- Persona Versions Policies
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

-- Tests Policies
CREATE POLICY "Users can view accessible tests"
  ON tests FOR SELECT
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

CREATE POLICY "Users can create tests"
  ON tests FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    (organization_id IS NULL OR is_organization_member(organization_id, auth.uid()))
  );

CREATE POLICY "Users can update accessible tests"
  ON tests FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );

CREATE POLICY "Users can delete accessible tests"
  ON tests FOR DELETE
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_admin(organization_id, auth.uid()))
  );

-- Test Runs Policies
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

-- Feedback Entries Policies
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

-- Subscription Tiers Policies
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  USING (true);

-- Subscriptions Policies
CREATE POLICY "Users can view organization subscriptions"
  ON subscriptions FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Owners can manage subscriptions"
  ON subscriptions FOR ALL
  USING (is_organization_owner(organization_id, auth.uid()));

-- Usage Limits Policies
CREATE POLICY "Users can view organization usage"
  ON usage_limits FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

-- Activity Log Policies
CREATE POLICY "Users can view organization activity"
  ON activity_log FOR SELECT
  USING (
    user_id = auth.uid() OR
    (organization_id IS NOT NULL AND is_organization_member(organization_id, auth.uid()))
  );

CREATE POLICY "System can log activity"
  ON activity_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Auto-create Profile on Signup
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members;
CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;
CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tests_updated_at ON tests;
CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_runs_updated_at ON test_runs;
CREATE TRIGGER update_test_runs_updated_at
  BEFORE UPDATE ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_entries_updated_at ON feedback_entries;
CREATE TRIGGER update_feedback_entries_updated_at
  BEFORE UPDATE ON feedback_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON subscription_tiers;
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_limits_updated_at ON usage_limits;
CREATE TRIGGER update_usage_limits_updated_at
  BEFORE UPDATE ON usage_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create Persona Version on Persona Update
CREATE OR REPLACE FUNCTION create_persona_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  new_version_number INTEGER;
  new_version_id UUID;
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name OR
     OLD.role IS DISTINCT FROM NEW.role OR
     OLD.variant IS DISTINCT FROM NEW.variant OR
     OLD.attributes::text IS DISTINCT FROM NEW.attributes::text THEN
    
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO new_version_number
    FROM persona_versions
    WHERE persona_id = NEW.id;
    
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
    
    NEW.current_version_id = new_version_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS persona_version_on_update ON personas;
CREATE TRIGGER persona_version_on_update
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION create_persona_version_on_update();

-- Auto-create Initial Persona Version
CREATE OR REPLACE FUNCTION create_initial_persona_version()
RETURNS TRIGGER AS $$
DECLARE
  new_version_id UUID;
BEGIN
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
  
  -- Update the persona with the version ID (AFTER INSERT can't modify NEW, so we update the row)
  UPDATE personas
  SET current_version_id = new_version_id
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS persona_initial_version ON personas;
CREATE TRIGGER persona_initial_version
  AFTER INSERT ON personas
  FOR EACH ROW EXECUTE FUNCTION create_initial_persona_version();

-- Log Activity
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

DROP TRIGGER IF EXISTS test_activity_log ON tests;
CREATE TRIGGER test_activity_log
  AFTER INSERT OR UPDATE OR DELETE ON tests
  FOR EACH ROW EXECUTE FUNCTION log_test_activity();

-- Update Persona last_used_at
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

DROP TRIGGER IF EXISTS test_run_persona_usage ON test_runs;
CREATE TRIGGER test_run_persona_usage
  AFTER INSERT ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_persona_last_used();

-- Update Test Metrics on Test Run Completion
CREATE OR REPLACE FUNCTION update_test_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle both INSERT and UPDATE
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
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

DROP TRIGGER IF EXISTS test_run_metrics_update ON test_runs;
CREATE TRIGGER test_run_metrics_update
  AFTER INSERT OR UPDATE ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_test_metrics();

-- ============================================================================
-- 7. USAGE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Get or Create Current Usage Period
CREATE OR REPLACE FUNCTION get_or_create_usage_period(p_organization_id UUID)
RETURNS usage_limits AS $$
DECLARE
  current_period usage_limits;
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
BEGIN
  period_start := date_trunc('month', NOW());
  period_end := period_start + INTERVAL '1 month';
  
  SELECT * INTO current_period
  FROM usage_limits
  WHERE organization_id = p_organization_id
    AND period_start = get_or_create_usage_period.period_start;
  
  IF current_period IS NULL THEN
    INSERT INTO usage_limits (
      organization_id,
      period_start,
      period_end,
      credits_per_month,
      max_personas,
      max_editor_seats,
      max_questions_per_survey,
      max_screens_per_test
    )
    SELECT
      p_organization_id,
      period_start,
      period_end,
      st.credits_per_month,
      st.max_personas,
      st.max_editor_seats,
      st.max_questions_per_survey,
      st.max_screens_per_test
    FROM subscriptions s
    JOIN subscription_tiers st ON st.id = s.tier_id
    WHERE s.organization_id = p_organization_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
    ORDER BY s.created_at DESC
    LIMIT 1
    RETURNING * INTO current_period;
    
    IF current_period IS NULL THEN
      INSERT INTO usage_limits (
        organization_id,
        period_start,
        period_end,
        credits_per_month,
        max_personas,
        max_editor_seats,
        max_questions_per_survey,
        max_screens_per_test
      )
      SELECT
        p_organization_id,
        period_start,
        period_end,
        st.credits_per_month,
        st.max_personas,
        st.max_editor_seats,
        st.max_questions_per_survey,
        st.max_screens_per_test
      FROM subscription_tiers st
      WHERE st.tier = 'free'
      RETURNING * INTO current_period;
    END IF;
  END IF;
  
  RETURN current_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check Usage Limits
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
  usage := get_or_create_usage_period(p_organization_id);
  
  CASE p_limit_type
    WHEN 'credits' THEN
      current_count := usage.credits_used;
      max_count := usage.credits_per_month;
    WHEN 'personas' THEN
      current_count := usage.personas_created;
      max_count := usage.max_personas;
    WHEN 'editor_seats' THEN
      current_count := usage.editor_seats_used;
      max_count := usage.max_editor_seats;
    ELSE
      RETURN FALSE;
  END CASE;
  
  IF max_count IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN (current_count + p_increment) <= max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment Usage Counter
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
    WHEN 'credits' THEN
      UPDATE usage_limits
      SET credits_used = credits_used + p_increment
      WHERE id = usage.id;
    WHEN 'personas' THEN
      UPDATE usage_limits
      SET personas_created = personas_created + p_increment
      WHERE id = usage.id;
    WHEN 'editor_seats' THEN
      UPDATE usage_limits
      SET editor_seats_used = editor_seats_used + p_increment
      WHERE id = usage.id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


