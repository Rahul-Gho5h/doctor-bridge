-- ============================================================
-- Fix: Allow any authenticated user to read their own profile
-- Independent doctors (clinic_id = NULL) were blocked by the
-- "View profiles in own clinic" policy because NULL = NULL is
-- false in SQL, preventing auth from resolving their session.
-- ============================================================

CREATE POLICY "Read own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());
