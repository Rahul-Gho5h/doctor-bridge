-- ============================================================
-- Phase 1: Notification Triggers
-- Auto-insert in-app notifications for key referral events
-- ============================================================

-- Make clinic_id nullable on notifications (referral notifications cross clinics)
ALTER TABLE public.notifications ALTER COLUMN clinic_id DROP NOT NULL;

-- ============================================================
-- TRIGGER 1: Notify specialist when a new referral is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_referral_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_specialist_user_id  UUID;
  v_specialist_clinic   UUID;
  v_ref_first           TEXT;
  v_ref_last            TEXT;
  v_patient_name        TEXT;
BEGIN
  -- Resolve specialist → user_id + clinic_id
  SELECT dp.user_id, p.clinic_id
    INTO v_specialist_user_id, v_specialist_clinic
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
   WHERE dp.id = NEW.specialist_id
   LIMIT 1;

  IF v_specialist_user_id IS NULL THEN RETURN NEW; END IF;

  -- Referring doctor name
  SELECT p.first_name, p.last_name
    INTO v_ref_first, v_ref_last
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
   WHERE dp.id = NEW.referring_doctor_id
   LIMIT 1;

  v_patient_name := COALESCE(NEW.patient_snapshot->>'name', 'a patient');

  INSERT INTO public.notifications
    (clinic_id, recipient_id, type, title, message, data, channel)
  VALUES (
    v_specialist_clinic,
    v_specialist_user_id,
    'NEW_REFERRAL',
    'New referral — ' || COALESCE(NEW.urgency::TEXT, 'ROUTINE'),
    'Dr. ' || COALESCE(v_ref_first,'') || ' ' || COALESCE(v_ref_last,'') ||
    ' referred ' || v_patient_name || ' · ' || NEW.referral_number,
    jsonb_build_object(
      'referral_id', NEW.id,
      'referral_number', NEW.referral_number,
      'urgency', NEW.urgency
    ),
    'IN_APP'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_referral_created ON public.referrals;
CREATE TRIGGER trg_notify_referral_created
  AFTER INSERT ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_referral_created();

-- ============================================================
-- TRIGGER 2: Notify referring doctor when referral status changes
--            (ACCEPTED or DECLINED)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_referral_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref_user_id     UUID;
  v_ref_clinic      UUID;
  v_sp_first        TEXT;
  v_sp_last         TEXT;
  v_patient_name    TEXT;
  v_notif_type      public.notification_type;
  v_title           TEXT;
  v_msg             TEXT;
BEGIN
  -- Only fire when status actually changes to ACCEPTED or DECLINED
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('ACCEPTED', 'DECLINED') THEN RETURN NEW; END IF;

  -- Referring doctor user_id + clinic_id
  SELECT dp.user_id, p.clinic_id
    INTO v_ref_user_id, v_ref_clinic
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
   WHERE dp.id = NEW.referring_doctor_id
   LIMIT 1;

  IF v_ref_user_id IS NULL THEN RETURN NEW; END IF;

  -- Specialist name
  SELECT p.first_name, p.last_name
    INTO v_sp_first, v_sp_last
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
   WHERE dp.id = NEW.specialist_id
   LIMIT 1;

  v_patient_name := COALESCE(NEW.patient_snapshot->>'name', 'the patient');

  IF NEW.status = 'ACCEPTED' THEN
    v_notif_type := 'REFERRAL_ACCEPTED';
    v_title := 'Referral accepted';
    v_msg := 'Dr. ' || COALESCE(v_sp_first,'') || ' ' || COALESCE(v_sp_last,'') ||
             ' accepted your referral for ' || v_patient_name || ' · ' || NEW.referral_number;
  ELSE
    v_notif_type := 'REFERRAL_DECLINED';
    v_title := 'Referral declined';
    v_msg := 'Dr. ' || COALESCE(v_sp_first,'') || ' ' || COALESCE(v_sp_last,'') ||
             ' declined the referral for ' || v_patient_name || ' · ' || NEW.referral_number;
  END IF;

  INSERT INTO public.notifications
    (clinic_id, recipient_id, type, title, message, data, channel)
  VALUES (
    v_ref_clinic,
    v_ref_user_id,
    v_notif_type,
    v_title,
    v_msg,
    jsonb_build_object('referral_id', NEW.id, 'referral_number', NEW.referral_number),
    'IN_APP'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_referral_status ON public.referrals;
CREATE TRIGGER trg_notify_referral_status
  AFTER UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_referral_status_change();

-- ============================================================
-- TRIGGER 3: Notify recipient of a new direct message
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recipient_id    UUID;
  v_recipient_clinic UUID;
  v_sender_first    TEXT;
  v_sender_last     TEXT;
  v_preview         TEXT;
BEGIN
  -- Find the other participant in the thread
  SELECT
    CASE WHEN t.user_a = NEW.sender_id THEN t.user_b ELSE t.user_a END
    INTO v_recipient_id
  FROM public.direct_threads t
  WHERE t.id = NEW.thread_id
  LIMIT 1;

  IF v_recipient_id IS NULL THEN RETURN NEW; END IF;

  -- Recipient clinic
  SELECT clinic_id INTO v_recipient_clinic
    FROM public.profiles WHERE id = v_recipient_id;

  -- Sender name
  SELECT first_name, last_name INTO v_sender_first, v_sender_last
    FROM public.profiles WHERE id = NEW.sender_id;

  -- Message preview (truncate long messages)
  v_preview := CASE
    WHEN NEW.body = '📎 Attachment' THEN 'Shared an attachment'
    WHEN length(NEW.body) > 100 THEN left(NEW.body, 100) || '…'
    ELSE NEW.body
  END;

  INSERT INTO public.notifications
    (clinic_id, recipient_id, sender_id, type, title, message, data, channel)
  VALUES (
    v_recipient_clinic,
    v_recipient_id,
    NEW.sender_id,
    'MESSAGE',
    'Message from Dr. ' || COALESCE(v_sender_first,'') || ' ' || COALESCE(v_sender_last,''),
    v_preview,
    jsonb_build_object('thread_id', NEW.thread_id),
    'IN_APP'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();

-- ============================================================
-- TRIGGER 4: Notify specialist on new referral message
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_referral_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref             RECORD;
  v_recipient_uid   UUID;
  v_recipient_clinic UUID;
  v_sender_first    TEXT;
  v_sender_last     TEXT;
  v_preview         TEXT;
BEGIN
  -- Load referral
  SELECT r.referring_doctor_id, r.specialist_id, r.referral_number, r.patient_snapshot
    INTO v_ref
    FROM public.referrals r WHERE r.id = NEW.referral_id LIMIT 1;

  IF v_ref IS NULL THEN RETURN NEW; END IF;

  -- Determine recipient: the OTHER party from the sender.
  -- Resolve both user_ids, then pick whoever is NOT the sender.
  DECLARE
    v_ref_doctor_uid   UUID;
    v_spec_doctor_uid  UUID;
  BEGIN
    SELECT dp.user_id INTO v_ref_doctor_uid
      FROM public.doctor_profiles dp WHERE dp.id = v_ref.referring_doctor_id LIMIT 1;
    SELECT dp.user_id INTO v_spec_doctor_uid
      FROM public.doctor_profiles dp WHERE dp.id = v_ref.specialist_id LIMIT 1;

    IF NEW.sender_id = v_ref_doctor_uid THEN
      -- Sender is the referring doctor → notify specialist
      SELECT dp.user_id, p.clinic_id
        INTO v_recipient_uid, v_recipient_clinic
        FROM public.doctor_profiles dp
        JOIN public.profiles p ON p.id = dp.user_id
       WHERE dp.id = v_ref.specialist_id LIMIT 1;
    ELSE
      -- Sender is the specialist (or unknown) → notify referring doctor
      SELECT dp.user_id, p.clinic_id
        INTO v_recipient_uid, v_recipient_clinic
        FROM public.doctor_profiles dp
        JOIN public.profiles p ON p.id = dp.user_id
       WHERE dp.id = v_ref.referring_doctor_id LIMIT 1;
    END IF;
  END;

  IF v_recipient_uid IS NULL THEN RETURN NEW; END IF;

  SELECT first_name, last_name INTO v_sender_first, v_sender_last
    FROM public.profiles WHERE id = NEW.sender_id;

  v_preview := CASE
    WHEN length(NEW.message) > 100 THEN left(NEW.message, 100) || '…'
    ELSE NEW.message
  END;

  INSERT INTO public.notifications
    (clinic_id, recipient_id, sender_id, type, title, message, data, channel)
  VALUES (
    v_recipient_clinic,
    v_recipient_uid,
    NEW.sender_id,
    'REFERRAL_MESSAGE',
    'Message on referral ' || v_ref.referral_number,
    'Dr. ' || COALESCE(v_sender_first,'') || ' ' || COALESCE(v_sender_last,'') || ': ' || v_preview,
    jsonb_build_object(
      'referral_id', NEW.referral_id,
      'referral_number', v_ref.referral_number
    ),
    'IN_APP'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_referral_message ON public.referral_messages;
CREATE TRIGGER trg_notify_referral_message
  AFTER INSERT ON public.referral_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_referral_message();

-- Enable realtime on notifications (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
