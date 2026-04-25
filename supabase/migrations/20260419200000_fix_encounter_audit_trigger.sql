-- Fix tg_log_encounter_edit to handle NULL auth.uid() gracefully.
-- When called without an auth session (e.g. seed scripts, service-role inserts),
-- fall back to the doctor_user_id column on the row itself.
-- If that is also NULL (shouldn't happen in practice), skip the audit log row.

CREATE OR REPLACE FUNCTION public.tg_log_encounter_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_editor_id   uuid;
  v_editor_name text;
BEGIN
  -- Prefer the authenticated user; fall back to the row's own doctor
  v_editor_id := COALESCE(
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN OLD.doctor_user_id ELSE NEW.doctor_user_id END
  );

  -- If we still have no actor (e.g. direct DB import with no user_id), skip audit
  IF v_editor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT first_name || ' ' || last_name INTO v_editor_name
    FROM public.profiles WHERE id = v_editor_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.encounter_edits(
      encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, after_data
    ) VALUES (
      NEW.id, NEW.global_patient_id, v_editor_id,
      COALESCE(v_editor_name, 'system'), 'CREATE', to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.encounter_edits(
      encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, before_data, after_data
    ) VALUES (
      NEW.id, NEW.global_patient_id, v_editor_id,
      COALESCE(v_editor_name, 'system'), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.encounter_edits(
      encounter_id, global_patient_id, edited_by_user_id, edited_by_name, action, before_data
    ) VALUES (
      OLD.id, OLD.global_patient_id, v_editor_id,
      COALESCE(v_editor_name, 'system'), 'DELETE', to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;
