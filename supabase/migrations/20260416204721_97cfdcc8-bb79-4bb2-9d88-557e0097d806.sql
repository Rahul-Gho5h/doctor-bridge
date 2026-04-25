
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','clinic_admin','doctor','nurse','receptionist','billing','lab_tech','pharmacist','staff'
);
CREATE TYPE public.clinic_plan AS ENUM ('TRIAL','STARTER','PROFESSIONAL','ENTERPRISE');
CREATE TYPE public.gender AS ENUM ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY');
CREATE TYPE public.patient_status AS ENUM ('ACTIVE','INACTIVE','DECEASED','TRANSFERRED');
CREATE TYPE public.appointment_status AS ENUM ('SCHEDULED','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED');
CREATE TYPE public.appointment_type AS ENUM ('IN_PERSON','TELEMEDICINE','HOME_VISIT','FOLLOW_UP','EMERGENCY');
CREATE TYPE public.priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE public.prescription_status AS ENUM ('ACTIVE','COMPLETED','CANCELLED','ON_HOLD','DISPENSED');
CREATE TYPE public.lab_status AS ENUM ('PENDING','COLLECTED','IN_PROGRESS','RESULTED','REVIEWED','CANCELLED');
CREATE TYPE public.document_type AS ENUM ('LAB_REPORT','IMAGING','INSURANCE_CARD','ID_DOCUMENT','CONSENT_FORM','REFERRAL_LETTER','DISCHARGE_SUMMARY','OTHER');
CREATE TYPE public.invoice_status AS ENUM ('DRAFT','SENT','PAID','PARTIALLY_PAID','OVERDUE','CANCELLED','REFUNDED');
CREATE TYPE public.payment_method AS ENUM ('CASH','CREDIT_CARD','DEBIT_CARD','UPI','BANK_TRANSFER','INSURANCE','OTHER');
CREATE TYPE public.payment_status AS ENUM ('PENDING','COMPLETED','FAILED','REFUNDED');
CREATE TYPE public.inventory_category AS ENUM ('MEDICATION','SUPPLIES','EQUIPMENT','CONSUMABLES','LAB_SUPPLIES','OTHER');
CREATE TYPE public.transaction_type AS ENUM ('PURCHASE','USAGE','ADJUSTMENT','RETURN','EXPIRED','DAMAGED');
CREATE TYPE public.room_type AS ENUM ('CONSULTATION','EXAMINATION','PROCEDURE','SURGERY','LAB','IMAGING','WAITING','EMERGENCY');
CREATE TYPE public.notification_type AS ENUM (
  'APPOINTMENT_REMINDER','APPOINTMENT_CANCELLED','NEW_APPOINTMENT','PATIENT_CHECKED_IN',
  'LAB_RESULTS_READY','PRESCRIPTION_READY','PAYMENT_RECEIVED','INVOICE_OVERDUE',
  'INVENTORY_LOW','SYSTEM_ALERT','MESSAGE','NEW_REFERRAL','REFERRAL_ACCEPTED',
  'REFERRAL_DECLINED','REFERRAL_MESSAGE','REFERRAL_OUTCOME'
);
CREATE TYPE public.notification_channel AS ENUM ('IN_APP','EMAIL','SMS','PUSH');
CREATE TYPE public.audit_action AS ENUM ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','PRINT','SHARE','FAILED_LOGIN','PASSWORD_CHANGE','PERMISSION_CHANGE');
CREATE TYPE public.template_type AS ENUM ('SOAP_NOTE','PRESCRIPTION','INVOICE','EMAIL','SMS','CONSENT_FORM','REFERRAL','DISCHARGE');
CREATE TYPE public.referral_status AS ENUM ('DRAFT','SENT','VIEWED','ACKNOWLEDGED','ACCEPTED','APPOINTMENT_BOOKED','COMPLETED','DECLINED','CANCELLED','EXPIRED');
CREATE TYPE public.referral_urgency AS ENUM ('ROUTINE','SEMI_URGENT','URGENT');
CREATE TYPE public.referral_outcome AS ENUM ('TREATED_AND_DISCHARGED','ONGOING_TREATMENT','REFERRED_FURTHER','DECLINED_BY_PATIENT','TREATMENT_NOT_REQUIRED');
CREATE TYPE public.preauth_status AS ENUM ('NOT_REQUIRED','PENDING','APPROVED','REJECTED','APPEALED');

