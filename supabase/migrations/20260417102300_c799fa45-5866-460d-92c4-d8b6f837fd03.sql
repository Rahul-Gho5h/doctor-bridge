-- 1) Private storage bucket for medical files
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-files', 'medical-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only doctors with patient access can read/write
-- Path convention: {global_patient_id}/{filename}
CREATE POLICY "Doctors with patient access read medical files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'medical-files'
  AND public.has_patient_access(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Doctors with patient access upload medical files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medical-files'
  AND public.has_patient_access(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Owner deletes own medical files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'medical-files'
  AND owner = auth.uid()
);

-- 2) Notification preferences table (per-user)
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  email_referrals boolean NOT NULL DEFAULT true,
  email_messages boolean NOT NULL DEFAULT true,
  email_affiliations boolean NOT NULL DEFAULT true,
  inapp_referrals boolean NOT NULL DEFAULT true,
  inapp_messages boolean NOT NULL DEFAULT true,
  inapp_affiliations boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prefs" ON public.notification_preferences
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users insert own prefs" ON public.notification_preferences
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own prefs" ON public.notification_preferences
FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_notification_prefs_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Read receipts on direct_messages (already has read_at column — add helper RPC)
CREATE OR REPLACE FUNCTION public.mark_thread_read(_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.direct_messages
    SET read_at = now()
    WHERE thread_id = _thread_id
      AND sender_id <> auth.uid()
      AND read_at IS NULL;
END;
$$;

-- 4) Ensure encounter audit trigger is wired (referenced in tg_log_encounter_edit but never attached)
DROP TRIGGER IF EXISTS tg_patient_encounter_audit ON public.patient_encounters;
CREATE TRIGGER tg_patient_encounter_audit
AFTER INSERT OR UPDATE OR DELETE ON public.patient_encounters
FOR EACH ROW EXECUTE FUNCTION public.tg_log_encounter_edit();

-- 5) Bump thread last_message_at when a DM is sent (helper exists, ensure attached)
DROP TRIGGER IF EXISTS tg_dm_bump_thread ON public.direct_messages;
CREATE TRIGGER tg_dm_bump_thread
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_bump_thread();