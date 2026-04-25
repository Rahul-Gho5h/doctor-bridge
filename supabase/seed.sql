-- ─────────────────────────────────────────────────────────────────────────────
-- CLINICOS — SELF-CONTAINED SETUP + SEED
-- This script is idempotent. Run it in the Supabase SQL Editor.
-- It applies all feature migrations (if not yet applied) then seeds demo data.
-- Prerequisites:
--   demo.gp@db.com         — GP doctor (created in Supabase Auth)
--   demo.specialist@db.com — Cardiologist (created in Supabase Auth)
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1 — FEATURE MIGRATIONS (idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Migration: fix encounter audit trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_log_encounter_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_editor_id   uuid;
  v_editor_name text;
BEGIN
  v_editor_id := COALESCE(
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN OLD.doctor_user_id ELSE NEW.doctor_user_id END
  );
  IF v_editor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT first_name || ' ' || last_name INTO v_editor_name
    FROM public.profiles WHERE id = v_editor_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.encounter_edits(encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, after_data)
      VALUES (NEW.id, NEW.global_patient_id, v_editor_id, COALESCE(v_editor_name,'system'), 'CREATE', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.encounter_edits(encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, before_data, after_data)
      VALUES (NEW.id, NEW.global_patient_id, v_editor_id, COALESCE(v_editor_name,'system'), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.encounter_edits(encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, before_data)
      VALUES (OLD.id, OLD.global_patient_id, v_editor_id, COALESCE(v_editor_name,'system'), 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ── Migration: referral_templates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id        uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  name             text NOT NULL,
  specialist_id    uuid REFERENCES public.doctor_profiles(id) ON DELETE SET NULL,
  condition_code   text,
  diagnosis        text,
  urgency          text NOT NULL DEFAULT 'ROUTINE'
                     CHECK (urgency IN ('ROUTINE','SEMI_URGENT','URGENT')),
  clinical_summary text,
  referral_reason  text,
  use_count        integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

DROP TRIGGER IF EXISTS referral_templates_updated_at ON public.referral_templates;
CREATE TRIGGER referral_templates_updated_at
  BEFORE UPDATE ON public.referral_templates
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.referral_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select_own" ON public.referral_templates;
DROP POLICY IF EXISTS "templates_insert_own" ON public.referral_templates;
DROP POLICY IF EXISTS "templates_update_own" ON public.referral_templates;
DROP POLICY IF EXISTS "templates_delete_own" ON public.referral_templates;

CREATE POLICY "templates_select_own" ON public.referral_templates FOR SELECT
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "templates_insert_own" ON public.referral_templates FOR INSERT
  WITH CHECK (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "templates_update_own" ON public.referral_templates FOR UPDATE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "templates_delete_own" ON public.referral_templates FOR DELETE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));

-- ── Migration: referral_type column ──────────────────────────────────────────
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referral_type text NOT NULL DEFAULT 'REFERRAL'
    CHECK (referral_type IN ('REFERRAL','SECOND_OPINION'));

-- ── Migration: patient_consents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_patient_id   uuid NOT NULL REFERENCES public.global_patients(id) ON DELETE CASCADE,
  consent_type        text NOT NULL CHECK (consent_type IN ('PROCEDURE','REFERRAL','DATA_SHARING','RESEARCH','OTHER')),
  title               text NOT NULL,
  details             text,
  consent_method      text NOT NULL DEFAULT 'VERBAL' CHECK (consent_method IN ('VERBAL','WRITTEN','DIGITAL')),
  consented_by        text NOT NULL DEFAULT 'PATIENT' CHECK (consented_by IN ('PATIENT','GUARDIAN','CAREGIVER')),
  recorded_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name    text NOT NULL,
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  valid_until         date,
  revoked_at          timestamptz,
  revocation_reason   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_consents_patient_idx
  ON public.patient_consents (global_patient_id, recorded_at DESC);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consents_select_authenticated" ON public.patient_consents;
DROP POLICY IF EXISTS "consents_insert_own"           ON public.patient_consents;
DROP POLICY IF EXISTS "consents_update_own"           ON public.patient_consents;
DROP POLICY IF EXISTS "consents_delete_own"           ON public.patient_consents;

CREATE POLICY "consents_select_authenticated" ON public.patient_consents FOR SELECT TO authenticated USING (true);
CREATE POLICY "consents_insert_own"           ON public.patient_consents FOR INSERT TO authenticated WITH CHECK (recorded_by_user_id = auth.uid());
CREATE POLICY "consents_update_own"           ON public.patient_consents FOR UPDATE TO authenticated USING (recorded_by_user_id = auth.uid());
CREATE POLICY "consents_delete_own"           ON public.patient_consents FOR DELETE TO authenticated USING (recorded_by_user_id = auth.uid());

-- ── Migration: doctor_availability ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  day_of_week       smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time        time NOT NULL,
  end_time          time NOT NULL,
  slot_duration_min smallint NOT NULL DEFAULT 30,
  max_slots         smallint NOT NULL DEFAULT 10,
  is_active         boolean NOT NULL DEFAULT true,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_times CHECK (end_time > start_time),
  CONSTRAINT unique_doctor_day UNIQUE (doctor_id, day_of_week)
);

DROP TRIGGER IF EXISTS doctor_availability_updated_at ON public.doctor_availability;
CREATE TRIGGER doctor_availability_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.doctor_leave (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  leave_date  date NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_doctor_leave UNIQUE (doctor_id, leave_date)
);

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_leave        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_select_all"  ON public.doctor_availability;
DROP POLICY IF EXISTS "availability_insert_own"  ON public.doctor_availability;
DROP POLICY IF EXISTS "availability_update_own"  ON public.doctor_availability;
DROP POLICY IF EXISTS "availability_delete_own"  ON public.doctor_availability;
DROP POLICY IF EXISTS "leave_select_all"         ON public.doctor_leave;
DROP POLICY IF EXISTS "leave_insert_own"         ON public.doctor_leave;
DROP POLICY IF EXISTS "leave_delete_own"         ON public.doctor_leave;

CREATE POLICY "availability_select_all" ON public.doctor_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "availability_insert_own" ON public.doctor_availability FOR INSERT
  WITH CHECK (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "availability_update_own" ON public.doctor_availability FOR UPDATE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "availability_delete_own" ON public.doctor_availability FOR DELETE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "leave_select_all"   ON public.doctor_leave FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_insert_own"   ON public.doctor_leave FOR INSERT
  WITH CHECK (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "leave_delete_own"   ON public.doctor_leave FOR DELETE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));

-- ── Migration: appointment_date on referrals ──────────────────────────────────
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS appointment_date  timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_notes text;

-- ── Migration: follow_up_reminders ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follow_up_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id   uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  remind_at     timestamptz NOT NULL,
  reminder_type text NOT NULL DEFAULT 'FOLLOW_UP'
                  CHECK (reminder_type IN ('FOLLOW_UP','OUTCOME_DUE','APPOINTMENT_REMINDER','CUSTOM')),
  message       text NOT NULL,
  fired_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_up_reminders_due_idx
  ON public.follow_up_reminders (created_by, remind_at)
  WHERE fired_at IS NULL;

ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select_own" ON public.follow_up_reminders;
DROP POLICY IF EXISTS "reminders_insert_own" ON public.follow_up_reminders;
DROP POLICY IF EXISTS "reminders_update_own" ON public.follow_up_reminders;
DROP POLICY IF EXISTS "reminders_delete_own" ON public.follow_up_reminders;

CREATE POLICY "reminders_select_own" ON public.follow_up_reminders FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "reminders_insert_own" ON public.follow_up_reminders FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "reminders_update_own" ON public.follow_up_reminders FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "reminders_delete_own" ON public.follow_up_reminders FOR DELETE TO authenticated USING (created_by = auth.uid());

-- ── Migration: case_discussions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.case_discussions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','ARCHIVED')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS case_discussions_updated_at ON public.case_discussions;
CREATE TRIGGER case_discussions_updated_at
  BEFORE UPDATE ON public.case_discussions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.case_discussion_participants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id  uuid NOT NULL REFERENCES public.case_discussions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  display_name   text NOT NULL,
  specialization text,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_participant UNIQUE (discussion_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.case_discussion_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.case_discussions(id) ON DELETE CASCADE,
  sender_id     uuid NOT NULL REFERENCES auth.users(id),
  sender_name   text NOT NULL,
  message       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_discussion_messages_discussion_idx
  ON public.case_discussion_messages (discussion_id, created_at);

ALTER TABLE public.case_discussions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_discussion_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_discussion_messages     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discussions_select_auth"   ON public.case_discussions;
DROP POLICY IF EXISTS "discussions_insert_auth"   ON public.case_discussions;
DROP POLICY IF EXISTS "discussions_update_own"    ON public.case_discussions;
DROP POLICY IF EXISTS "participants_select_auth"  ON public.case_discussion_participants;
DROP POLICY IF EXISTS "participants_insert_auth"  ON public.case_discussion_participants;
DROP POLICY IF EXISTS "participants_insert_creator" ON public.case_discussion_participants;
DROP POLICY IF EXISTS "messages_select_auth"      ON public.case_discussion_messages;
DROP POLICY IF EXISTS "messages_insert_auth"      ON public.case_discussion_messages;

CREATE POLICY "discussions_select_auth"  ON public.case_discussions FOR SELECT TO authenticated USING (true);
CREATE POLICY "discussions_insert_auth"  ON public.case_discussions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "discussions_update_own"   ON public.case_discussions FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "participants_select_auth" ON public.case_discussion_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "participants_insert_auth" ON public.case_discussion_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR discussion_id IN (SELECT id FROM public.case_discussions WHERE created_by = auth.uid()));
CREATE POLICY "messages_select_auth"     ON public.case_discussion_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "messages_insert_auth"     ON public.case_discussion_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- ── Migration: cme_activities ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cme_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     uuid NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
                  'CONFERENCE','WORKSHOP','WEBINAR','JOURNAL_CLUB',
                  'CASE_PRESENTATION','ONLINE_COURSE','PUBLICATION','OTHER')),
  title         text NOT NULL,
  organizer     text,
  location      text,
  activity_date date NOT NULL,
  credits       numeric(5,1) NOT NULL DEFAULT 1 CHECK (credits > 0),
  certificate_url text,
  notes         text,
  verified      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS cme_activities_updated_at ON public.cme_activities;
