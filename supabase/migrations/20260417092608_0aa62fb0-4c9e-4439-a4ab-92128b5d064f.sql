
-- 1. New enum for account types
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('doctor', 'hospital_admin', 'clinic_staff');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. profiles: account_type column + nullable clinic_id (for independent doctors)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'clinic_staff';

ALTER TABLE public.profiles
  ALTER COLUMN clinic_id DROP NOT NULL;

-- 3. doctor_profiles: nullable clinic_id + joined_hospital_at
ALTER TABLE public.doctor_profiles
  ALTER COLUMN clinic_id DROP NOT NULL;

ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS joined_hospital_at timestamptz;

-- Index for fast NMC lookup
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_nmc ON public.doctor_profiles(nmc_number);

-- 4. affiliation_requests table
DO $$ BEGIN
  CREATE TYPE public.affiliation_request_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.affiliation_initiator AS ENUM ('DOCTOR', 'HOSPITAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.affiliation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_user_id uuid NOT NULL,
  doctor_profile_id uuid NOT NULL,
  hospital_clinic_id uuid NOT NULL,
  hospital_name text NOT NULL,
  initiated_by public.affiliation_initiator NOT NULL,
  initiated_by_user_id uuid NOT NULL,
  status public.affiliation_request_status NOT NULL DEFAULT 'PENDING',
  message text,
  decline_reason text,
  decided_by_user_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affreq_doctor ON public.affiliation_requests(doctor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_affreq_hospital ON public.affiliation_requests(hospital_clinic_id, status);

ALTER TABLE public.affiliation_requests ENABLE ROW LEVEL SECURITY;

-- Doctor can see and act on their own requests
CREATE POLICY "Doctor views own affiliation requests"
  ON public.affiliation_requests FOR SELECT
  USING (doctor_user_id = auth.uid());

CREATE POLICY "Doctor creates own affiliation request"
  ON public.affiliation_requests FOR INSERT
  WITH CHECK (doctor_user_id = auth.uid() AND initiated_by = 'DOCTOR' AND initiated_by_user_id = auth.uid());

CREATE POLICY "Doctor updates own affiliation request"
  ON public.affiliation_requests FOR UPDATE
  USING (doctor_user_id = auth.uid());

-- Hospital admin can see and act on requests for their hospital
CREATE POLICY "Hospital admin views hospital requests"
  ON public.affiliation_requests FOR SELECT
  USING (hospital_clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY "Hospital admin creates hospital request"
  ON public.affiliation_requests FOR INSERT
  WITH CHECK (
    hospital_clinic_id = public.current_clinic_id()
    AND public.is_clinic_admin()
    AND initiated_by = 'HOSPITAL'
    AND initiated_by_user_id = auth.uid()
  );

CREATE POLICY "Hospital admin updates hospital request"
  ON public.affiliation_requests FOR UPDATE
  USING (hospital_clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- 5. Helper RPC: find doctor by NMC number (returns minimal info for matching)
CREATE OR REPLACE FUNCTION public.find_doctor_by_license(_nmc text)
RETURNS TABLE (
  doctor_user_id uuid,
  doctor_profile_id uuid,
  first_name text,
  last_name text,
  email text,
  current_hospital_id uuid,
  current_hospital_name text,
  sub_specialties text[],
  qualifications text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    dp.id,
    p.first_name,
    p.last_name,
    p.email,
    dp.clinic_id,
    c.name,
    dp.sub_specialties,
    dp.qualifications
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  LEFT JOIN public.clinics c ON c.id = dp.clinic_id
  WHERE dp.nmc_number = _nmc
  LIMIT 1;
$$;

-- 6. RPC: accept affiliation request (sets doctor's hospital)
CREATE OR REPLACE FUNCTION public.accept_affiliation_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.affiliation_requests%ROWTYPE;
  is_doctor boolean;
  is_hospital_admin boolean;
BEGIN
  SELECT * INTO req FROM public.affiliation_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'PENDING' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  is_doctor := (req.doctor_user_id = auth.uid());
  is_hospital_admin := (req.hospital_clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

  -- Doctor can only accept HOSPITAL-initiated requests; hospital can only accept DOCTOR-initiated
  IF req.initiated_by = 'HOSPITAL' AND NOT is_doctor THEN
    RAISE EXCEPTION 'Only the doctor can accept a hospital-initiated request';
  END IF;
  IF req.initiated_by = 'DOCTOR' AND NOT is_hospital_admin THEN
    RAISE EXCEPTION 'Only the hospital admin can accept a doctor-initiated request';
  END IF;

  -- Detach from any current hospital first (one-active-hospital rule)
  UPDATE public.doctor_profiles
    SET clinic_id = req.hospital_clinic_id,
        joined_hospital_at = now(),
        updated_at = now()
    WHERE id = req.doctor_profile_id;

  UPDATE public.profiles
    SET clinic_id = req.hospital_clinic_id,
        updated_at = now()
    WHERE id = req.doctor_user_id;

  -- Ensure doctor role exists for this clinic
  INSERT INTO public.user_roles (user_id, clinic_id, role)
    VALUES (req.doctor_user_id, req.hospital_clinic_id, 'doctor')
    ON CONFLICT DO NOTHING;

  UPDATE public.affiliation_requests
    SET status = 'ACCEPTED', decided_at = now(), decided_by_user_id = auth.uid()
    WHERE id = _request_id;

  -- Cancel any other pending requests for this doctor
  UPDATE public.affiliation_requests
    SET status = 'CANCELLED', decided_at = now()
    WHERE doctor_user_id = req.doctor_user_id
      AND id <> _request_id
      AND status = 'PENDING';
END;
$$;

-- 7. RPC: reject affiliation request
CREATE OR REPLACE FUNCTION public.reject_affiliation_request(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.affiliation_requests%ROWTYPE;
  is_doctor boolean;
  is_hospital_admin boolean;
BEGIN
  SELECT * INTO req FROM public.affiliation_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'PENDING' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  is_doctor := (req.doctor_user_id = auth.uid());
  is_hospital_admin := (req.hospital_clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

  IF NOT (is_doctor OR is_hospital_admin) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.affiliation_requests
    SET status = 'REJECTED', decided_at = now(), decided_by_user_id = auth.uid(), decline_reason = _reason
    WHERE id = _request_id;
END;
$$;

-- 8. RPC: detach doctor from hospital (resign / remove)
CREATE OR REPLACE FUNCTION public.detach_doctor_from_hospital(_doctor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hospital uuid;
  is_self boolean;
  is_admin_of_hospital boolean;
BEGIN
  SELECT clinic_id INTO current_hospital FROM public.profiles WHERE id = _doctor_user_id;
  IF current_hospital IS NULL THEN RAISE EXCEPTION 'Doctor is not attached to any hospital'; END IF;

  is_self := (_doctor_user_id = auth.uid());
  is_admin_of_hospital := (current_hospital = public.current_clinic_id() AND public.is_clinic_admin());

  IF NOT (is_self OR is_admin_of_hospital) THEN
    RAISE EXCEPTION 'Not authorized to detach this doctor';
  END IF;

  UPDATE public.profiles SET clinic_id = NULL, updated_at = now() WHERE id = _doctor_user_id;
  UPDATE public.doctor_profiles SET clinic_id = NULL, joined_hospital_at = NULL, updated_at = now() WHERE user_id = _doctor_user_id;

  -- Remove the doctor role at that hospital
  DELETE FROM public.user_roles
    WHERE user_id = _doctor_user_id AND clinic_id = current_hospital AND role = 'doctor';
END;
$$;

-- 9. Migrate existing data: assign account_type based on roles
UPDATE public.profiles p
SET account_type = 'hospital_admin'
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role IN ('clinic_admin', 'super_admin')
);

UPDATE public.profiles p
SET account_type = 'doctor'
WHERE account_type = 'clinic_staff'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'doctor'
  );

-- Existing doctors with clinic_id set: backfill joined_hospital_at
UPDATE public.doctor_profiles
SET joined_hospital_at = COALESCE(joined_hospital_at, created_at)
WHERE clinic_id IS NOT NULL AND joined_hospital_at IS NULL;
