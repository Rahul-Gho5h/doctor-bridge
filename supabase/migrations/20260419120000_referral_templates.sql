-- Referral templates: doctors save reusable referral presets
create table if not exists public.referral_templates (
  id               uuid primary key default gen_random_uuid(),
  doctor_id        uuid not null references public.doctor_profiles(id) on delete cascade,
  name             text not null,                         -- e.g. "Cardiology – Routine angina"
  specialist_id    uuid references public.doctor_profiles(id) on delete set null,
  condition_code   text,
  diagnosis        text,
  urgency          text not null default 'ROUTINE'
                     check (urgency in ('ROUTINE','SEMI_URGENT','URGENT')),
  clinical_summary text,
  referral_reason  text,
  use_count        integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger referral_templates_updated_at
  before update on public.referral_templates
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.referral_templates enable row level security;

-- Doctors can only see and manage their own templates
create policy "templates_select_own"
  on public.referral_templates for select
  using (
    doctor_id = (
      select id from public.doctor_profiles where user_id = auth.uid() limit 1
    )
  );

create policy "templates_insert_own"
  on public.referral_templates for insert
  with check (
    doctor_id = (
      select id from public.doctor_profiles where user_id = auth.uid() limit 1
    )
  );

create policy "templates_update_own"
  on public.referral_templates for update
  using (
    doctor_id = (
      select id from public.doctor_profiles where user_id = auth.uid() limit 1
    )
  );

create policy "templates_delete_own"
  on public.referral_templates for delete
  using (
    doctor_id = (
      select id from public.doctor_profiles where user_id = auth.uid() limit 1
    )
  );