CREATE TRIGGER cme_activities_updated_at
  BEFORE UPDATE ON public.cme_activities
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX IF NOT EXISTS cme_activities_doctor_idx
  ON public.cme_activities (doctor_id, activity_date DESC);

ALTER TABLE public.cme_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cme_select_own"  ON public.cme_activities;
DROP POLICY IF EXISTS "cme_insert_own"  ON public.cme_activities;
DROP POLICY IF EXISTS "cme_update_own"  ON public.cme_activities;
DROP POLICY IF EXISTS "cme_delete_own"  ON public.cme_activities;

CREATE POLICY "cme_select_own" ON public.cme_activities FOR SELECT
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "cme_insert_own" ON public.cme_activities FOR INSERT
  WITH CHECK (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "cme_update_own" ON public.cme_activities FOR UPDATE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "cme_delete_own" ON public.cme_activities FOR DELETE
  USING (doctor_id = (SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid() LIMIT 1));


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2 — DEMO SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_gp_id       uuid;
  v_spec_id     uuid;
  v_clinic_id   uuid;
  v_gp_doc_id   uuid;
  v_spec_doc_id uuid;

  v_p1_id uuid; v_p2_id uuid; v_p3_id uuid; v_p4_id uuid; v_p5_id uuid;

  v_ref1_id uuid; v_ref2_id uuid; v_ref3_id uuid; v_ref4_id uuid; v_ref5_id uuid;
BEGIN

  -- ── Resolve user IDs from profiles ────────────────────────────────────────
  SELECT id INTO v_gp_id   FROM public.profiles WHERE email = 'demo.gp@db.com'         LIMIT 1;
  SELECT id INTO v_spec_id FROM public.profiles WHERE email = 'demo.specialist@db.com'  LIMIT 1;

  IF v_gp_id   IS NULL THEN RAISE EXCEPTION 'demo.gp@db.com not found in profiles';         END IF;
  IF v_spec_id IS NULL THEN RAISE EXCEPTION 'demo.specialist@db.com not found in profiles'; END IF;

  -- ── 1. Clinic ─────────────────────────────────────────────────────────────
  INSERT INTO public.clinics (name, slug, email, phone, address, city, state, country, timezone, plan)
  VALUES (
    'Apollo Medical Centre', 'apollo-medical-centre-mumbai',
    'admin@apollomedical.in', '+91 22 6600 1000', '42 MG Road, Bandra West',
    'Mumbai', 'Maharashtra', 'IN', 'Asia/Kolkata', 'TRIAL'
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_clinic_id;

  -- ── 2. Update profiles ────────────────────────────────────────────────────
  UPDATE public.profiles SET
    specialization = 'General Practice', phone = '+91 98200 11111', clinic_id = v_clinic_id
  WHERE id = v_gp_id;

  UPDATE public.profiles SET
    specialization = 'Cardiology', phone = '+91 98200 22222', clinic_id = v_clinic_id
  WHERE id = v_spec_id;

  -- ── 3. Doctor profiles ────────────────────────────────────────────────────
  INSERT INTO public.doctor_profiles (
    user_id, clinic_id, nmc_number, nmc_verified, nmc_verified_at,
    is_public, accepting_referrals, weekly_referral_cap,
    qualifications, sub_specialties, condition_codes, languages_spoken,
    bio, city, state
  ) VALUES (
    v_gp_id, v_clinic_id, 'NMC-GP-2019-04521', true, NOW() - INTERVAL '60 days',
    true, true, 20,
    ARRAY['MBBS','MD General Medicine'],
    ARRAY['Primary Care','Preventive Medicine','Diabetology'],
    ARRAY['I10','E11','J45','N18','R07'],
    ARRAY['English','Hindi','Marathi'],
    'Practising general medicine in Mumbai for 8 years. Special interest in diabetes and hypertension management.',
    'Mumbai', 'Maharashtra'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nmc_verified = true, is_public = true, clinic_id = EXCLUDED.clinic_id,
    qualifications = EXCLUDED.qualifications, sub_specialties = EXCLUDED.sub_specialties
  RETURNING id INTO v_gp_doc_id;

  INSERT INTO public.doctor_profiles (
    user_id, clinic_id, nmc_number, nmc_verified, nmc_verified_at,
    is_public, accepting_referrals, weekly_referral_cap,
    qualifications, sub_specialties, condition_codes, languages_spoken,
    bio, city, state
  ) VALUES (
    v_spec_id, v_clinic_id, 'NMC-CARDIO-2017-07832', true, NOW() - INTERVAL '90 days',
    true, true, 15,
    ARRAY['MBBS','MD Medicine','DM Cardiology'],
    ARRAY['Interventional Cardiology','Heart Failure','Echocardiography'],
    ARRAY['I20','I21','I25','I50','I10','I13'],
    ARRAY['English','Hindi','Tamil'],
    'Interventional cardiologist with 12 years of experience. Trained at AIIMS Delhi. Special interest in complex PCI and heart failure.',
    'Mumbai', 'Maharashtra'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nmc_verified = true, is_public = true, clinic_id = EXCLUDED.clinic_id,
    qualifications = EXCLUDED.qualifications, sub_specialties = EXCLUDED.sub_specialties
  RETURNING id INTO v_spec_doc_id;

  -- ── 4. Patients ───────────────────────────────────────────────────────────
  INSERT INTO public.global_patients (
    identity_hash, display_id, first_name, last_name, phone, date_of_birth,
    gender, blood_group, email, city, state,
    allergies, chronic_conditions, current_medications, created_by_user_id
  ) VALUES (
    encode(sha256(('919810011001|19700315')::bytea), 'hex'),
    'DB-2026-000001', 'Rajesh', 'Kumar', '+91 98100 11001', '1970-03-15',
    'MALE', 'B+', 'rajesh.kumar@email.com', 'Mumbai', 'Maharashtra',
    ARRAY['Penicillin'], ARRAY['Type 2 Diabetes','Hypertension'],
    ARRAY['Metformin 500mg BD','Amlodipine 5mg OD','Atorvastatin 20mg OD'], v_gp_id
  ) ON CONFLICT (display_id) DO NOTHING RETURNING id INTO v_p1_id;
  IF v_p1_id IS NULL THEN SELECT id INTO v_p1_id FROM public.global_patients WHERE display_id = 'DB-2026-000001'; END IF;

  INSERT INTO public.global_patients (
    identity_hash, display_id, first_name, last_name, phone, date_of_birth,
    gender, blood_group, city, state,
    allergies, chronic_conditions, current_medications, created_by_user_id
  ) VALUES (
    encode(sha256(('919810022002|19820722')::bytea), 'hex'),
    'DB-2026-000002', 'Sunita', 'Devi', '+91 98100 22002', '1982-07-22',
    'FEMALE', 'O+', 'Mumbai', 'Maharashtra',
    ARRAY[]::text[], ARRAY['Hypothyroidism'], ARRAY['Levothyroxine 50mcg OD'], v_gp_id
  ) ON CONFLICT (display_id) DO NOTHING RETURNING id INTO v_p2_id;
  IF v_p2_id IS NULL THEN SELECT id INTO v_p2_id FROM public.global_patients WHERE display_id = 'DB-2026-000002'; END IF;

  INSERT INTO public.global_patients (
    identity_hash, display_id, first_name, last_name, phone, date_of_birth,
    gender, blood_group, city, state,
    allergies, chronic_conditions, current_medications, created_by_user_id
  ) VALUES (
    encode(sha256(('919810033003|19571108')::bytea), 'hex'),
    'DB-2026-000003', 'Mohammed', 'Ansari', '+91 98100 33003', '1957-11-08',
    'MALE', 'A+', 'Pune', 'Maharashtra',
    ARRAY['Sulfa drugs'],
    ARRAY['Chronic Kidney Disease','Hypertension','Type 2 Diabetes'],
    ARRAY['Losartan 50mg OD','Insulin Glargine 20U ON','Furosemide 20mg OD','Calcium carbonate 500mg TDS'],
    v_gp_id
  ) ON CONFLICT (display_id) DO NOTHING RETURNING id INTO v_p3_id;
  IF v_p3_id IS NULL THEN SELECT id INTO v_p3_id FROM public.global_patients WHERE display_id = 'DB-2026-000003'; END IF;

  INSERT INTO public.global_patients (
    identity_hash, display_id, first_name, last_name, phone, date_of_birth,
    gender, blood_group, city, state,
    allergies, chronic_conditions, current_medications, created_by_user_id
  ) VALUES (
    encode(sha256(('919810044004|19960430')::bytea), 'hex'),
    'DB-2026-000004', 'Pooja', 'Singh', '+91 98100 44004', '1996-04-30',
    'FEMALE', 'AB+', 'Mumbai', 'Maharashtra',
    ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[], v_gp_id
  ) ON CONFLICT (display_id) DO NOTHING RETURNING id INTO v_p4_id;
  IF v_p4_id IS NULL THEN SELECT id INTO v_p4_id FROM public.global_patients WHERE display_id = 'DB-2026-000004'; END IF;

  INSERT INTO public.global_patients (
    identity_hash, display_id, first_name, last_name, phone, date_of_birth,
    gender, blood_group, city, state,
    allergies, chronic_conditions, current_medications, created_by_user_id
  ) VALUES (
    encode(sha256(('919810055005|19530912')::bytea), 'hex'),
    'DB-2026-000005', 'Ravi', 'Prasad', '+91 98100 55005', '1953-09-12',
    'MALE', 'O-', 'Thane', 'Maharashtra',
    ARRAY['Aspirin'],
    ARRAY['Coronary Artery Disease','Hypertension','Dyslipidaemia'],
    ARRAY['Atorvastatin 40mg OD','Clopidogrel 75mg OD','Bisoprolol 5mg OD','Ramipril 5mg OD'],
    v_gp_id
  ) ON CONFLICT (display_id) DO NOTHING RETURNING id INTO v_p5_id;
  IF v_p5_id IS NULL THEN SELECT id INTO v_p5_id FROM public.global_patients WHERE display_id = 'DB-2026-000005'; END IF;

  -- ── 5. Patient encounters ─────────────────────────────────────────────────
  INSERT INTO public.patient_encounters (
    global_patient_id, doctor_user_id, doctor_name, hospital_name,
    type, occurred_at, title, details, data, attachments
  ) VALUES
  (v_p1_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'VISIT', NOW() - INTERVAL '15 days', 'Quarterly diabetes & hypertension review',
   'Patient presents for 3-monthly review. HbA1c: 7.8% (up from 7.2%). BP: 138/88. Weight: 82 kg. Foot exam normal. Counselled on dietary modification.',
   '{}'::jsonb, '[]'::jsonb),

  (v_p1_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'TEST', NOW() - INTERVAL '16 days', 'HbA1c, Fasting Glucose & Lipid Panel',
   'Fasting sample collected and sent to lab.',
   '{"test_name":"HbA1c + Lipid Panel","result":"HbA1c 7.8%, FBG 148 mg/dL, LDL 138 mg/dL, HDL 42 mg/dL, TG 185 mg/dL"}'::jsonb,
   '[]'::jsonb),

  (v_p1_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'PRESCRIPTION', NOW() - INTERVAL '15 days', 'Metformin dose increase',
   'Increased Metformin to 1000mg BD. Added Empagliflozin 10mg OD for cardioprotection.',
   '{"medication":"Metformin + Empagliflozin","dosage":"1000mg BD + 10mg OD","duration":"3 months"}'::jsonb,
   '[]'::jsonb),

  (v_p2_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'DIAGNOSIS', NOW() - INTERVAL '3 days', 'Chest pain — possible ACS, cardiac workup needed',
   'Patient is a 43-year-old female with hypothyroidism presenting with 3 weeks of exertional chest discomfort. ECG shows ST depression in V4-V6. BP 145/90. Troponin negative x2. Referred urgently to cardiology.',
   '{"icd10":"R07.9","severity":"Moderate"}'::jsonb, '[]'::jsonb),

  (v_p3_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'VISIT', NOW() - INTERVAL '7 days', 'CKD Stage 3 — quarterly review',
   'eGFR: 38 mL/min. Creatinine: 1.9. K+: 5.1. BP: 142/88. Urine PCR: 320 mg/g. Mild anaemia Hb 10.2. Patient compliant.',
   '{}'::jsonb, '[]'::jsonb),

  (v_p3_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'TEST', NOW() - INTERVAL '8 days', 'Renal function panel & CBC',
   'Blood drawn for routine monitoring.',
   '{"test_name":"Renal Function + CBC","result":"Creatinine 1.9, eGFR 38, K+ 5.1, Hb 10.2"}'::jsonb,
   '[]'::jsonb),

  (v_p4_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'VISIT', NOW() - INTERVAL '30 days', 'Annual health check',
   'No complaints. BMI: 22.4. BP: 110/70. FBG: 88. Pap smear deferred to gynaecology. HPV booster advised.',
   '{}'::jsonb, '[]'::jsonb),

  (v_p4_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'VISIT', NOW() - INTERVAL '8 days', 'Intermittent palpitations — 2 months',
   'Intermittent palpitations 3-4 episodes/week. ECG normal sinus rhythm. TSH normal. Holter arranged. Referred to cardiology.',
   '{}'::jsonb, '[]'::jsonb),

  (v_p5_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'VISIT', NOW() - INTERVAL '5 days', 'Post-PCI follow-up (3 months) — new dyspnoea',
   'Patient 3 months post-PCI to LAD. New dyspnoea NYHA II-III, bilateral ankle oedema, orthopnoea. JVP elevated. Bibasal crepitations. BP: 148/92. Urgent cardiology referral sent.',
   '{}'::jsonb, '[]'::jsonb),

  (v_p5_id, v_gp_id, 'Arjun Sharma', 'Apollo Medical Centre',
   'PRESCRIPTION', NOW() - INTERVAL '5 days', 'Empirical diuretic pending cardiology review',
   'Started Furosemide 20mg OD empirically for fluid overload. Patient to monitor daily weight.',
   '{"medication":"Furosemide","dosage":"20mg OD","duration":"Until specialist review"}'::jsonb,
   '[]'::jsonb);

  -- ── 6. Referrals ──────────────────────────────────────────────────────────

  -- REF-0001: ACCEPTED + appointment scheduled
  INSERT INTO public.referrals (
    referral_number, referring_doctor_id, specialist_id,
    patient_snapshot, primary_diagnosis, diagnosis_code, urgency,
    clinical_summary, referral_reason, referral_type,
    status, sent_at, accepted_at, appointment_date, appointment_notes,
    originating_clinic_id, originating_clinic_name, expires_at
  ) VALUES (
    'REF-2026-0001', v_gp_doc_id, v_spec_doc_id,
    '{"name":"Sunita Devi","age":43,"gender":"Female","mrn":"DB-2026-000002","phone":"+91 98100 22002","chronic_conditions":["Hypothyroidism"]}'::jsonb,
    'Suspected Unstable Angina', 'I20.0', 'SEMI_URGENT',
    'Patient is a 43-year-old female with hypothyroidism presenting with 3 weeks of exertional chest discomfort radiating to the left arm. ECG shows ST depression in V4-V6. BP 145/90. TSH normal. Troponin negative x2.',
    'Urgent cardiology evaluation for suspected ACS. Please assess need for CT coronary angiography.',
    'REFERRAL', 'ACCEPTED', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '3 days',
    'Patient should fast for 8 hours. Please bring all ECGs and latest TFT report. Cardiology OPD, 2nd floor, Room 204.',
    v_clinic_id, 'Apollo Medical Centre', NOW() + INTERVAL '88 days'
  ) RETURNING id INTO v_ref1_id;

  -- REF-0002: SENT urgent
  INSERT INTO public.referrals (
    referral_number, referring_doctor_id, specialist_id,
    patient_snapshot, primary_diagnosis, diagnosis_code, urgency,
    clinical_summary, referral_reason, referral_type,
    status, sent_at, originating_clinic_id, originating_clinic_name, expires_at
  ) VALUES (
    'REF-2026-0002', v_gp_doc_id, v_spec_doc_id,
    '{"name":"Ravi Prasad","age":72,"gender":"Male","mrn":"DB-2026-000005","phone":"+91 98100 55005","chronic_conditions":["Coronary Artery Disease","Hypertension","Dyslipidaemia"]}'::jsonb,
    'Worsening Dyspnoea — Post PCI Heart Failure', 'I50.9', 'URGENT',
    'Patient is a 72-year-old male, 3 months post-PCI to LAD. Progressive dyspnoea NYHA II-III, ankle oedema, orthopnoea. JVP elevated. Bibasal crepitations. BP: 148/92. Empirical Furosemide started.',
    'Please evaluate urgently for post-PCI heart failure. Echo essential. Advise on GDMT optimisation.',
    'REFERRAL', 'SENT', NOW() - INTERVAL '4 hours',
    v_clinic_id, 'Apollo Medical Centre', NOW() + INTERVAL '90 days'
  ) RETURNING id INTO v_ref2_id;

  -- REF-0003: COMPLETED
  INSERT INTO public.referrals (
    referral_number, referring_doctor_id, specialist_id,
    patient_snapshot, primary_diagnosis, diagnosis_code, urgency,
    clinical_summary, referral_reason, referral_type,
    status, sent_at, accepted_at, completed_at,
    outcome, outcome_notes, outcome_recorded_at,
    originating_clinic_id, originating_clinic_name, expires_at
  ) VALUES (
    'REF-2026-0003', v_gp_doc_id, v_spec_doc_id,
    '{"name":"Rajesh Kumar","age":54,"gender":"Male","mrn":"DB-2026-000001","phone":"+91 98100 11001","chronic_conditions":["Type 2 Diabetes","Hypertension"]}'::jsonb,
    'Hypertensive Heart Disease — Echo Review', 'I11.9', 'ROUTINE',
    'Patient is a 54-year-old male with T2DM and hypertension. Echo: LVEF 52%, Grade I diastolic dysfunction. LDL 138 on Atorvastatin 20mg. BP poorly controlled.',
    'Please review echo findings and advise on ACE inhibitor initiation and statin optimisation.',
    'REFERRAL', 'COMPLETED',
    NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days', NOW() - INTERVAL '10 days',
    'TREATED_AND_DISCHARGED',
    'LVEF 52%, Grade I diastolic dysfunction — hypertensive heart disease. Recommendations: Start Ramipril 5mg OD, switch to Rosuvastatin 20mg, target BP <130/80, repeat echo in 6 months.',
    NOW() - INTERVAL '10 days',
    v_clinic_id, 'Apollo Medical Centre', NOW() + INTERVAL '65 days'
  ) RETURNING id INTO v_ref3_id;

  -- REF-0004: SECOND OPINION
  INSERT INTO public.referrals (
    referral_number, referring_doctor_id, specialist_id,
    patient_snapshot, primary_diagnosis, diagnosis_code, urgency,
    clinical_summary, referral_reason, referral_type,
    status, sent_at, originating_clinic_id, originating_clinic_name, expires_at
  ) VALUES (
    'REF-2026-0004', v_gp_doc_id, v_spec_doc_id,
    '{"name":"Mohammed Ansari","age":67,"gender":"Male","mrn":"DB-2026-000003","phone":"+91 98100 33003","chronic_conditions":["Chronic Kidney Disease","Hypertension","Type 2 Diabetes"]}'::jsonb,
    'Chest Pain in CKD — Cardiac vs Musculoskeletal?', 'I13.1', 'ROUTINE',
    'Patient is a 67-year-old male with CKD Stage 3, T2DM and hypertension. Episode of chest pain 3 weeks ago — ECG normal, troponin negative x2, resolved spontaneously. Clinically musculoskeletal (reproducible on palpation). Family insisting on cardiac catheterisation.',
    'Do you agree this was musculoskeletal? Is angiography warranted given CKD and contrast nephropathy risk?',
    'SECOND_OPINION', 'SENT', NOW() - INTERVAL '1 day',
    v_clinic_id, 'Apollo Medical Centre', NOW() + INTERVAL '89 days'
  ) RETURNING id INTO v_ref4_id;

  -- REF-0005: DECLINED
  INSERT INTO public.referrals (
    referral_number, referring_doctor_id, specialist_id,
    patient_snapshot, primary_diagnosis, diagnosis_code, urgency,
    clinical_summary, referral_reason, referral_type,
    status, sent_at, declined_at, decline_reason,
    originating_clinic_id, originating_clinic_name, expires_at
  ) VALUES (
    'REF-2026-0005', v_gp_doc_id, v_spec_doc_id,
    '{"name":"Pooja Singh","age":28,"gender":"Female","mrn":"DB-2026-000004","phone":"+91 98100 44004","chronic_conditions":[]}'::jsonb,
    'Intermittent Palpitations', 'R00.2', 'ROUTINE',
    'Patient is a 28-year-old female with 2-month history of intermittent palpitations. ECG normal. TFT normal. No structural heart disease suspected.',
    'Please advise on need for Holter monitoring and cardiac workup.',
    'REFERRAL', 'DECLINED',
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days',
    'At full capacity this month. For low-risk palpitations with normal ECG, suggest Holter first — refer only if arrhythmia detected.',
    v_clinic_id, 'Apollo Medical Centre', NOW() + INTERVAL '70 days'
  ) RETURNING id INTO v_ref5_id;

  -- ── 7. Referral messages ──────────────────────────────────────────────────
  INSERT INTO public.referral_messages (referral_id, sender_id, sender_name, sender_role, message, created_at)
  VALUES
  (v_ref1_id, v_spec_id, 'Dr. Priya Mehta', 'specialist',
   'Good morning Dr. Sharma. I have reviewed the referral for Mrs. Sunita Devi. High-risk presentation given the ST changes and family history. I will see her on the scheduled date. Please ensure she brings all ECGs and latest TFT.',
   NOW() - INTERVAL '20 hours'),
  (v_ref1_id, v_gp_id, 'Dr. Arjun Sharma', 'referrer',
   'Thank you Dr. Mehta. TSH was 2.1 mIU/L on Levothyroxine 50mcg. Troponin negative x2, 6 hours apart. Will ensure she brings all documents.',
   NOW() - INTERVAL '18 hours'),
  (v_ref1_id, v_spec_id, 'Dr. Priya Mehta', 'specialist',
   'Noted. I am leaning towards CT coronary angiography as initial investigation — less operator-dependent and gives a definitive anatomical answer. Will confirm after examining her.',
   NOW() - INTERVAL '16 hours');

  -- ── 8. Availability slots ─────────────────────────────────────────────────
  INSERT INTO public.doctor_availability
    (doctor_id, day_of_week, start_time, end_time, slot_duration_min, max_slots, is_active)
  SELECT v_gp_doc_id, d, '09:00'::time, '17:00'::time, 15, 24, true
  FROM unnest(ARRAY[1,2,3,4,5]) AS t(d)
  ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

  INSERT INTO public.doctor_availability
    (doctor_id, day_of_week, start_time, end_time, slot_duration_min, max_slots, is_active, notes)
  VALUES
    (v_spec_doc_id, 1, '10:00', '15:00', 30, 10, true, 'Mornings reserved for procedures on Tuesdays'),
    (v_spec_doc_id, 3, '10:00', '15:00', 30, 10, true, NULL),
    (v_spec_doc_id, 5, '10:00', '14:00', 30,  8, true, 'Academic half-day afternoon')
  ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

  -- ── 9. CME activities ─────────────────────────────────────────────────────
  INSERT INTO public.cme_activities
    (doctor_id, activity_type, title, organizer, location, activity_date, credits, notes, verified)
  VALUES
  (v_gp_doc_id, 'CONFERENCE',   'APICON 2025 — Annual Conference of API',
   'Association of Physicians of India', 'Mumbai', '2025-01-18', 8,
   'Attended tracks on T2DM management, CKD in primary care, hypertension guidelines.', true),
  (v_gp_doc_id, 'WEBINAR',      'Updated ICMR Guidelines for Type 2 Diabetes',
   'ICMR', 'Online', '2025-02-12', 2,
   'Live webinar. Certificate ID: ICMR-WB-2025-0421', true),
  (v_gp_doc_id, 'WORKSHOP',     'ECG Interpretation Masterclass',
   'Cardiological Society of India, Maharashtra Chapter', 'Pune', '2025-03-05', 3,
   'Hands-on workshop — 20 case ECGs reviewed.', false),
  (v_gp_doc_id, 'JOURNAL_CLUB', 'Monthly Journal Club — EMPEROR-Reduced Trial Review',
   'Apollo Medical Centre', 'Mumbai', '2025-09-10', 1,
   'Presented: Empagliflozin in HFrEF — implications for primary care.', false),
  (v_gp_doc_id, 'ONLINE_COURSE','CKD in Primary Care — NMC eLearning Module',
   'NMC eLearning Portal', 'Online', '2026-01-20', 2,
   'Scored 87/100. Certificate auto-submitted to NMC registry.', false),
  (v_gp_doc_id, 'CONFERENCE',   'AFPI Family Medicine India Summit 2026',
   'AFPI (Academy of Family Physicians of India)', 'New Delhi', '2026-03-22', 6,
   'Presented case: Multimorbidity management in elderly — CKD + DM + HF.', false);

  -- ── 10. Referral templates ────────────────────────────────────────────────
  INSERT INTO public.referral_templates
    (doctor_id, name, specialist_id, condition_code, diagnosis, urgency, clinical_summary, referral_reason, use_count)
  VALUES
  (v_gp_doc_id, 'Cardiology — Chest Pain Workup', v_spec_doc_id, 'R07.9',
   'Chest pain — cardiac evaluation', 'SEMI_URGENT',
   'Patient presenting with chest pain. ECG performed. Vitals and cardiac history documented.',
   'Please evaluate for cardiac cause and advise on further investigation.', 3),
  (v_gp_doc_id, 'Cardiology — Echo & BP Review', v_spec_doc_id, 'I11.9',
   'Hypertensive heart disease — echo review', 'ROUTINE',
   'Patient with longstanding hypertension. Recent echo findings noted. Current regimen documented.',
   'Please review echo and advise on antihypertensive and statin optimisation.', 1),
  (v_gp_doc_id, 'Cardiology — Heart Failure Follow-up', v_spec_doc_id, 'I50.9',
   'Heart failure — specialist review', 'SEMI_URGENT',
   'Patient with known or suspected heart failure. NYHA class and medications documented.',
   'Please review and advise on GDMT initiation/titration and need for device therapy.', 0);

  -- ── 11. Patient consents ──────────────────────────────────────────────────
  INSERT INTO public.patient_consents
    (global_patient_id, consent_type, title, details, consent_method, consented_by,
     recorded_by_user_id, recorded_by_name, recorded_at)
  VALUES
  (v_p2_id, 'REFERRAL', 'Consent to refer to cardiologist (Dr. Priya Mehta)',
   'Patient verbally consented to cardiology referral. Nature, risks of delayed investigation and benefits explained.',
   'VERBAL', 'PATIENT', v_gp_id, 'Dr. Arjun Sharma', NOW() - INTERVAL '3 days'),
  (v_p1_id, 'DATA_SHARING', 'Consent to share medical records with referring specialist',
   'Patient consented to sharing of diabetes and hypertension records including lab results.',
   'VERBAL', 'PATIENT', v_gp_id, 'Dr. Arjun Sharma', NOW() - INTERVAL '25 days'),
  (v_p3_id, 'REFERRAL', 'Consent to second opinion request from cardiologist',
   'Patient and family informed that second opinion is being sought. Patient consented.',
   'VERBAL', 'PATIENT', v_gp_id, 'Dr. Arjun Sharma', NOW() - INTERVAL '1 day'),
  (v_p5_id, 'PROCEDURE', 'Consent for diuretic therapy pending specialist review',
   'Patient consented to empirical Furosemide. Risks and benefits explained.',
   'VERBAL', 'PATIENT', v_gp_id, 'Dr. Arjun Sharma', NOW() - INTERVAL '5 days');

  -- ── 12. Follow-up reminders ───────────────────────────────────────────────
  INSERT INTO public.follow_up_reminders (referral_id, created_by, remind_at, reminder_type, message)
  VALUES
  (v_ref1_id, v_gp_id, NOW() + INTERVAL '4 days', 'APPOINTMENT_REMINDER',
   'Sunita Devi cardiology appointment tomorrow — confirm patient has fasted and has ECG reports'),
  (v_ref1_id, v_gp_id, NOW() + INTERVAL '8 days', 'FOLLOW_UP',
   'Follow up with Sunita Devi post-cardiology visit — check echo result and specialist recommendations'),
  (v_ref2_id, v_gp_id, NOW() + INTERVAL '1 day', 'OUTCOME_DUE',
   'URGENT: Ravi Prasad referral sent 4 hours ago — no response yet. Call specialist directly if not acknowledged by EOD'),
  (v_ref4_id, v_gp_id, NOW() + INTERVAL '3 days', 'FOLLOW_UP',
   'Mohammed Ansari second opinion — follow up with Dr. Mehta if no response in 72 hours');

  -- ── 13. Notifications ─────────────────────────────────────────────────────
  INSERT INTO public.notifications (recipient_id, type, title, message, data, sent_at, read_at)
  VALUES
  (v_gp_id, 'REFERRAL_ACCEPTED', 'Referral accepted',
   'Dr. Priya Mehta accepted your referral for Sunita Devi.',
   jsonb_build_object('referral_id', v_ref1_id),
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 hours'),

  (v_gp_id, 'REFERRAL_OUTCOME', 'Outcome recorded for Rajesh Kumar',
   'Dr. Priya Mehta recorded the outcome: Treated and discharged.',
   jsonb_build_object('referral_id', v_ref3_id),
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days'),

  (v_spec_id, 'NEW_REFERRAL', 'New referral from Dr. Arjun Sharma',
   'Ravi Prasad · Worsening Dyspnoea — Post PCI Heart Failure · Urgent',
   jsonb_build_object('referral_id', v_ref2_id),
   NOW() - INTERVAL '4 hours', NULL),

  (v_spec_id, 'NEW_REFERRAL', 'Second opinion request from Dr. Arjun Sharma',
   'Mohammed Ansari · Chest Pain in CKD — Cardiac vs Musculoskeletal? · Routine',
   jsonb_build_object('referral_id', v_ref4_id),
   NOW() - INTERVAL '1 day', NULL),

  (v_spec_id, 'REFERRAL_MESSAGE', 'Message from Dr. Arjun Sharma',
   'Thank you Dr. Mehta. TSH was 2.1 mIU/L on Levothyroxine 50mcg...',
   jsonb_build_object('referral_id', v_ref1_id),
   NOW() - INTERVAL '18 hours', NULL);

  RAISE NOTICE '✅ Setup + seed completed successfully!';
  RAISE NOTICE '   GP user ID:          %', v_gp_id;
  RAISE NOTICE '   Specialist user ID:  %', v_spec_id;
  RAISE NOTICE '   Clinic ID:           %', v_clinic_id;
  RAISE NOTICE '   GP doctor profile:   %', v_gp_doc_id;
  RAISE NOTICE '   Spec doctor profile: %', v_spec_doc_id;
  RAISE NOTICE '   Patients created:    5';
  RAISE NOTICE '   Referrals created:   5 (ACCEPTED, SENT, COMPLETED, SECOND_OPINION, DECLINED)';

END $$;
