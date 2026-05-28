-- ============================================================
-- Supabase RLS — app_state table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Grant table access to authenticated users
-- Required: Supabase is removing implicit public schema grants (enforced Oct 30, 2026).
-- Without this, PostgREST / supabase-js cannot access the table after that date.
GRANT SELECT, INSERT, UPDATE, DELETE ON app_state TO authenticated;

-- 2. Enable Row Level Security
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 2. SELECT — user can only read their own row
CREATE POLICY "Users can read own state"
  ON app_state
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. INSERT — user can only insert their own row
CREATE POLICY "Users can insert own state"
  ON app_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. UPDATE — user can only update their own row
CREATE POLICY "Users can update own state"
  ON app_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. DELETE — user can only delete their own row
CREATE POLICY "Users can delete own state"
  ON app_state
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Verify: after running, check that RLS is enabled:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'app_state';
--   → should return: t
--
-- Check policies:
--   SELECT * FROM pg_policies WHERE tablename = 'app_state';
-- ============================================================
