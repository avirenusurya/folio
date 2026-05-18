-- ============================================================
-- Folio — migration 0015: habits.note column
-- ============================================================
-- Run after 0014_habits.sql.
-- Paste into Supabase SQL Editor → Run. Safe to re-run.
--
-- The new Habits page leans on a short per-habit note ("five lines
-- about the day before lights out") for visual texture in the left
-- column. Optional, up to 200 chars.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS note TEXT
  CHECK (note IS NULL OR LENGTH(note) <= 200);
