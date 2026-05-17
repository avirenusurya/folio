-- ============================================================
-- Folio — migration 0002: society (groups, members, leaderboard RPCs)
-- ============================================================
-- Run after 0001_init.sql.
-- Paste into Supabase SQL Editor → Run. Safe to re-run.

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_groups_invite ON public.groups(invite_code);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);

-- ============================================================
-- 2. HELPER FUNCTIONS (used in RLS policies)
-- ============================================================
-- SECURITY DEFINER so they bypass RLS internally — avoids recursive policy checks
-- when group_members policies themselves query group_members.

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'owner'
  );
$$;

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- groups
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_self"   ON public.groups;
DROP POLICY IF EXISTS "groups_update_owner"  ON public.groups;
DROP POLICY IF EXISTS "groups_delete_owner"  ON public.groups;

CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT USING (public.is_group_member(id, (SELECT auth.uid())));

CREATE POLICY "groups_insert_self" ON public.groups
  FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE USING (public.is_group_owner(id, (SELECT auth.uid())))
  WITH CHECK (public.is_group_owner(id, (SELECT auth.uid())));

CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (public.is_group_owner(id, (SELECT auth.uid())));

-- group_members
DROP POLICY IF EXISTS "group_members_select_same_group"   ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_self"         ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete_self_or_owner" ON public.group_members;

CREATE POLICY "group_members_select_same_group" ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id, (SELECT auth.uid())));

CREATE POLICY "group_members_insert_self" ON public.group_members
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "group_members_delete_self_or_owner" ON public.group_members
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
    OR public.is_group_owner(group_id, (SELECT auth.uid()))
  );

-- ============================================================
-- 4. OWNERSHIP-TRANSFER TRIGGER
-- ============================================================
-- When the owner is removed (leaves, kicked, or auth user deleted),
-- promote the oldest remaining member; if none, delete the group.

CREATE OR REPLACE FUNCTION public.handle_member_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next_owner UUID;
BEGIN
  IF OLD.role = 'owner' THEN
    SELECT user_id INTO v_next_owner
    FROM public.group_members
    WHERE group_id = OLD.group_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.group_members
      SET role = 'owner'
      WHERE group_id = OLD.group_id AND user_id = v_next_owner;
    ELSE
      DELETE FROM public.groups WHERE id = OLD.group_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS group_members_owner_transfer ON public.group_members;
CREATE TRIGGER group_members_owner_transfer
AFTER DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.handle_member_removed();

-- ============================================================
-- 5. STREAK + INVITE-CODE HELPERS
-- ============================================================

-- Current streak: walks back day-by-day from today (or yesterday if today is empty).
CREATE OR REPLACE FUNCTION public.compute_current_streak(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_streak INT := 0;
  v_check  DATE := CURRENT_DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE user_id = p_user_id AND DATE(started_at AT TIME ZONE 'UTC') = v_check
  ) THEN
    v_check := v_check - 1;
  END IF;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.sessions
      WHERE user_id = p_user_id AND DATE(started_at AT TIME ZONE 'UTC') = v_check
    );
    v_streak := v_streak + 1;
    v_check  := v_check - 1;
    EXIT WHEN v_streak >= 365;
  END LOOP;

  RETURN v_streak;
END;
$$;

-- 6-char invite code; charset avoids 0/O/1/I/L for readability.
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chars   TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code    TEXT;
  v_attempt INT  := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || SUBSTRING(v_chars FROM 1 + FLOOR(RANDOM() * LENGTH(v_chars))::INT FOR 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = v_code);
    v_attempt := v_attempt + 1;
    IF v_attempt > 10 THEN
      RAISE EXCEPTION 'could not generate unique invite code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ============================================================
-- 6. RPC FUNCTIONS (called from the client via supabase.rpc())
-- ============================================================

-- create_group: caller becomes owner. Returns the new group.
CREATE OR REPLACE FUNCTION public.create_group(p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user  UUID := (SELECT auth.uid());
  v_group public.groups;
  v_invite TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    RAISE EXCEPTION 'group name is required';
  END IF;
  IF LENGTH(p_name) > 80 THEN
    RAISE EXCEPTION 'group name must be 80 characters or fewer';
  END IF;

  v_invite := public.gen_invite_code();

  INSERT INTO public.groups (name, description, created_by, invite_code)
  VALUES (TRIM(p_name), NULLIF(TRIM(p_description), ''), v_user, v_invite)
  RETURNING * INTO v_group;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group.id, v_user, 'owner');

  RETURN v_group;
END;
$$;

-- join_group: idempotent — joining an already-joined group returns the group.
CREATE OR REPLACE FUNCTION public.join_group(p_invite_code TEXT)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user  UUID := (SELECT auth.uid());
  v_group public.groups;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;
  IF p_invite_code IS NULL OR LENGTH(TRIM(p_invite_code)) = 0 THEN
    RAISE EXCEPTION 'invite code is required';
  END IF;

  SELECT * INTO v_group
  FROM public.groups
  WHERE invite_code = UPPER(TRIM(p_invite_code));

  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'invalid invite code';
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group.id, v_user, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN v_group;
END;
$$;

-- leave_group: deletes caller's membership. The owner-transfer trigger handles
-- promotion / group deletion automatically.
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id AND user_id = v_user;
END;
$$;

