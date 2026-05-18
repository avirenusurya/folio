-- ============================================================
-- Folio — migration 0014: habits (habit tracker)
-- ============================================================
-- Run after 0013_theme_extras.sql.
-- Paste into Supabase SQL Editor → Run. Safe to re-run.
--
-- Habits are a private daily habit tracker. Each habit is daily-expected;
-- an optional target_per_week flips the streak/insight math to a weekly
-- count. Status per day is 'done' or 'skip' (skip = explicit non-counting
-- placeholder, e.g. rest day). No row = neutral/not-done.
--
-- Privacy: strictly per-user. No cross-user RPCs, no group surface.
-- (Mirrors tasks v1 — `habits_public` can be layered later if needed.)

-- ============================================================
-- 1. SCHEMA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.habits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0 AND LENGTH(name) <= 80),
  color           TEXT NOT NULL DEFAULT '#B85C3C',
  sort_order      INT NOT NULL DEFAULT 0,
  target_per_week INT CHECK (target_per_week IS NULL OR (target_per_week BETWEEN 1 AND 7)),
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits(user_id);

CREATE TABLE IF NOT EXISTS public.habit_entries (
  habit_id    UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('done', 'skip')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (habit_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_date ON public.habit_entries(user_id, entry_date DESC);

-- ============================================================
-- 2. ROW LEVEL SECURITY — own data only
-- ============================================================

ALTER TABLE public.habits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habits_select_own" ON public.habits;
DROP POLICY IF EXISTS "habits_insert_own" ON public.habits;
DROP POLICY IF EXISTS "habits_update_own" ON public.habits;
DROP POLICY IF EXISTS "habits_delete_own" ON public.habits;
CREATE POLICY "habits_select_own" ON public.habits
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "habits_insert_own" ON public.habits
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "habits_update_own" ON public.habits
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "habits_delete_own" ON public.habits
  FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "habit_entries_select_own" ON public.habit_entries;
DROP POLICY IF EXISTS "habit_entries_insert_own" ON public.habit_entries;
DROP POLICY IF EXISTS "habit_entries_update_own" ON public.habit_entries;
DROP POLICY IF EXISTS "habit_entries_delete_own" ON public.habit_entries;
CREATE POLICY "habit_entries_select_own" ON public.habit_entries
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "habit_entries_insert_own" ON public.habit_entries
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "habit_entries_update_own" ON public.habit_entries
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "habit_entries_delete_own" ON public.habit_entries
  FOR DELETE USING (user_id = (SELECT auth.uid()));
