-- Add user-defined ordering for subjects (drag-to-reorder in Settings).
-- Also fixes bootstrap_user, which still inserted the now-dropped `strict` column (broken since 0007_drop_strict.sql).

-- 1. Add the column. Default 0 so existing rows aren't NULL; we backfill below.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 2. Backfill: per user, number rows by created_at (oldest = 0).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS rn
  FROM public.subjects
)
UPDATE public.subjects s
SET sort_order = ordered.rn
FROM ordered
WHERE s.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_subjects_user_sort ON public.subjects(user_id, sort_order);

-- 3. Rewrite bootstrap_user: drop `strict`, set sort_order on seed subjects.
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

  INSERT INTO public.subjects (user_id, name, color, sort_order)
  VALUES (p_user_id, 'organic chemistry', '#B85C3C', 0)
  RETURNING id INTO chem_id;

  INSERT INTO public.subjects (user_id, name, color, sort_order) VALUES
    (p_user_id, 'calculus',          '#C19A3F', 1),
    (p_user_id, 'molecular biology', '#B07A6E', 2),
    (p_user_id, 'literature',        '#8B9A82', 3);

  UPDATE public.profiles SET last_active_subject_id = chem_id WHERE user_id = p_user_id;
END;
$$;
