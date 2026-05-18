-- Add 'forest', 'rose', 'midnight', 'plum' to the allowed theme values.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('sepia', 'light', 'dark', 'cyan', 'forest', 'rose', 'midnight', 'plum'));
