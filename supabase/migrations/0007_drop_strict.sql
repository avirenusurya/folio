-- Drop the strict-mode / lockdown feature.
-- Column added in 0001_init.sql; feature scrapped 2026-05-17.

ALTER TABLE public.subjects
  DROP COLUMN IF EXISTS strict;
