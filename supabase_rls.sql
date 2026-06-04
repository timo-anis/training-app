-- Timo Training App — Supabase schema: RLS policies, triggers, functions
-- Exported: 2026-06-04
-- Project: krpbqzhttgelrbhkohct (eu-west-1)
--
-- Use this file to recreate the security layer if the Supabase project is ever rebuilt.
-- Run against a fresh project AFTER creating the tables (app_state, app_state_history, profiles).

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- app_state: authenticated users can only access their own row
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_manage_own_app_state"
  ON public.app_state
  FOR ALL
  TO authenticated
  USING      ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- app_state_history: users can read their own history (written only by trigger)
ALTER TABLE public.app_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own history read"
  ON public.app_state_history
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- profiles: users can select/insert/update only their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- app_errors: users can only insert their own errors (no client-side read needed)
CREATE TABLE IF NOT EXISTS public.app_errors (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  message     text,
  stack       text,
  url         text,
  app_version text
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_insert_own_errors"
  ON public.app_errors
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile + empty app_state row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.app_state (user_id, state_json)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Auto-update updated_at timestamp on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Snapshot previous app_state into history before update/delete
-- Enables point-in-time restore of training data
CREATE OR REPLACE FUNCTION public.snapshot_app_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if (tg_op = 'DELETE') then
    insert into public.app_state_history (user_id, state_json, reason)
    values (old.user_id, old.state_json, 'delete');
    return old;
  else
    -- only snapshot when the stored state actually changes
    if (new.state_json is distinct from old.state_json) then
      insert into public.app_state_history (user_id, state_json, reason)
      values (old.user_id, old.state_json, 'update');
    end if;
    return new;
  end if;
end;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-set updated_at on app_state changes
CREATE TRIGGER set_app_state_updated_at
  BEFORE UPDATE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snapshot app_state before update or delete (version history)
CREATE TRIGGER trg_snapshot_app_state
  BEFORE UPDATE OR DELETE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_app_state();

-- Create profile + app_state row when a new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
