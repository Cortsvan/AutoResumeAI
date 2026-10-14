-- ============================================================================
-- AutoResumeAI Database Schema for Supabase
-- Paste this entire script into your Supabase Dashboard:
-- SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  is_unlimited boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 10 CHECK (daily_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Daily AI Usage Table (tracks UTC-based daily quotas per user)
CREATE TABLE IF NOT EXISTS public.daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'UTC'),
  request_count integer NOT NULL DEFAULT 0,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_usage_user_date_unique UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON public.daily_usage(user_id, usage_date);

-- 3. AI Usage Logs Table (fine-grained request log with token & cost tracking)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  request_type text NOT NULL DEFAULT 'chat' CHECK (request_type IN ('chat', 'structure', 'analysis'))
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);

-- 4. Global Budget Tracker (Singleton table for OpenRouter spending guard)
CREATE TABLE IF NOT EXISTS public.global_budget (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_budget_usd numeric(10, 4) NOT NULL DEFAULT 5.0000,
  threshold_usd numeric(10, 4) NOT NULL DEFAULT 4.0000,
  reserved_balance_usd numeric(10, 4) NOT NULL DEFAULT 1.0000,
  total_spent_usd numeric(12, 6) NOT NULL DEFAULT 0.000000,
  reserved_inflight_usd numeric(12, 6) NOT NULL DEFAULT 0.000000,
  is_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed initial singleton budget row if absent
INSERT INTO public.global_budget (id, total_budget_usd, threshold_usd, reserved_balance_usd, total_spent_usd, reserved_inflight_usd, is_paused)
VALUES (1, 5.0000, 4.0000, 1.0000, 0.000000, 0.000000, false)
ON CONFLICT (id) DO NOTHING;

-- 5. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  admin_email text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_email text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- 6. Resumes Table (User cloud resume storage)
CREATE TABLE IF NOT EXISTS public.resumes (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'imported' CHECK (kind IN ('imported', 'created')),
  template text,
  target_job jsonb DEFAULT '{}'::jsonb,
  paragraphs jsonb DEFAULT '[]'::jsonb,
  docx_bytes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id, updated_at DESC);

-- 7. Conversations Table (User cloud chat history)
CREATE TABLE IF NOT EXISTS public.conversations (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- Trigger: Auto-create profile on auth.users registration
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, account_status, is_unlimited, daily_limit)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'user',
    'active',
    false,
    10
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.profiles.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.profiles.last_name),
      updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Non-Recursive Admin Check Helper
-- Used in RLS policies to prevent infinite recursion on public.profiles.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ----------------------------------------------------------------------------
-- Atomic Function: reserve_quota_and_budget
-- Locks budget & profile rows to prevent concurrent limit bypasses.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_quota_and_budget(
  p_user_id uuid,
  p_estimated_cost numeric DEFAULT 0.005
)
RETURNS jsonb AS $$
DECLARE
  v_budget record;
  v_profile record;
  v_today date := (CURRENT_DATE AT TIME ZONE 'UTC');
  v_today_used integer := 0;
BEGIN
  -- 1. Lock and check global budget guard
  SELECT * INTO v_budget FROM public.global_budget WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'BUDGET_GUARD_UNAVAILABLE', 'message', 'Budget tracker is not initialized.');
  END IF;

  IF v_budget.is_paused THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'GLOBAL_BUDGET_EXCEEDED', 'message', 'AI features are temporarily paused by administrator.');
  END IF;

  IF (v_budget.total_spent_usd + v_budget.reserved_inflight_usd + p_estimated_cost) >= v_budget.threshold_usd THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'GLOBAL_BUDGET_EXCEEDED',
      'message', format('Global spending threshold ($%s of $%s budget) reached. AI requests are paused to protect account balance.', v_budget.threshold_usd, v_budget.total_budget_usd)
    );
  END IF;

  -- 2. Lock and check user profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'USER_NOT_FOUND', 'message', 'User account does not exist.');
  END IF;

  IF v_profile.account_status = 'suspended' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ACCOUNT_SUSPENDED', 'message', 'Your account has been suspended by an administrator.');
  END IF;

  -- 3. Check user quota (Bypassed if admin OR is_unlimited)
  IF v_profile.role != 'admin' AND NOT v_profile.is_unlimited THEN
    SELECT request_count INTO v_today_used
    FROM public.daily_usage
    WHERE user_id = p_user_id AND usage_date = v_today;

    v_today_used := COALESCE(v_today_used, 0);

    IF v_today_used >= v_profile.daily_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'QUOTA_EXHAUSTED',
        'limit', v_profile.daily_limit,
        'today_used', v_today_used,
        'message', format('Daily AI request limit reached (%s of %s requests used today). Quota resets at 00:00 UTC.', v_today_used, v_profile.daily_limit)
      );
    END IF;
  END IF;

  -- 4. Atomically reserve in-flight cost
  UPDATE public.global_budget
  SET reserved_inflight_usd = reserved_inflight_usd + p_estimated_cost,
      updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'is_admin', (v_profile.role = 'admin'),
    'is_unlimited', v_profile.is_unlimited,
    'daily_limit', v_profile.daily_limit,
    'today_used', COALESCE(v_today_used, 0),
    'reserved_cost', p_estimated_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- Atomic Function: finalize_ai_usage
