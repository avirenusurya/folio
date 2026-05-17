-- Add best_month_seconds to get_member_stats so MemberProfileView can show it.
-- Gated by the existing show_best_week privacy toggle (same intent, no new column).
-- Return signature changes, so DROP + CREATE rather than CREATE OR REPLACE.
--
-- Mirrors the 0003 definition exactly (auth check + STABLE + longest_seconds INT)
-- and adds the monthly CTE + new return column.

DROP FUNCTION IF EXISTS public.get_member_stats(UUID);

CREATE FUNCTION public.get_member_stats(p_target_user_id UUID)
RETURNS TABLE (
  user_id            UUID,
  handle             TEXT,
  display_name       TEXT,
  avatar_url         TEXT,
  member_since       TIMESTAMPTZ,
  total_seconds      BIGINT,
  current_streak     INT,
  longest_seconds    INT,
  best_week_seconds  BIGINT,
  best_month_seconds BIGINT,
  show_subjects      BOOLEAN
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
  ),
  monthly AS (
    SELECT
      DATE_TRUNC('month', s.started_at AT TIME ZONE 'UTC') AS month_start,
      SUM(s.duration_seconds)                               AS month_seconds
    FROM public.sessions s WHERE s.user_id = p_target_user_id
    GROUP BY DATE_TRUNC('month', s.started_at AT TIME ZONE 'UTC')
  ),
  best_month AS (
    SELECT COALESCE(MAX(month_seconds), 0)::BIGINT AS best_month_seconds FROM monthly
  )
  SELECT
    prof.user_id,
    prof.handle,
    prof.display_name,
    prof.avatar_url,
    prof.created_at AS member_since,
    totals.total_seconds,
    public.compute_current_streak(prof.user_id) AS current_streak,
    CASE WHEN prof.show_longest   THEN totals.longest_seconds         ELSE NULL END,
    CASE WHEN prof.show_best_week THEN best_week.best_week_seconds    ELSE NULL END,
    CASE WHEN prof.show_best_week THEN best_month.best_month_seconds  ELSE NULL END,
    prof.show_subjects
  FROM prof, totals, best_week, best_month;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_stats(UUID) TO authenticated;