-- ============================================================
-- UTILITY: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- CORE: clinics
-- ============================================================
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT, city TEXT, state TEXT,
  country TEXT NOT NULL DEFAULT 'IN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  logo TEXT,
  license_number TEXT,
  plan public.clinic_plan NOT NULL DEFAULT 'TRIAL',
  plan_expires_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}',
  working_hours JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_clinics_updated BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- CORE: profiles (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  department_id UUID,
  title TEXT,
  specialization TEXT,
  license_number TEXT,
  bio TEXT,
  consultation_fee NUMERIC(10,2),
  working_hours JSONB,
  is_available BOOLEAN NOT NULL DEFAULT true,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_clinic ON public.profiles(clinic_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- CORE: user_roles (separate per security best practice)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, clinic_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ============================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin','clinic_admin']::public.app_role[]);
$$;

-- ============================================================
-- DEPARTMENTS, ROOMS
-- ============================================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, name)
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_department_fk
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.room_type NOT NULL DEFAULT 'CONSULTATION',
  floor TEXT,
  capacity INT NOT NULL DEFAULT 1,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, name)
);

-- ============================================================
-- DOCTOR PROFILES (referral module)
-- ============================================================
CREATE TABLE public.doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nmc_number TEXT NOT NULL UNIQUE,
  nmc_verified BOOLEAN NOT NULL DEFAULT false,
  nmc_verified_at TIMESTAMPTZ,
  qualifications TEXT[] NOT NULL DEFAULT '{}',
  fellowships JSONB NOT NULL DEFAULT '[]',
  sub_specialties TEXT[] NOT NULL DEFAULT '{}',
  condition_codes TEXT[] NOT NULL DEFAULT '{}',
  hospital_affiliations JSONB NOT NULL DEFAULT '[]',
  pubmed_id TEXT,
  publication_count INT NOT NULL DEFAULT 0,
  clinical_trials JSONB NOT NULL DEFAULT '[]',
  teaching_hospital TEXT,
  academic_title TEXT,
  accepting_referrals BOOLEAN NOT NULL DEFAULT true,
  weekly_referral_cap INT NOT NULL DEFAULT 20,
  current_week_referrals INT NOT NULL DEFAULT 0,
  capacity_reset_at TIMESTAMPTZ,
  condition_availability JSONB NOT NULL DEFAULT '[]',
  leave_blocks JSONB NOT NULL DEFAULT '[]',
  total_referrals_received INT NOT NULL DEFAULT 0,
  referral_acceptance_rate NUMERIC(5,2),
  avg_response_time_hours NUMERIC(6,2),
  unique_referring_doctors INT NOT NULL DEFAULT 0,
  insurance_panels TEXT[] NOT NULL DEFAULT '{}',
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  telemedicine_enabled BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  profile_completeness INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_profiles_nmc ON public.doctor_profiles(nmc_number);
CREATE INDEX idx_doc_profiles_accepting ON public.doctor_profiles(accepting_referrals);
CREATE INDEX idx_doc_profiles_subs ON public.doctor_profiles USING GIN(sub_specialties);
CREATE INDEX idx_doc_profiles_codes ON public.doctor_profiles USING GIN(condition_codes);
CREATE TRIGGER trg_doc_profiles_updated BEFORE UPDATE ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_number TEXT NOT NULL UNIQUE,
  referring_doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id),
  specialist_id UUID NOT NULL REFERENCES public.doctor_profiles(id),
  patient_snapshot JSONB NOT NULL,
  primary_diagnosis TEXT NOT NULL,
  diagnosis_code TEXT,
  urgency public.referral_urgency NOT NULL DEFAULT 'ROUTINE',
  clinical_summary TEXT NOT NULL,
  referral_reason TEXT NOT NULL,
  attached_documents JSONB NOT NULL DEFAULT '[]',
  status public.referral_status NOT NULL DEFAULT 'DRAFT',
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  appointment_booked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  decline_reason TEXT,
  counter_suggested_doctor_id UUID,
  estimated_wait_days INT,
  appointment_id UUID UNIQUE,
  outcome public.referral_outcome,
  outcome_notes TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  insurance_preauth_status public.preauth_status,
  insurance_preauth_number TEXT,
  originating_clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  originating_clinic_name TEXT NOT NULL,
  is_urgent_escalated BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_referring ON public.referrals(referring_doctor_id, status);
CREATE INDEX idx_referrals_specialist ON public.referrals(specialist_id, status);
CREATE INDEX idx_referrals_urgency ON public.referrals(urgency, status);
CREATE TRIGGER trg_referrals_updated BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.referral_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ref_msgs ON public.referral_messages(referral_id, created_at);

