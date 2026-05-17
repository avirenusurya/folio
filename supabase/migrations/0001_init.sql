-- ============================================================
-- Folio — initial schema
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS throughout.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- profiles: one row per user, mirrors auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'sepia' CHECK (theme IN ('sepia', 'light', 'dark')),
  show_subjects BOOLEAN NOT NULL DEFAULT FALSE,
  show_longest BOOLEAN NOT NULL DEFAULT TRUE,
  show_best_week BOOLEAN NOT NULL DEFAULT TRUE,
  appear_in_currently_studying BOOLEAN NOT NULL DEFAULT TRUE,
  editor_notes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  study_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  daily_goal_seconds INT NOT NULL DEFAULT 12600,   -- 3.5h
  weekly_goal_seconds INT NOT NULL DEFAULT 88200,  -- 24.5h
  streak_freezes_available INT NOT NULL DEFAULT 2,
  weekly_goal_mode BOOLEAN NOT NULL DEFAULT FALSE,

  pomodoro_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pomodoro_work_min INT NOT NULL DEFAULT 25,
  pomodoro_short_break_min INT NOT NULL DEFAULT 5,
  pomodoro_long_break_min INT NOT NULL DEFAULT 15,
  pomodoro_cycles_before_long INT NOT NULL DEFAULT 4,

  ambient_active TEXT NOT NULL DEFAULT 'library',
  ambient_volume NUMERIC NOT NULL DEFAULT 0.5,
  ambient_auto_start BOOLEAN NOT NULL DEFAULT FALSE,

  -- last_active_subject_id is set by the bootstrap function after subjects are created
  last_active_subject_id UUID,

  -- in-progress timer state (null when no session is running)
  current_session JSONB,

  -- null until user finishes the onboarding tour (used later for the demo overlay)
  onboarded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  strict TEXT NOT NULL DEFAULT 'off' CHECK (strict IN ('off', 'gentle', 'lockdown')),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON public.subjects(user_id);

-- Wire profiles.last_active_subject_id FK now that subjects exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_last_active_subject_fk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_last_active_subject_fk
      FOREIGN KEY (last_active_subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- sessions (completed study sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_seconds INT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'stopwatch',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON public.sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON public.sessions(subject_id);

-- d_days (countdown events)
CREATE TABLE IF NOT EXISTS public.d_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'cap' CHECK (icon IN ('cap', 'book', 'doc')),
  target DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ddays_user ON public.d_days(user_id);

-- journal_entries (one per user per date)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON public.journal_entries(user_id, entry_date DESC);

-- editor_notes (one per user per week)
CREATE TABLE IF NOT EXISTS public.editor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_editor_notes_user_week ON public.editor_notes(user_id, week_start DESC);

-- ============================================================
-- 2. updated_at auto-bump trigger (shared)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. ROW LEVEL SECURITY — every user sees only their own rows
-- ============================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.d_days           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_notes     ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- subjects
DROP POLICY IF EXISTS "subjects_select_own" ON public.subjects;
DROP POLICY IF EXISTS "subjects_insert_own" ON public.subjects;
DROP POLICY IF EXISTS "subjects_update_own" ON public.subjects;
DROP POLICY IF EXISTS "subjects_delete_own" ON public.subjects;
CREATE POLICY "subjects_select_own" ON public.subjects
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "subjects_insert_own" ON public.subjects
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "subjects_update_own" ON public.subjects
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "subjects_delete_own" ON public.subjects
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- sessions
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
CREATE POLICY "sessions_select_own" ON public.sessions
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "sessions_insert_own" ON public.sessions
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "sessions_update_own" ON public.sessions
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "sessions_delete_own" ON public.sessions
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- d_days
DROP POLICY IF EXISTS "ddays_select_own" ON public.d_days;
DROP POLICY IF EXISTS "ddays_insert_own" ON public.d_days;
DROP POLICY IF EXISTS "ddays_update_own" ON public.d_days;
DROP POLICY IF EXISTS "ddays_delete_own" ON public.d_days;
CREATE POLICY "ddays_select_own" ON public.d_days
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "ddays_insert_own" ON public.d_days
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "ddays_update_own" ON public.d_days
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "ddays_delete_own" ON public.d_days
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- journal_entries
DROP POLICY IF EXISTS "journal_select_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_insert_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_update_own" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_delete_own" ON public.journal_entries;
CREATE POLICY "journal_select_own" ON public.journal_entries
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "journal_insert_own" ON public.journal_entries
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "journal_update_own" ON public.journal_entries
  FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "journal_delete_own" ON public.journal_entries
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- editor_notes (typically writes come from server-side Edge Function, but allow user reads + clears)
DROP POLICY IF EXISTS "editor_select_own" ON public.editor_notes;
DROP POLICY IF EXISTS "editor_delete_own" ON public.editor_notes;
CREATE POLICY "editor_select_own" ON public.editor_notes
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "editor_delete_own" ON public.editor_notes
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 4. BOOTSTRAP — auto-create profile + default subjects on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.bootstrap_user(p_user_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  i INT := 0;
  chem_id UUID;
BEGIN
  -- Build a unique handle: email-prefix, falling back to user_<id-prefix>.
  base_handle := COALESCE(
    NULLIF(SPLIT_PART(COALESCE(p_email, ''), '@', 1), ''),
    'user_' || SUBSTRING(p_user_id::TEXT, 1, 8)
  );
  final_handle := base_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    i := i + 1;
    final_handle := base_handle || i::TEXT;
  END LOOP;

  INSERT INTO public.profiles (user_id, handle)
  VALUES (p_user_id, final_handle);

  -- Seed default subjects so the timer screen has something useful out of the gate.
  INSERT INTO public.subjects (user_id, name, color, strict)
  VALUES (p_user_id, 'organic chemistry', '#B85C3C', 'lockdown')
  RETURNING id INTO chem_id;

  INSERT INTO public.subjects (user_id, name, color, strict) VALUES
    (p_user_id, 'calculus',          '#C19A3F', 'gentle'),
    (p_user_id, 'molecular biology', '#B07A6E', 'off'),
    (p_user_id, 'literature',        '#8B9A82', 'off');

  UPDATE public.profiles SET last_active_subject_id = chem_id WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.bootstrap_user(NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. BACKFILL — bootstrap any existing auth.users that don't yet have a profile
-- (covers users created before this migration ran, e.g. the dev's own account)
-- ============================================================

DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.user_id IS NULL
  LOOP
    PERFORM public.bootstrap_user(u.id, u.email);
  END LOOP;
END $$;
