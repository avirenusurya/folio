-- ============================================================
-- Folio — profile pictures
-- ============================================================
-- Adds profiles.avatar_url and surfaces it from the society RPCs.
-- Also installs RLS policies for the `avatars` storage bucket
-- (create the bucket in the Dashboard first — see steps below the SQL).
-- Safe to re-run.

-- ============================================================
-- 1. avatar_url column
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 2. RPCs — expose avatar_url to the leaderboard + member stats
-- (signature change → DROP + recreate, CREATE OR REPLACE won't do it)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_group_leaderboard(UUID, DATE, DATE);
CREATE OR REPLACE FUNCTION public.get_group_leaderboard(
  p_group_id   UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id        UUID,
  handle         TEXT,
  display_name   TEXT,
  avatar_url     TEXT,
  total_seconds  BIGINT,
  current_streak INT,
  is_you         BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := (SELECT auth.uid());
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;
  IF NOT public.is_group_member(p_group_id, v_caller) THEN
    RAISE EXCEPTION 'not a member of this group';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.handle,
    p.display_name,
    p.avatar_url,
    COALESCE(SUM(s.duration_seconds), 0)::BIGINT AS total_seconds,
    public.compute_current_streak(p.user_id)    AS current_streak,
    (p.user_id = v_caller)                       AS is_you
  FROM public.group_members gm
  JOIN public.profiles p ON p.user_id = gm.user_id
  LEFT JOIN public.sessions s ON s.user_id = gm.user_id
    AND (p_start_date IS NULL OR s.started_at >= p_start_date::TIMESTAMPTZ)
    AND (p_end_date   IS NULL OR s.started_at <  (p_end_date + 1)::TIMESTAMPTZ)
  WHERE gm.group_id = p_group_id
  GROUP BY p.user_id, p.handle, p.display_name, p.avatar_url
  ORDER BY total_seconds DESC, p.handle ASC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_member_stats(UUID);
CREATE OR REPLACE FUNCTION public.get_member_stats(p_target_user_id UUID)
RETURNS TABLE (
  user_id           UUID,
  handle            TEXT,
  display_name      TEXT,
  avatar_url        TEXT,
  member_since      TIMESTAMPTZ,
  total_seconds     BIGINT,
  current_streak    INT,
  longest_seconds   INT,
  best_week_seconds BIGINT,
  show_subjects     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := (SELECT auth.uid());
  v_share_group BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = v_caller AND gm2.user_id = p_target_user_id
  ) INTO v_share_group;

  IF v_caller <> p_target_user_id AND NOT v_share_group THEN
    RAISE EXCEPTION 'cannot view this user';
  END IF;

  RETURN QUERY
  WITH prof AS (
    SELECT * FROM public.profiles p WHERE p.user_id = p_target_user_id
  ),
  totals AS (
    SELECT
      COALESCE(SUM(s.duration_seconds), 0)::BIGINT AS total_seconds,
      MAX(s.duration_seconds)                       AS longest_seconds
    FROM public.sessions s WHERE s.user_id = p_target_user_id
  ),
  weekly AS (
    SELECT
      DATE_TRUNC('week', s.started_at AT TIME ZONE 'UTC') AS week_start,
      SUM(s.duration_seconds)                              AS week_seconds
    FROM public.sessions s WHERE s.user_id = p_target_user_id
    GROUP BY DATE_TRUNC('week', s.started_at AT TIME ZONE 'UTC')
  ),
  best_week AS (
    SELECT COALESCE(MAX(week_seconds), 0)::BIGINT AS best_week_seconds FROM weekly
  )
  SELECT
    prof.user_id,
    prof.handle,
    prof.display_name,
    prof.avatar_url,
    prof.created_at AS member_since,
    totals.total_seconds,
    public.compute_current_streak(prof.user_id) AS current_streak,
    CASE WHEN prof.show_longest   THEN totals.longest_seconds        ELSE NULL END,
    CASE WHEN prof.show_best_week THEN best_week.best_week_seconds   ELSE NULL END,
    prof.show_subjects
  FROM prof, totals, best_week;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_leaderboard(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_stats(UUID)                  TO authenticated;

-- ============================================================
-- 3. Storage RLS — bucket `avatars` (create the bucket in Dashboard first)
-- Convention: object name = "{user_id}/avatar.jpg" so the first path
-- segment is the owner. Public read happens via the bucket's public flag;
-- write/update/delete are gated to the owning user.
-- ============================================================

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;

-- NOTE: use plain `auth.uid()` here, not the `(SELECT auth.uid())` wrapper
-- used in our other policies. Supabase storage's policy evaluator does not
-- reliably resolve the scalar-subquery form, and uploads fail with
-- "new row violates row-level security policy" if you use it.
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
