-- ============================================================
-- Hospital Admin Features: remove_affiliation RPC + helper policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure affiliation_requests table has all needed columns
--    (table created in earlier migration; add columns if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'affiliation_requests' AND column_name = 'removal_reason') THEN
    ALTER TABLE public.affiliation_requests ADD COLUMN removal_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'affiliation_requests' AND column_name = 'removed_at') THEN
    ALTER TABLE public.affiliation_requests ADD COLUMN removed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'affiliation_requests' AND column_name = 'removed_by') THEN
    ALTER TABLE public.affiliation_requests ADD COLUMN removed_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- 2. RPC: remove_affiliation
--    Can be called by the hospital admin OR the doctor themselves.
--    Sets status → 'CANCELLED', records reason + timestamp + who removed.
CREATE OR REPLACE FUNCTION public.remove_affiliation(
  _request_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _req  affiliation_requests%ROWTYPE;
  _uid  UUID := auth.uid();
BEGIN
  -- Load the request
  SELECT * INTO _req FROM public.affiliation_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affiliation request not found';
  END IF;

  -- Authorisation: must be the doctor OR a clinic_admin of the hospital
  IF _req.doctor_user_id <> _uid THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _uid
         AND ur.clinic_id = _req.hospital_clinic_id
         AND ur.role IN ('clinic_admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'Not authorised to remove this affiliation';
    END IF;
  END IF;

  -- Mark as CANCELLED
  UPDATE public.affiliation_requests
     SET status          = 'CANCELLED',
         removal_reason  = _reason,
         removed_at      = now(),
         removed_by      = _uid,
         decided_at      = COALESCE(decided_at, now())
   WHERE id = _request_id;
END;
$$;

-- 3. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.remove_affiliation(UUID, TEXT) TO authenticated;

-- 4. Accept / reject RPCs (idempotent recreate for completeness)
CREATE OR REPLACE FUNCTION public.accept_affiliation_request(_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _req affiliation_requests%ROWTYPE;
  _uid UUID := auth.uid();
BEGIN
  SELECT * INTO _req FROM public.affiliation_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  -- Hospital admin accepts a doctor-initiated request
  IF _req.initiated_by = 'DOCTOR' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _uid
         AND ur.clinic_id = _req.hospital_clinic_id
         AND ur.role IN ('clinic_admin','super_admin')
    ) THEN
      RAISE EXCEPTION 'Only hospital admins can accept doctor requests';
    END IF;
  END IF;

  -- Doctor accepts a hospital-initiated invite
  IF _req.initiated_by = 'HOSPITAL' AND _req.doctor_user_id <> _uid THEN
    RAISE EXCEPTION 'Only the invited doctor can accept this request';
  END IF;

  UPDATE public.affiliation_requests
     SET status = 'ACCEPTED', decided_at = now()
   WHERE id = _request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_affiliation_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_affiliation_request(_request_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _req affiliation_requests%ROWTYPE;
  _uid UUID := auth.uid();
BEGIN
  SELECT * INTO _req FROM public.affiliation_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE public.affiliation_requests
     SET status = 'REJECTED', decided_at = now(), decline_reason = _reason
   WHERE id = _request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_affiliation_request(UUID, TEXT) TO authenticated;