-- Records actual tokens, costs, updates daily quota and releases reserved cost.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_ai_usage(
  p_user_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_actual_cost numeric,
  p_reserved_cost numeric,
  p_request_type text DEFAULT 'chat'
)
RETURNS jsonb AS $$
DECLARE
  v_today date := (CURRENT_DATE AT TIME ZONE 'UTC');
  v_total_tokens integer := p_prompt_tokens + p_completion_tokens;
  v_new_daily record;
BEGIN
  -- 1. Update Global Budget: release reservation and add actual spent
  UPDATE public.global_budget
  SET reserved_inflight_usd = GREATEST(0, reserved_inflight_usd - p_reserved_cost),
      total_spent_usd = total_spent_usd + p_actual_cost,
      updated_at = now()
  WHERE id = 1;

  -- 2. Upsert Daily Usage record for today UTC
  INSERT INTO public.daily_usage (
    user_id, usage_date, request_count, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, updated_at
  )
  VALUES (
    p_user_id, v_today, 1, p_prompt_tokens, p_completion_tokens, v_total_tokens, p_actual_cost, now()
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE
  SET request_count = public.daily_usage.request_count + 1,
      prompt_tokens = public.daily_usage.prompt_tokens + EXCLUDED.prompt_tokens,
      completion_tokens = public.daily_usage.completion_tokens + EXCLUDED.completion_tokens,
      total_tokens = public.daily_usage.total_tokens + EXCLUDED.total_tokens,
      estimated_cost_usd = public.daily_usage.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
      updated_at = now()
  RETURNING * INTO v_new_daily;

  -- 3. Log individual request
  INSERT INTO public.ai_usage_logs (
    user_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, request_type
  )
  VALUES (
    p_user_id, p_model, p_prompt_tokens, p_completion_tokens, v_total_tokens, p_actual_cost, p_request_type
  );

  RETURN jsonb_build_object(
    'success', true,
    'today_requests', v_new_daily.request_count,
    'today_cost', v_new_daily.estimated_cost_usd,
    'today_tokens', v_new_daily.total_tokens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- Atomic Function: release_reserved_cost
-- Releases reserved cost if request failed before calling provider.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_reserved_cost(
  p_reserved_cost numeric
)
RETURNS void AS $$
BEGIN
  UPDATE public.global_budget
  SET reserved_inflight_usd = GREATEST(0, reserved_inflight_usd - p_reserved_cost),
      updated_at = now()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- Admin Helper Function: make_admin
-- Promotes a registered user to administrator.
-- Usage in SQL editor: SELECT public.make_admin('your-email@example.com');
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.make_admin(p_email text)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = LOWER(TRIM(p_email));
  IF NOT FOUND THEN
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_email));
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', format('User with email %s not found in registered accounts. Please sign up on the site first.', p_email));
    END IF;

    INSERT INTO public.profiles (id, email, role, is_unlimited)
    VALUES (v_user_id, p_email, 'admin', true)
    ON CONFLICT (id) DO UPDATE SET role = 'admin', is_unlimited = true;
  ELSE
    UPDATE public.profiles
    SET role = 'admin',
        is_unlimited = true,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Audit log entry
  INSERT INTO public.admin_audit_logs (admin_id, admin_email, target_user_id, target_user_email, action, details)
  VALUES (v_user_id, p_email, v_user_id, p_email, 'INITIAL_ADMIN_PROMOTION', jsonb_build_object('via', 'make_admin_sql'));

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'message', format('User %s is now an Administrator with unlimited AI access.', p_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view own profile. Admins can view all profiles and update.
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Daily Usage: Users can view own usage. Admins can view all.
CREATE POLICY "Users can view own daily usage"
  ON public.daily_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all daily usage"
  ON public.daily_usage FOR SELECT
  USING (public.is_admin());

-- AI Usage Logs: Users can view own logs. Admins can view all.
CREATE POLICY "Users can view own AI logs"
  ON public.ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all AI logs"
  ON public.ai_usage_logs FOR SELECT
  USING (public.is_admin());

-- Global Budget: Only admins can view.
CREATE POLICY "Admins can view global budget"
  ON public.global_budget FOR SELECT
  USING (public.is_admin());

-- Admin Audit Logs: Only admins can view.
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_admin());

-- Resumes: Users have full access to their own resumes. Admins cannot read private resumes.
CREATE POLICY "Users can select own resumes"
  ON public.resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON public.resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
  ON public.resumes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON public.resumes FOR DELETE
  USING (auth.uid() = user_id);

-- Conversations: Users have full access to their own conversations.
CREATE POLICY "Users can select own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);
