-- ============================================================
-- Platform Admin Support Migration
-- Fixes all gaps required for the super_admin platform panel.
--
-- Summary of changes:
--  1.  hospital_doctor_links  — new table (FKs intact for Supabase joins)
--  2.  clinics metadata cols  — verification_status, entity_type, platform_id,
--                               gst_number, registration_number
--  3.  Super-admin RLS bypass — read-all policies on 7 tables
--  4.  notifications.clinic_id — make nullable (cross-clinic referral notifs)
--  5.  referrals.reason alias  — generated column mirroring referral_reason
--  6.  Updated RPCs            — accept_affiliation_request,
--                               detach_doctor_from_hospital now sync
--                               hospital_doctor_links
--  7.  Performance indexes     — originating_clinic_id, created_at, status
-- ============================================================


-- ============================================================
-- 1. hospital_doctor_links
--    Tracks the CURRENT active hospital–doctor relationship.
--    Populated by accept_affiliation_request; deactivated by detach.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hospital_doctor_links (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_clinic_id UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_user_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  status             TEXT        NOT NULL DEFAULT 'ACTIVE'
                                 CHECK (status IN ('ACTIVE', 'INACTIVE')),
  joined_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_clinic_id, doctor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_hdl_hospital ON public.hospital_doctor_links(hospital_clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_hdl_doctor   ON public.hospital_doctor_links(doctor_user_id, status);

CREATE TRIGGER trg_hdl_updated
  BEFORE UPDATE ON public.hospital_doctor_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.hospital_doctor_links ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read active links (same scope as doctor_profiles)
CREATE POLICY "Authenticated view hospital links"
  ON public.hospital_doctor_links FOR SELECT
  TO authenticated USING (true);

-- Only the doctor or the hospital admin can modify their own link
CREATE POLICY "Doctor or hospital admin manages own link"
  ON public.hospital_doctor_links FOR ALL
  USING (
    doctor_user_id = auth.uid()
    OR (
      hospital_clinic_id = public.current_clinic_id()
      AND public.is_clinic_admin()
    )
  );

-- Backfill: every doctor currently attached to a clinic gets an ACTIVE row
INSERT INTO public.hospital_doctor_links
  (hospital_clinic_id, doctor_user_id, status, joined_at)
SELECT
  dp.clinic_id,
  dp.user_id,
  'ACTIVE',
  COALESCE(dp.joined_hospital_at, dp.created_at)
FROM public.doctor_profiles dp
WHERE dp.clinic_id IS NOT NULL
ON CONFLICT (hospital_clinic_id, doctor_user_id) DO NOTHING;


-- ============================================================
-- 2. clinics — metadata columns
-- ============================================================

-- verification_status: replaces the boolean is_active for platform workflow
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics'
      AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE public.clinics
      ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (verification_status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'));
  END IF;
END $$;

-- entity_type: Hospital, Clinic, Nursing Home, Diagnostic Centre, etc.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics'
      AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.clinics ADD COLUMN entity_type TEXT DEFAULT 'Clinic';
  END IF;
END $$;

-- platform_id: human-readable unique ID shown in the admin panel (e.g. DB-4A8F2E)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics'
      AND column_name = 'platform_id'
  ) THEN
    ALTER TABLE public.clinics ADD COLUMN platform_id TEXT UNIQUE;
  END IF;
END $$;

-- gst_number: GST registration number
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics'
      AND column_name = 'gst_number'
  ) THEN
    ALTER TABLE public.clinics ADD COLUMN gst_number TEXT;
  END IF;
END $$;

-- registration_number: MCI / state council registration number
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clinics'
      AND column_name = 'registration_number'
  ) THEN
    ALTER TABLE public.clinics ADD COLUMN registration_number TEXT;
  END IF;
END $$;

-- Backfill platform_id for all existing clinics that don't have one
UPDATE public.clinics
SET platform_id = 'DB-' || UPPER(SUBSTR(REPLACE(id::TEXT, '-', ''), 1, 6))
WHERE platform_id IS NULL;

-- Backfill verification_status: active clinics (is_active = true) → ACTIVE
UPDATE public.clinics
SET verification_status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END
WHERE verification_status = 'ACTIVE' AND is_active = false;