-- Helper: is the current user one of the parties to this referral?
CREATE OR REPLACE FUNCTION public.is_referral_party(_referral_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.referrals r
    JOIN public.doctor_profiles dp1 ON dp1.id = r.referring_doctor_id
    LEFT JOIN public.doctor_profiles dp2 ON dp2.id = r.specialist_id
    WHERE r.id = _referral_id
      AND (dp1.user_id = auth.uid() OR dp2.user_id = auth.uid())
  );
$$;

-- ============================================================
-- PATIENTS & CLINICAL
-- ============================================================
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  mrn TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender public.gender NOT NULL,
  blood_group TEXT,
  address TEXT, city TEXT, state TEXT,
  country TEXT NOT NULL DEFAULT 'IN',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  allergies TEXT[] NOT NULL DEFAULT '{}',
  chronic_conditions TEXT[] NOT NULL DEFAULT '{}',
  current_medications TEXT[] NOT NULL DEFAULT '{}',
  status public.patient_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, mrn),
  UNIQUE(clinic_id, phone)
);
CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX idx_patients_name ON public.patients(last_name, first_name);
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  category TEXT,
  price NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  duration INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  doctor_id UUID NOT NULL REFERENCES public.profiles(id),
  created_by_id UUID NOT NULL REFERENCES public.profiles(id),
  service_id UUID REFERENCES public.services(id),
  room_id UUID REFERENCES public.rooms(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration INT NOT NULL DEFAULT 30,
  end_time TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'SCHEDULED',
  type public.appointment_type NOT NULL DEFAULT 'IN_PERSON',
  priority public.priority NOT NULL DEFAULT 'NORMAL',
  reason TEXT, notes TEXT, chief_complaint TEXT,
  checked_in_at TIMESTAMPTZ, started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appts_clinic ON public.appointments(clinic_id);
CREATE INDEX idx_appts_doctor ON public.appointments(doctor_id, scheduled_at);
CREATE INDEX idx_appts_patient ON public.appointments(patient_id, scheduled_at);
CREATE INDEX idx_appts_status ON public.appointments(status);
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  doctor_id UUID NOT NULL REFERENCES public.profiles(id),
  appointment_id UUID UNIQUE REFERENCES public.appointments(id),
  subjective TEXT, objective TEXT, assessment TEXT, plan TEXT,
  chief_complaint TEXT, history_of_present_illness TEXT,
  diagnoses JSONB NOT NULL DEFAULT '[]',
  procedures JSONB NOT NULL DEFAULT '[]',
  follow_up_date TIMESTAMPTZ, follow_up_notes TEXT,
  referral_to TEXT, referral_notes TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mr_patient ON public.medical_records(patient_id);
CREATE INDEX idx_mr_doctor ON public.medical_records(doctor_id);
CREATE TRIGGER trg_mr_updated BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  temperature NUMERIC(5,2),
  blood_pressure_systolic INT, blood_pressure_diastolic INT,
  heart_rate INT, respiratory_rate INT,
  oxygen_saturation NUMERIC(5,2),
  weight NUMERIC(6,2), height NUMERIC(5,2), bmi NUMERIC(5,2),
  pain_level INT, blood_glucose NUMERIC(6,2),
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by_id UUID REFERENCES public.profiles(id)
);
CREATE INDEX idx_vitals_patient ON public.vitals(patient_id, recorded_at);

CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  doctor_id UUID NOT NULL REFERENCES public.profiles(id),
  medical_record_id UUID REFERENCES public.medical_records(id),
  medication_name TEXT NOT NULL, generic_name TEXT,
  dosage TEXT NOT NULL, frequency TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT 'Oral',
  duration TEXT NOT NULL,
  quantity INT, refills INT NOT NULL DEFAULT 0,
  instructions TEXT,
  status public.prescription_status NOT NULL DEFAULT 'ACTIVE',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rx_patient ON public.prescriptions(patient_id);
CREATE TRIGGER trg_rx_updated BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  medical_record_id UUID REFERENCES public.medical_records(id),
  test_name TEXT NOT NULL, test_code TEXT, category TEXT,
  results JSONB NOT NULL,
  ordered_by_id UUID REFERENCES public.profiles(id),
  status public.lab_status NOT NULL DEFAULT 'PENDING',
  priority public.priority NOT NULL DEFAULT 'NORMAL',
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  collected_at TIMESTAMPTZ, resulted_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX idx_lab_patient ON public.lab_results(patient_id);

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  name TEXT NOT NULL, type public.document_type NOT NULL,
  mime_type TEXT NOT NULL, size INT NOT NULL,
  url TEXT NOT NULL, description TEXT,
  uploaded_by_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_patient ON public.documents(patient_id);

