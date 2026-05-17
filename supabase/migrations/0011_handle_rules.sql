-- Handle rules:
-- - keep existing short handles working until the user changes them
-- - generate future bootstrap handles at 5+ chars
-- - expose an authenticated availability check that bypasses profile RLS safely

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
  base_handle := LOWER(COALESCE(
    NULLIF(SPLIT_PART(COALESCE(p_email, ''), '@', 1), ''),
    'user_' || SUBSTRING(p_user_id::TEXT, 1, 8)
  ));

  IF LENGTH(base_handle) < 5 THEN
    base_handle := base_handle || '_' || SUBSTRING(REPLACE(p_user_id::TEXT, '-', ''), 1, 4);
  END IF;

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

CREATE OR REPLACE FUNCTION public.enforce_handle_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_new_handle TEXT := LOWER(TRIM(LEADING '@' FROM BTRIM(NEW.handle)));
  v_old_handle TEXT;
BEGIN
  NEW.handle := v_new_handle;

  IF NEW.handle = '' THEN
    RAISE EXCEPTION 'handle required'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_handle := LOWER(TRIM(LEADING '@' FROM BTRIM(OLD.handle)));
  END IF;

  IF TG_OP = 'INSERT' OR NEW.handle IS DISTINCT FROM v_old_handle THEN
    IF LENGTH(NEW.handle) < 5 THEN
      RAISE EXCEPTION 'handle must be at least 5 characters'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_handle_rules ON public.profiles;
CREATE TRIGGER profiles_handle_rules
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_handle_rules();

CREATE OR REPLACE FUNCTION public.is_handle_available(p_handle TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := (SELECT auth.uid());
  v_handle TEXT := LOWER(TRIM(LEADING '@' FROM BTRIM(COALESCE(p_handle, ''))));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be signed in';
  END IF;

  IF LENGTH(v_handle) < 5 THEN
    RETURN FALSE;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.handle = v_handle
      AND p.user_id <> v_caller
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_handle_available(TEXT) TO authenticated;
