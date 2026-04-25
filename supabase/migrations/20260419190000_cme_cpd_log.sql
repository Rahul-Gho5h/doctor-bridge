-- CME / CPD activity log
-- Doctors log continuing medical education / continuing professional development credits.
-- NMC India requires 30 CME credits per 5-year renewal cycle.

create table if not exists public.cme_activities (
  id               uuid primary key default gen_random_uuid(),
  doctor_id        uuid not null references public.doctor_profiles(id) on delete cascade,
  activity_type    text not null
                     check (activity_type in (
                       'CONFERENCE','WORKSHOP','WEBINAR','JOURNAL_CLUB',
                       'CASE_PRESENTATION','ONLINE_COURSE','PUBLICATION','OTHER'
                     )),
  title            text not null,
  organizer        text,
  location         text,                  -- city / online
  activity_date    date not null,
  credits          numeric(5,1) not null default 1 check (credits > 0),
  certificate_url  text,                  -- URL of uploaded certificate
  notes            text,
  verified         boolean not null default false,   -- set to true when admin verifies
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger cme_activities_updated_at
  before update on public.cme_activities
  for each row execute procedure public.set_updated_at();

create index if not exists cme_activities_doctor_idx
  on public.cme_activities (doctor_id, activity_date desc);

-- RLS
alter table public.cme_activities enable row level security;

-- Doctors can only see/manage their own activities
create policy "cme_select_own"
  on public.cme_activities for select
  using (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

create policy "cme_insert_own"
  on public.cme_activities for insert
  with check (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

create policy "cme_update_own"
  on public.cme_activities for update
  using (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

create policy "cme_delete_own"
  on public.cme_activities for delete
  using (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );
