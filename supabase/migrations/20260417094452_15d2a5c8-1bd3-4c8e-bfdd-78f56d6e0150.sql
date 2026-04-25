
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.encounter_type AS ENUM (
  'VISIT','DIAGNOSIS','TEST','PRESCRIPTION','SURGERY','NOTE','REFERRAL'
);

CREATE TYPE public.portfolio_item_type AS ENUM (
  'OPERATION','PROJECT','PUBLICATION','AWARD'
);

-- =========================================================
-- DOCTOR PROFILE ADDITIONS
-- =========================================================
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS oath_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS oath_version text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS practice_address text,
  ADD COLUMN IF NOT EXISTS bio text;

-- =========================================================
-- GLOBAL PATIENTS
-- =========================================================
CREATE TABLE public.global_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hash text NOT NULL UNIQUE,        -- sha256(normalized_phone || '|' || dob)
  display_id text NOT NULL UNIQUE,           -- e.g. DB-2025-000123
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  date_of_birth date NOT NULL,
  gender public.gender NOT NULL,
  email text,
  blood_group text,
  city text,
  state text,
  pincode text,
  country text NOT NULL DEFAULT 'IN',
  address text,
  allergies text[] NOT NULL DEFAULT '{}',
  chronic_conditions text[] NOT NULL DEFAULT '{}',
  current_medications text[] NOT NULL DEFAULT '{}',
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_global_patients_phone ON public.global_patients(phone);
CREATE INDEX idx_global_patients_name ON public.global_patients(lower(first_name), lower(last_name));
CREATE INDEX idx_global_patients_city ON public.global_patients(lower(city));
CREATE INDEX idx_global_patients_pincode ON public.global_patients(pincode);

CREATE TRIGGER trg_global_patients_updated
  BEFORE UPDATE ON public.global_patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Sequence for display IDs
CREATE SEQUENCE public.global_patient_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_patient_display_id()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.global_patient_seq');
  RETURN 'DB-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

-- Helper: deterministic identity hash
-- NOTE: pgcrypto lives in the 'extensions' schema on newer Supabase projects,
-- so we include it in the search_path explicitly.
CREATE OR REPLACE FUNCTION public.compute_patient_identity_hash(_phone text, _dob date)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(regexp_replace(coalesce(_phone,''), '\D', '', 'g') || '|' || _dob::text, 'sha256'), 'hex');
$$;

-- =========================================================
-- ACCESS GRANTS  (doctor X can see global patient Y)
-- =========================================================
CREATE TABLE public.patient_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_patient_id uuid NOT NULL REFERENCES public.global_patients(id) ON DELETE CASCADE,
  doctor_user_id uuid NOT NULL,
  granted_by_user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT 'ENCOUNTER',  -- ENCOUNTER | REFERRAL | MANUAL
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (global_patient_id, doctor_user_id)
);
CREATE INDEX idx_pag_doctor ON public.patient_access_grants(doctor_user_id);

CREATE OR REPLACE FUNCTION public.has_patient_access(_patient_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.patient_access_grants
    WHERE global_patient_id = _patient_id AND doctor_user_id = _user_id
  );
$$;

-- =========================================================
-- ENCOUNTERS  (the unified timeline)
-- =========================================================
CREATE TABLE public.patient_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_patient_id uuid NOT NULL REFERENCES public.global_patients(id) ON DELETE CASCADE,
  doctor_user_id uuid NOT NULL,
  doctor_name text NOT NULL,
  hospital_clinic_id uuid,
  hospital_name text,
  type public.encounter_type NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  details text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,   -- type-specific fields (medications[], tests[], procedure_name, anesthesia, supervising_doctor, precautions[], etc.)
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_encounters_patient ON public.patient_encounters(global_patient_id, occurred_at DESC);
CREATE INDEX idx_encounters_doctor ON public.patient_encounters(doctor_user_id);

CREATE TRIGGER trg_encounters_updated
  BEFORE UPDATE ON public.patient_encounters
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- ENCOUNTER EDITS  (visible audit trail)
-- =========================================================
CREATE TABLE public.encounter_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.patient_encounters(id) ON DELETE CASCADE,
  global_patient_id uuid NOT NULL,
  edited_by_user_id uuid NOT NULL,
  edited_by_name text NOT NULL,
  action text NOT NULL,            -- CREATE | UPDATE | DELETE
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_encounter_edits_encounter ON public.encounter_edits(encounter_id, created_at DESC);
CREATE INDEX idx_encounter_edits_patient ON public.encounter_edits(global_patient_id, created_at DESC);

