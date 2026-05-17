-- Drop the ambient-sound feature.
-- Columns added in 0001_init.sql; feature scrapped 2026-05-17.

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS ambient_active,
  DROP COLUMN IF EXISTS ambient_volume,
  DROP COLUMN IF EXISTS ambient_auto_start;
