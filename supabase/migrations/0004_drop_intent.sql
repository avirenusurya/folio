-- ============================================================
-- Folio — drop the intent-prompt feature
-- ============================================================
-- Run in Supabase SQL Editor.
-- Removes the pre-session "what will you work on?" prompt entirely:
--   - profiles.intent_prompt_enabled (the user toggle)
--   - sessions.intent (the captured answer, never displayed anywhere)
-- The feature is being replaced by a proper Tasks section (see 0005_tasks.sql).

ALTER TABLE public.profiles DROP COLUMN IF EXISTS intent_prompt_enabled;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS intent;
