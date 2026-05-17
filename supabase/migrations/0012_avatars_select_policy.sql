-- ============================================================
-- Folio — avatars: add missing SELECT policy
-- ============================================================
-- The original 0003 migration created INSERT/UPDATE/DELETE policies but
-- forgot SELECT. Uploads use { upsert: true }, which makes the storage
-- client read the existing object first to choose insert vs update.
-- Without a SELECT policy that read is blocked, and the error surfaces
-- as the misleading "new row violates row-level security policy".

DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;

CREATE POLICY "avatars_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
