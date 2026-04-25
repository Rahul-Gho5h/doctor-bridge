-- Appointment date on referrals
-- When a specialist accepts a referral they can propose (or confirm) an appointment date.

alter table public.referrals
  add column if not exists appointment_date  timestamptz,
  add column if not exists appointment_notes text;

comment on column public.referrals.appointment_date  is 'Proposed/confirmed appointment datetime set by the specialist after accepting';
comment on column public.referrals.appointment_notes is 'Any instructions for the patient or referring doctor regarding the appointment';