-- ============================================================
-- BILLING
-- ============================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  appointment_id UUID UNIQUE REFERENCES public.appointments(id),
  created_by_id UUID NOT NULL REFERENCES public.profiles(id),
  subtotal NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'DRAFT',
  due_date TIMESTAMPTZ, paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_clinic ON public.invoices(clinic_id);
CREATE INDEX idx_inv_patient ON public.invoices(patient_id);
CREATE INDEX idx_inv_status ON public.invoices(status);
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  amount NUMERIC(10,2) NOT NULL,
  method public.payment_method NOT NULL,
  reference TEXT,
  status public.payment_status NOT NULL DEFAULT 'COMPLETED',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE INDEX idx_pay_inv ON public.payments(invoice_id);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sku TEXT,
  category public.inventory_category NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 0,
  min_quantity INT NOT NULL DEFAULT 10,
  unit TEXT NOT NULL DEFAULT 'units',
  cost_price NUMERIC(10,2),
  supplier TEXT, expiry_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_items_clinic ON public.inventory_items(clinic_id);
CREATE TRIGGER trg_inv_items_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  type public.transaction_type NOT NULL,
  quantity INT NOT NULL,
  previous_qty INT NOT NULL,
  new_qty INT NOT NULL,
  reason TEXT,
  performed_by_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_tx_item ON public.inventory_transactions(item_id);

-- ============================================================
-- NOTIFICATIONS, AUDIT, TEMPLATES
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  type public.notification_type NOT NULL,
  title TEXT NOT NULL, message TEXT NOT NULL,
  data JSONB,
  channel public.notification_channel NOT NULL DEFAULT 'IN_APP',
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_recipient ON public.notifications(recipient_id, read_at);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action public.audit_action NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB, new_values JSONB,
  ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_clinic ON public.audit_logs(clinic_id, created_at);
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.template_type NOT NULL,
  category TEXT,
  content JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tmpl_updated BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- ENABLE RLS ON EVERYTHING
-- ============================================================
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- CLINICS: members can view their clinic; only clinic admins can update
CREATE POLICY "Members view own clinic" ON public.clinics FOR SELECT
  USING (id = public.current_clinic_id());
CREATE POLICY "Admins update clinic" ON public.clinics FOR UPDATE
  USING (id = public.current_clinic_id() AND public.is_clinic_admin());

-- PROFILES: any authenticated user can view profiles within their clinic; self-edit; admin manages
CREATE POLICY "View profiles in own clinic" ON public.profiles FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- USER_ROLES: users can see their own; admins can see/manage clinic's
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin view clinic roles" ON public.user_roles FOR SELECT
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());
CREATE POLICY "Admin manage clinic roles" ON public.user_roles FOR ALL
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- Generic clinic-scoped tables: SELECT for clinic members, ALL for admins; specific tables loosened below
CREATE POLICY "Clinic members view departments" ON public.departments FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

CREATE POLICY "Clinic members view rooms" ON public.rooms FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Admins manage rooms" ON public.rooms FOR ALL
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- DOCTOR_PROFILES: public directory — any authenticated user can view; only owner edits
CREATE POLICY "Authenticated view doctor profiles" ON public.doctor_profiles FOR SELECT
  TO authenticated USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "Owner manages doctor profile" ON public.doctor_profiles FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- REFERRALS: visible to either party (across clinics); created by referring doctor; status updates by parties
CREATE POLICY "Parties view referrals" ON public.referrals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = referring_doctor_id AND dp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = specialist_id AND dp.user_id = auth.uid())
  );
CREATE POLICY "Referring doctor creates referral" ON public.referrals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = referring_doctor_id AND dp.user_id = auth.uid())
  );
CREATE POLICY "Parties update referral" ON public.referrals FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = referring_doctor_id AND dp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.doctor_profiles dp WHERE dp.id = specialist_id AND dp.user_id = auth.uid())
  );

-- REFERRAL MESSAGES: visible to and writable by parties
CREATE POLICY "Parties view referral messages" ON public.referral_messages FOR SELECT
  USING (public.is_referral_party(referral_id));
CREATE POLICY "Parties send referral messages" ON public.referral_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_referral_party(referral_id));
CREATE POLICY "Sender updates own message" ON public.referral_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- PATIENTS / clinical: clinic members can view; doctors/nurses/receptionists can write per role
CREATE POLICY "Clinic members view patients" ON public.patients FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Clinic staff manage patients" ON public.patients FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse','receptionist']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse','receptionist']::public.app_role[])
  );