-- get_group_leaderboard: aggregated hours per member, ordered desc.
-- p_start_date / p_end_date are inclusive; pass NULL for all-time.
CREATE OR REPLACE FUNCTION public.get_group_leaderboard(
  p_group_id   UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date   DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id        UUID,
  handle         TEXT,
  display_name   TEXT,
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
    COALESCE(SUM(s.duration_seconds), 0)::BIGINT AS total_seconds,
    public.compute_current_streak(p.user_id)    AS current_streak,
    (p.user_id = v_caller)                       AS is_you
  FROM public.group_members gm
  JOIN public.profiles p ON p.user_id = gm.user_id
  LEFT JOIN public.sessions s ON s.user_id = gm.user_id
    AND (p_start_date IS NULL OR s.started_at >= p_start_date::TIMESTAMPTZ)
    AND (p_end_date   IS NULL OR s.started_at <  (p_end_date + 1)::TIMESTAMPTZ)
  WHERE gm.group_id = p_group_id
  GROUP BY p.user_id, p.handle, p.display_name
  ORDER BY total_seconds DESC, p.handle ASC;
END;
$$;

-- get_member_stats: respects show_longest / show_best_week privacy toggles.
-- Returns NULL for hidden fields. Self is always visible to self.
CREATE OR REPLACE FUNCTION public.get_member_stats(p_target_user_id UUID)
RETURNS TABLE (
  user_id           UUID,
  handle            TEXT,
  display_name      TEXT,
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
    prof.created_at AS member_since,
    totals.total_seconds,
    public.compute_current_streak(prof.user_id) AS current_streak,
    CASE WHEN prof.show_longest   THEN totals.longest_seconds        ELSE NULL END,
    CASE WHEN prof.show_best_week THEN best_week.best_week_seconds   ELSE NULL END,
    prof.show_subjects
  FROM prof, totals, best_week;
END;
$$;

-- get_member_heatmap: daily session totals for the last N weeks.
CREATE OR REPLACE FUNCTION public.get_member_heatmap(
  p_target_user_id UUID,
  p_weeks          INT DEFAULT 14
)
RETURNS TABLE (
  day           DATE,
  total_seconds BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller      UUID := (SELECT auth.uid());
  v_share_group BOOLEAN;
  v_since       DATE;
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

  v_since := CURRENT_DATE - (p_weeks * 7);

  RETURN QUERY
  SELECT
    DATE(s.started_at AT TIME ZONE 'UTC')      AS day,
    SUM(s.duration_seconds)::BIGINT            AS total_seconds
  FROM public.sessions s
  WHERE s.user_id = p_target_user_id
    AND DATE(s.started_at AT TIME ZONE 'UTC') >= v_since
  GROUP BY DATE(s.started_at AT TIME ZONE 'UTC')
  ORDER BY day ASC;
END;
$$;

-- get_member_subjects: per-subject totals. Respects show_subjects privacy flag
-- (returns empty when viewer != target and target hid subjects). Self always
-- sees own subjects.
CREATE OR REPLACE FUNCTION public.get_member_subjects(p_target_user_id UUID)
RETURNS TABLE (
  subject_id    UUID,
  name          TEXT,
  color         TEXT,
  total_seconds BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller        UUID := (SELECT auth.uid());
  v_share_group   BOOLEAN;
  v_show_subjects BOOLEAN;
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

  SELECT p.show_subjects INTO v_show_subjects
  FROM public.profiles p WHERE p.user_id = p_target_user_id;

  IF v_caller <> p_target_user_id AND NOT COALESCE(v_show_subjects, FALSE) THEN
    RETURN; -- target hid their subject breakdown
  END IF;

  RETURN QUERY
  SELECT
    subj.id   AS subject_id,
    subj.name AS name,
    subj.color AS color,
    COALESCE(SUM(s.duration_seconds), 0)::BIGINT AS total_seconds
  FROM public.subjects subj
  LEFT JOIN public.sessions s
    ON s.subject_id = subj.id AND s.user_id = p_target_user_id
  WHERE subj.user_id = p_target_user_id
    AND subj.deleted = FALSE
  GROUP BY subj.id, subj.name, subj.color
  ORDER BY total_seconds DESC, subj.name ASC;
END;
$$;

-- get_member_day_detail: per-subject totals for a single day. Same privacy
-- rules as get_member_subjects (returns empty when viewer != target and
-- target hid their subject breakdown).
CREATE OR REPLACE FUNCTION public.get_member_day_detail(
  p_target_user_id UUID,
  p_day            DATE
)
RETURNS TABLE (
  subject_id    UUID,
  name          TEXT,
  color         TEXT,
  total_seconds BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller        UUID := (SELECT auth.uid());
  v_share_group   BOOLEAN;
  v_show_subjects BOOLEAN;
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

  SELECT p.show_subjects INTO v_show_subjects
  FROM public.profiles p WHERE p.user_id = p_target_user_id;

  IF v_caller <> p_target_user_id AND NOT COALESCE(v_show_subjects, FALSE) THEN
    RETURN; -- target hid their subject breakdown
  END IF;

  RETURN QUERY
  SELECT
    subj.id    AS subject_id,
    subj.name  AS name,
    subj.color AS color,
    COALESCE(SUM(s.duration_seconds), 0)::BIGINT AS total_seconds
  FROM public.subjects subj
  LEFT JOIN public.sessions s
    ON s.subject_id = subj.id
   AND s.user_id    = p_target_user_id
   AND DATE(s.started_at AT TIME ZONE 'UTC') = p_day
  WHERE subj.user_id = p_target_user_id
    AND subj.deleted = FALSE
  GROUP BY subj.id, subj.name, subj.color
  HAVING COALESCE(SUM(s.duration_seconds), 0) > 0
  ORDER BY total_seconds DESC, subj.name ASC;
END;
$$;

-- ============================================================
-- 7. GRANTS — allow signed-in users to call the RPCs
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(UUID, UUID)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, TEXT)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group(TEXT)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group(UUID)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_leaderboard(UUID, DATE, DATE)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_stats(UUID)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_heatmap(UUID, INT)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_subjects(UUID)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_day_detail(UUID, DATE)                  TO authenticated;