-- Trigger: auto-log every change
CREATE OR REPLACE FUNCTION public.tg_log_encounter_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE editor_name text;
BEGIN
  SELECT first_name || ' ' || last_name INTO editor_name FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.encounter_edits(encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, after_data)
      VALUES (NEW.id, NEW.global_patient_id, auth.uid(), coalesce(editor_name,'system'), 'CREATE', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.encounter_edits(encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, before_data, after_data)
      VALUES (NEW.id, NEW.global_patient_id, auth.uid(), coalesce(editor_name,'system'), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.encounter_edits(encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, before_data)
      VALUES (OLD.id, OLD.global_patient_id, auth.uid(), coalesce(editor_name,'system'), 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_encounters_edit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.patient_encounters
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_encounter_edit();

-- =========================================================
-- HELPER RPCs
-- =========================================================
-- Lookup OR create a global patient (used at registration / first encounter)
CREATE OR REPLACE FUNCTION public.upsert_global_patient(
  _first_name text, _last_name text, _phone text, _dob date, _gender public.gender,
  _city text DEFAULT NULL, _state text DEFAULT NULL, _pincode text DEFAULT NULL,
  _email text DEFAULT NULL, _address text DEFAULT NULL, _blood_group text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h text;
  pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  h := public.compute_patient_identity_hash(_phone, _dob);

  SELECT id INTO pid FROM public.global_patients WHERE identity_hash = h;
  IF pid IS NULL THEN
    INSERT INTO public.global_patients(
      identity_hash, display_id, first_name, last_name, phone, date_of_birth, gender,
      email, address, blood_group, city, state, pincode, created_by_user_id
    ) VALUES (
      h, public.generate_patient_display_id(), _first_name, _last_name, _phone, _dob, _gender,
      _email, _address, _blood_group, _city, _state, _pincode, auth.uid()
    ) RETURNING id INTO pid;
  END IF;

  -- auto-grant access to the calling doctor
  INSERT INTO public.patient_access_grants(global_patient_id, doctor_user_id, granted_by_user_id, reason)
    VALUES (pid, auth.uid(), auth.uid(), 'ENCOUNTER')
    ON CONFLICT DO NOTHING;

  RETURN pid;
END;
$$;

-- Search returns full row only when the caller has access; otherwise minimal fields
CREATE OR REPLACE FUNCTION public.search_global_patients(_q text)
RETURNS TABLE(
  id uuid, display_id text, first_name text, last_name text, phone text,
  date_of_birth date, gender public.gender, city text, state text, pincode text,
  has_access boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gp.id, gp.display_id,
         CASE WHEN pag.id IS NOT NULL THEN gp.first_name ELSE left(gp.first_name,1) || '***' END,
         CASE WHEN pag.id IS NOT NULL THEN gp.last_name  ELSE left(gp.last_name,1)  || '***' END,
         CASE WHEN pag.id IS NOT NULL THEN gp.phone ELSE '***' || right(gp.phone,4) END,
         gp.date_of_birth, gp.gender,
         CASE WHEN pag.id IS NOT NULL THEN gp.city ELSE NULL END,
         CASE WHEN pag.id IS NOT NULL THEN gp.state ELSE NULL END,
         CASE WHEN pag.id IS NOT NULL THEN gp.pincode ELSE NULL END,
         (pag.id IS NOT NULL) AS has_access
  FROM public.global_patients gp
  LEFT JOIN public.patient_access_grants pag
    ON pag.global_patient_id = gp.id AND pag.doctor_user_id = auth.uid()
  WHERE _q IS NULL OR _q = '' OR (
       gp.display_id ILIKE '%' || _q || '%'
    OR gp.phone ILIKE '%' || _q || '%'
    OR lower(gp.first_name || ' ' || gp.last_name) ILIKE '%' || lower(_q) || '%'
    OR lower(coalesce(gp.city,''))  ILIKE '%' || lower(_q) || '%'
    OR lower(coalesce(gp.state,'')) ILIKE '%' || lower(_q) || '%'
    OR coalesce(gp.pincode,'') ILIKE '%' || _q || '%'
  )
  ORDER BY gp.created_at DESC
  LIMIT 50;
$$;

-- Request access to a patient you found via search
CREATE OR REPLACE FUNCTION public.request_patient_access(_patient_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.doctor_profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only doctors can request patient access';
  END IF;
  INSERT INTO public.patient_access_grants(global_patient_id, doctor_user_id, granted_by_user_id, reason)
    VALUES (_patient_id, auth.uid(), auth.uid(), 'MANUAL')
    ON CONFLICT DO NOTHING;
END;
$$;

-- =========================================================
-- DOCTOR PORTFOLIO
-- =========================================================
CREATE TABLE public.doctor_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_user_id uuid NOT NULL,
  type public.portfolio_item_type NOT NULL,
  title text NOT NULL,
  description text,
  year int,
  role text,
  outcomes text,
  image_url text,
  link_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_doctor ON public.doctor_portfolio_items(doctor_user_id);

CREATE TRIGGER trg_portfolio_updated
  BEFORE UPDATE ON public.doctor_portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- DIRECT MESSAGING (doctor ↔ doctor)
-- =========================================================
CREATE TABLE public.direct_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX idx_threads_a ON public.direct_threads(user_a, last_message_at DESC);
CREATE INDEX idx_threads_b ON public.direct_threads(user_b, last_message_at DESC);

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dm_thread ON public.direct_messages(thread_id, created_at);

-- Helper: get-or-create thread between two users (sorted)
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid; b uuid; tid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other = auth.uid() THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;
  IF auth.uid() < _other THEN a := auth.uid(); b := _other;
  ELSE a := _other; b := auth.uid(); END IF;

  SELECT id INTO tid FROM public.direct_threads WHERE user_a = a AND user_b = b;
  IF tid IS NULL THEN
    INSERT INTO public.direct_threads(user_a, user_b) VALUES (a, b) RETURNING id INTO tid;
  END IF;
  RETURN tid;
END;
$$;

-- Bump thread on new message
CREATE OR REPLACE FUNCTION public.tg_bump_thread()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.direct_threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dm_bump AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_thread();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.global_patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_access_grants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_encounters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_edits          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_portfolio_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages          ENABLE ROW LEVEL SECURITY;

-- global_patients: any authenticated doctor may see basic search row (via RPC). Direct row read requires access grant.
CREATE POLICY "Doctors view patients they have access to"
ON public.global_patients FOR SELECT TO authenticated
USING (public.has_patient_access(id, auth.uid()));

CREATE POLICY "Doctors update patients they have access to"
ON public.global_patients FOR UPDATE TO authenticated
USING (public.has_patient_access(id, auth.uid()));

-- patient_access_grants: a doctor sees only their own grants
CREATE POLICY "Doctors view own grants"
ON public.patient_access_grants FOR SELECT TO authenticated
USING (doctor_user_id = auth.uid());

CREATE POLICY "Doctors create own grants"
ON public.patient_access_grants FOR INSERT TO authenticated
WITH CHECK (doctor_user_id = auth.uid() AND granted_by_user_id = auth.uid());

-- patient_encounters: visible if the caller has access; insert/update only by author or admins
CREATE POLICY "View encounters for accessible patients"
ON public.patient_encounters FOR SELECT TO authenticated
USING (public.has_patient_access(global_patient_id, auth.uid()));

CREATE POLICY "Doctor adds encounter for accessible patient"
ON public.patient_encounters FOR INSERT TO authenticated
WITH CHECK (
  doctor_user_id = auth.uid()
  AND public.has_patient_access(global_patient_id, auth.uid())
);

CREATE POLICY "Author updates own encounter"
ON public.patient_encounters FOR UPDATE TO authenticated
USING (doctor_user_id = auth.uid());

CREATE POLICY "Author deletes own encounter"
ON public.patient_encounters FOR DELETE TO authenticated
USING (doctor_user_id = auth.uid());

-- encounter_edits: visible if you can see the patient
CREATE POLICY "View edit log for accessible patients"
ON public.encounter_edits FOR SELECT TO authenticated
USING (public.has_patient_access(global_patient_id, auth.uid()));

-- doctor_portfolio_items: published items public to authenticated; owner manages
CREATE POLICY "Authenticated view published portfolio"
ON public.doctor_portfolio_items FOR SELECT TO authenticated
USING (is_published = true OR doctor_user_id = auth.uid());

CREATE POLICY "Owner manages portfolio"
ON public.doctor_portfolio_items FOR ALL TO authenticated
USING (doctor_user_id = auth.uid())
WITH CHECK (doctor_user_id = auth.uid());

-- direct_threads
CREATE POLICY "Participants view threads"
ON public.direct_threads FOR SELECT TO authenticated
USING (user_a = auth.uid() OR user_b = auth.uid());

-- direct_messages
CREATE POLICY "Participants view messages"
ON public.direct_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.direct_threads t
               WHERE t.id = direct_messages.thread_id
                 AND (t.user_a = auth.uid() OR t.user_b = auth.uid())));

CREATE POLICY "Sender posts message"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.direct_threads t
              WHERE t.id = direct_messages.thread_id
                AND (t.user_a = auth.uid() OR t.user_b = auth.uid()))
);

CREATE POLICY "Recipient marks read"
ON public.direct_messages FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.direct_threads t
               WHERE t.id = direct_messages.thread_id
                 AND (t.user_a = auth.uid() OR t.user_b = auth.uid())));

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_encounters;
