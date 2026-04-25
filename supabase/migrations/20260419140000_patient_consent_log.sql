-- Patient consent log
-- Records informed consent given by patients (or guardians) for procedures,
-- referrals, data sharing, research, etc.
-- DPDP Act requirement: consent must be recorded and auditable.

create table if not exists public.patient_consents (
  id                 uuid primary key default gen_random_uuid(),
  global_patient_id  uuid not null references public.global_patients(id) on delete cascade,
  consent_type       text not null
                       check (consent_type in ('PROCEDURE','REFERRAL','DATA_SHARING','RESEARCH','OTHER')),
  title              text not null,
  details            text,
  consent_method     text not null default 'VERBAL'
                       check (consent_method in ('VERBAL','WRITTEN','DIGITAL')),
  consented_by       text not null default 'PATIENT'
                       check (consented_by in ('PATIENT','GUARDIAN','CAREGIVER')),
  recorded_by_user_id uuid not null references auth.users(id),
  recorded_by_name   text not null,
  recorded_at        timestamptz not null default now(),
  valid_until        date,                     -- null = indefinite
  revoked_at         timestamptz,
  revocation_reason  text,
  created_at         timestamptz not null default now()
);

-- Index for quick per-patient lookup
create index if not exists patient_consents_patient_idx
  on public.patient_consents (global_patient_id, recorded_at desc);

-- RLS: any authenticated user can view consents for patients they have access to.
-- For simplicity (matching global_patients policy) we allow all authenticated users.
alter table public.patient_consents enable row level security;

create policy "consents_select_authenticated"
  on public.patient_consents for select
  to authenticated
  using (true);

create policy "consents_insert_own"
  on public.patient_consents for insert
  to authenticated
  with check (recorded_by_user_id = auth.uid());

-- Only the recorder can update (e.g., revoke)
create policy "consents_update_own"
  on public.patient_consents for update
  to authenticated
  using (recorded_by_user_id = auth.uid());

-- Hard-delete not allowed — use revoke instead; but allow for data correction
create policy "consents_delete_own"
  on public.patient_consents for delete
  to authenticated
  using (recorded_by_user_id = auth.uid());
