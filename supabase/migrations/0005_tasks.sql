-- ============================================================
-- Folio — migration 0005: tasks (per-day TODOs)
-- ============================================================
-- Run after 0004_drop_intent.sql.
-- Paste into Supabase SQL Editor → Run. Safe to re-run.
--
-- Tasks are per-day TODOs anchored to a specific date. They appear on
-- the timer screen (today) and on the calendar heatmap day-drawer (any
-- day, full CRUD). Past days remain editable — the diary is mutable.
-- A separate privacy toggle (profiles.tasks_public) controls whether
-- group members can see them via the day-drawer in Society.

-- ============================================================
-- 1. SCHEMA CHANGES
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tasks_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date   DATE NOT NULL,
  subject_id  UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title       TEXT NOT NULL CHECK (LENGTH(TRIM(title)) > 0 AND LENGTH(title) <= 200),
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  done_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON public.tasks(user_id, task_date DESC);

-- ============================================================
-- 2. TRIGGER: keep updated_at fresh and sync done_at with done
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.done IS DISTINCT FROM OLD.done THEN
    NEW.done_at = CASE WHEN NEW.done THEN NOW() ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_before_update ON public.tasks;
CREATE TRIGGER tasks_before_update
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_task_update();

-- ============================================================
-- 3. ROW LEVEL SECURITY — own data only
-- ============================================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;

CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 4. RPC — read another member's tasks for a single day
-- ============================================================
-- Privacy rules:
--   * Self: always returns own tasks (no checks).
--   * Other: requires share-group AND target.tasks_public = TRUE.
--   * Subject info (name/color) is gated by target.show_subjects to
--     match the existing privacy model — if the target hides subjects,
--     their task subject tags appear as NULL in member view.

CREATE OR REPLACE FUNCTION public.get_member_day_tasks(
  p_target_user_id UUID,
  p_day            DATE
)
RETURNS TABLE (
  id            UUID,
  title         TEXT,
  done          BOOLEAN,
  subject_id    UUID,
  subject_name  TEXT,
  subject_color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller        UUID := (SELECT auth.uid());
  v_share_group   BOOLEAN;
  v_tasks_public  BOOLEAN;
  v_show_subjects BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  -- self-view: bypass privacy checks
  IF v_caller = p_target_user_id THEN
    RETURN QUERY
    SELECT t.id, t.title, t.done, t.subject_id,
           subj.name, subj.color
    FROM public.tasks t
    LEFT JOIN public.subjects subj ON subj.id = t.subject_id
    WHERE t.user_id = p_target_user_id AND t.task_date = p_day
    ORDER BY t.done ASC, t.created_at ASC;
    RETURN;
  END IF;

  -- viewer ≠ target: require shared group
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = v_caller AND gm2.user_id = p_target_user_id
  ) INTO v_share_group;

  IF NOT v_share_group THEN
    RAISE EXCEPTION 'cannot view this user';
  END IF;

  SELECT p.tasks_public, p.show_subjects
  INTO v_tasks_public, v_show_subjects
  FROM public.profiles p WHERE p.user_id = p_target_user_id;

  IF NOT COALESCE(v_tasks_public, FALSE) THEN
    RETURN; -- target keeps tasks private
  END IF;

  RETURN QUERY
  SELECT t.id, t.title, t.done, t.subject_id,
         CASE WHEN COALESCE(v_show_subjects, FALSE) THEN subj.name  ELSE NULL END,
         CASE WHEN COALESCE(v_show_subjects, FALSE) THEN subj.color ELSE NULL END
  FROM public.tasks t
  LEFT JOIN public.subjects subj ON subj.id = t.subject_id
  WHERE t.user_id = p_target_user_id AND t.task_date = p_day
  ORDER BY t.done ASC, t.created_at ASC;
END;
$$;

-- ============================================================
-- 5. GRANTS
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_member_day_tasks(UUID, DATE) TO authenticated;