-- Index for the most common platform filter
CREATE INDEX IF NOT EXISTS idx_clinics_verification ON public.clinics(verification_status);
CREATE INDEX IF NOT EXISTS idx_clinics_created ON public.clinics(created_at DESC);


-- ============================================================
-- 3. Super-admin RLS bypass
--    super_admin needs to read ALL rows across every table the
--    platform panel queries. Each policy is idempotent (DO block).
-- ============================================================

-- clinics
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinics' AND policyname = 'Super admin read all clinics') THEN
    CREATE POLICY "Super admin read all clinics" ON public.clinics
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinics' AND policyname = 'Super admin write all clinics') THEN
    CREATE POLICY "Super admin write all clinics" ON public.clinics
      FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Super admin read all profiles') THEN
    CREATE POLICY "Super admin read all profiles" ON public.profiles
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- user_roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Super admin read all user roles') THEN
    CREATE POLICY "Super admin read all user roles" ON public.user_roles
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- doctor_profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctor_profiles' AND policyname = 'Super admin read all doctor profiles') THEN
    CREATE POLICY "Super admin read all doctor profiles" ON public.doctor_profiles
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctor_profiles' AND policyname = 'Super admin write all doctor profiles') THEN
    CREATE POLICY "Super admin write all doctor profiles" ON public.doctor_profiles
      FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- referrals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Super admin read all referrals') THEN
    CREATE POLICY "Super admin read all referrals" ON public.referrals
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- affiliation_requests
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'affiliation_requests' AND policyname = 'Super admin read all affiliation requests') THEN
    CREATE POLICY "Super admin read all affiliation requests" ON public.affiliation_requests
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- hospital_doctor_links (already covered by the AUTHENTICATED policy above,
--  but add an explicit super_admin ALL policy for completeness)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hospital_doctor_links' AND policyname = 'Super admin manage all links') THEN
    CREATE POLICY "Super admin manage all links" ON public.hospital_doctor_links
      FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;

-- notifications — super_admin needs to read platform-level notifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Super admin read all notifications') THEN
    CREATE POLICY "Super admin read all notifications" ON public.notifications
      FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;


-- ============================================================
-- 4. notifications.clinic_id — make nullable
--    Cross-clinic referral notifications have no single clinic_id.
-- ============================================================

ALTER TABLE public.notifications
  ALTER COLUMN clinic_id DROP NOT NULL;


-- ============================================================
-- 5. referrals.reason — generated alias for referral_reason
--    The platform reports code selects `reason`; the column
--    is named referral_reason. This generated column bridges that.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals'
      AND column_name = 'reason'
  ) THEN
    ALTER TABLE public.referrals
      ADD COLUMN reason TEXT GENERATED ALWAYS AS (referral_reason) STORED;
  END IF;
END $$;


-- ============================================================
-- 6. Updated RPCs — keep hospital_doctor_links in sync
-- ============================================================

-- accept_affiliation_request: also upserts into hospital_doctor_links
CREATE OR REPLACE FUNCTION public.accept_affiliation_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req               public.affiliation_requests%ROWTYPE;
  is_doctor         boolean;
  is_hospital_admin boolean;
