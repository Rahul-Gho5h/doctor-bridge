-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- It marks the 9 locally-applied migrations as "applied" in the remote history
-- so that `supabase db push` stops trying to re-run them.

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20260419120000', '20260419120000_referral_templates', NULL),
  ('20260419130000', '20260419130000_referral_type_second_opinion', NULL),
  ('20260419140000', '20260419140000_patient_consent_log', NULL),
  ('20260419150000', '20260419150000_doctor_availability', NULL),
  ('20260419160000', '20260419160000_referral_appointment_date', NULL),
  ('20260419170000', '20260419170000_follow_up_reminders', NULL),
  ('20260419180000', '20260419180000_case_discussions', NULL),
  ('20260419190000', '20260419190000_cme_cpd_log', NULL),
  ('20260419200000', '20260419200000_fix_encounter_audit_trigger', NULL)
ON CONFLICT (version) DO NOTHING;