-- SERVICES
CREATE POLICY "Clinic members view services" ON public.services FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Admins manage services" ON public.services FOR ALL
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- APPOINTMENTS
CREATE POLICY "Clinic members view appointments" ON public.appointments FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Clinic staff manage appointments" ON public.appointments FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse','receptionist']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse','receptionist']::public.app_role[])
  );

-- MEDICAL RECORDS
CREATE POLICY "Clinic members view records" ON public.medical_records FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Clinical staff manage records" ON public.medical_records FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse']::public.app_role[])
  );

-- VITALS
CREATE POLICY "Clinic members view vitals" ON public.vitals FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Clinical staff manage vitals" ON public.vitals FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse']::public.app_role[])
  );

-- PRESCRIPTIONS
CREATE POLICY "Clinic members view rx" ON public.prescriptions FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Doctors manage rx" ON public.prescriptions FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','pharmacist']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','pharmacist']::public.app_role[])
  );

-- LAB RESULTS
CREATE POLICY "Clinic members view lab" ON public.lab_results FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Lab staff manage results" ON public.lab_results FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','lab_tech','nurse']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','lab_tech','nurse']::public.app_role[])
  );

-- DOCUMENTS
CREATE POLICY "Clinic members view docs" ON public.documents FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Clinic staff manage docs" ON public.documents FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse','receptionist','lab_tech']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','doctor','nurse','receptionist','lab_tech']::public.app_role[])
  );

-- INVOICES
CREATE POLICY "Clinic members view invoices" ON public.invoices FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Billing manage invoices" ON public.invoices FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','billing','receptionist']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','billing','receptionist']::public.app_role[])
  );

-- INVOICE ITEMS
CREATE POLICY "View invoice items" ON public.invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.clinic_id = public.current_clinic_id()));
CREATE POLICY "Billing manage invoice items" ON public.invoice_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.clinic_id = public.current_clinic_id())
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','billing','receptionist']::public.app_role[])
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.clinic_id = public.current_clinic_id())
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','billing','receptionist']::public.app_role[])
  );

-- PAYMENTS
CREATE POLICY "View payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.clinic_id = public.current_clinic_id()));
CREATE POLICY "Billing manage payments" ON public.payments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.clinic_id = public.current_clinic_id())
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','billing','receptionist']::public.app_role[])
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.clinic_id = public.current_clinic_id())
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','billing','receptionist']::public.app_role[])
  );

-- INVENTORY
CREATE POLICY "Clinic members view inventory" ON public.inventory_items FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Inventory staff manage" ON public.inventory_items FOR ALL
  USING (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','pharmacist','lab_tech','nurse']::public.app_role[])
  )
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','pharmacist','lab_tech','nurse']::public.app_role[])
  );

CREATE POLICY "View inventory tx" ON public.inventory_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.inventory_items it WHERE it.id = item_id AND it.clinic_id = public.current_clinic_id()));
CREATE POLICY "Inventory staff write tx" ON public.inventory_transactions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.inventory_items it WHERE it.id = item_id AND it.clinic_id = public.current_clinic_id())
    AND public.has_any_role(auth.uid(), ARRAY['clinic_admin','pharmacist','lab_tech','nurse']::public.app_role[])
  );

-- NOTIFICATIONS: recipient sees their own, can mark as read
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid());

-- AUDIT LOGS: append-only; admins can view their clinic's
CREATE POLICY "Admin view audit" ON public.audit_logs FOR SELECT
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- TEMPLATES
CREATE POLICY "Clinic members view templates" ON public.templates FOR SELECT
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "Admins manage templates" ON public.templates FOR ALL
  USING (clinic_id = public.current_clinic_id() AND public.is_clinic_admin())
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.is_clinic_admin());

-- ============================================================
-- HELPER FUNCTIONS for app logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_mrn() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'; result TEXT := 'MRN-'; i INT;
BEGIN
  FOR i IN 1..8 LOOP result := result || substr(chars, (random()*length(chars))::int+1, 1); END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_referral_number() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result TEXT := 'REF-'; i INT;
BEGIN
  result := result || to_char(now(),'YYYYMMDD') || '-';
  FOR i IN 1..6 LOOP result := result || substr(chars, (random()*length(chars))::int+1, 1); END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE chars TEXT := '0123456789'; result TEXT := 'INV-'; i INT;
BEGIN
  result := result || to_char(now(),'YYYYMM') || '-';
  FOR i IN 1..6 LOOP result := result || substr(chars, (random()*length(chars))::int+1, 1); END LOOP;
  RETURN result;
END; $$;