BEGIN
  SELECT * INTO req FROM public.affiliation_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL   THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'PENDING' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  is_doctor         := (req.doctor_user_id = auth.uid());
  is_hospital_admin := (req.hospital_clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

  IF req.initiated_by = 'HOSPITAL' AND NOT is_doctor THEN
    RAISE EXCEPTION 'Only the doctor can accept a hospital-initiated request';
  END IF;
  IF req.initiated_by = 'DOCTOR' AND NOT is_hospital_admin THEN
    RAISE EXCEPTION 'Only the hospital admin can accept a doctor-initiated request';
  END IF;

  -- Deactivate any existing hospital link for this doctor
  UPDATE public.hospital_doctor_links
    SET status = 'INACTIVE', updated_at = now()
  WHERE doctor_user_id = req.doctor_user_id AND status = 'ACTIVE';

  -- Update doctor's clinic assignment
  UPDATE public.doctor_profiles
    SET clinic_id = req.hospital_clinic_id,
        joined_hospital_at = now(),
        updated_at = now()
  WHERE id = req.doctor_profile_id;

  UPDATE public.profiles
    SET clinic_id = req.hospital_clinic_id,
        updated_at = now()
  WHERE id = req.doctor_user_id;

  -- Ensure doctor role exists at this hospital
  INSERT INTO public.user_roles (user_id, clinic_id, role)
    VALUES (req.doctor_user_id, req.hospital_clinic_id, 'doctor')
    ON CONFLICT DO NOTHING;

  -- Mark the request accepted
  UPDATE public.affiliation_requests
    SET status = 'ACCEPTED', decided_at = now(), decided_by_user_id = auth.uid()
  WHERE id = _request_id;

  -- Cancel any other pending requests from this doctor
  UPDATE public.affiliation_requests
    SET status = 'CANCELLED', decided_at = now()
  WHERE doctor_user_id = req.doctor_user_id
    AND id <> _request_id
    AND status = 'PENDING';

  -- Upsert the new active link
  INSERT INTO public.hospital_doctor_links
    (hospital_clinic_id, doctor_user_id, status, joined_at)
  VALUES
    (req.hospital_clinic_id, req.doctor_user_id, 'ACTIVE', now())
  ON CONFLICT (hospital_clinic_id, doctor_user_id)
  DO UPDATE SET
    status     = 'ACTIVE',
    joined_at  = EXCLUDED.joined_at,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_affiliation_request(uuid) TO authenticated;


-- detach_doctor_from_hospital: also deactivates the link row
CREATE OR REPLACE FUNCTION public.detach_doctor_from_hospital(_doctor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hospital  uuid;
  is_self           boolean;
  is_admin          boolean;
BEGIN
  SELECT clinic_id INTO current_hospital FROM public.profiles WHERE id = _doctor_user_id;
  IF current_hospital IS NULL THEN
    RAISE EXCEPTION 'Doctor is not attached to any hospital';
  END IF;

  is_self  := (_doctor_user_id = auth.uid());
  is_admin := (current_hospital = public.current_clinic_id() AND public.is_clinic_admin());

  IF NOT (is_self OR is_admin) THEN
    RAISE EXCEPTION 'Not authorized to detach this doctor';
  END IF;

  -- Deactivate the link
  UPDATE public.hospital_doctor_links
    SET status = 'INACTIVE', updated_at = now()
  WHERE doctor_user_id = _doctor_user_id AND status = 'ACTIVE';

  -- Detach from profiles and doctor_profiles
  UPDATE public.profiles
    SET clinic_id = NULL, updated_at = now()
  WHERE id = _doctor_user_id;

  UPDATE public.doctor_profiles
    SET clinic_id = NULL, joined_hospital_at = NULL, updated_at = now()
  WHERE user_id = _doctor_user_id;

  -- Remove the doctor role at that hospital
  DELETE FROM public.user_roles
  WHERE user_id = _doctor_user_id AND clinic_id = current_hospital AND role = 'doctor';
END;
$$;

GRANT EXECUTE ON FUNCTION public.detach_doctor_from_hospital(uuid) TO authenticated;


-- ============================================================
-- 7. Performance indexes
--    All queries made by platform analytics and reports pages.
-- ============================================================

-- referrals: the two most common filters in platform analytics
CREATE INDEX IF NOT EXISTS idx_referrals_originating
  ON public.referrals(originating_clinic_id);

CREATE INDEX IF NOT EXISTS idx_referrals_created
  ON public.referrals(created_at DESC);

-- composite for date-range + status filter (reports page)
CREATE INDEX IF NOT EXISTS idx_referrals_status_created
  ON public.referrals(status, created_at DESC);

-- composite for urgency analytics
CREATE INDEX IF NOT EXISTS idx_referrals_urgency_created
  ON public.referrals(urgency, created_at DESC);

-- doctor_profiles: verified count query
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_verified
  ON public.doctor_profiles(nmc_verified)
  WHERE nmc_verified = true;

-- doctor_profiles: inactive doctors query
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_inactive
  ON public.doctor_profiles(accepting_referrals, is_public)
  WHERE accepting_referrals = false OR is_public = false;

-- affiliation_requests: status filter used in many joins
CREATE INDEX IF NOT EXISTS idx_affreq_status
  ON public.affiliation_requests(status, created_at DESC);
