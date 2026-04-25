-- Doctor weekly availability slots
-- Doctors configure which days and hours they're available to see referred patients.
-- Each row = one active day-of-week slot for a doctor.
-- The appointment app (future) reads this table to show bookable times.

create table if not exists public.doctor_availability (
  id               uuid primary key default gen_random_uuid(),
  doctor_id        uuid not null references public.doctor_profiles(id) on delete cascade,
  day_of_week      smallint not null
                     check (day_of_week between 0 and 6),  -- 0=Sun, 1=Mon, …, 6=Sat
  start_time       time not null,
  end_time         time not null,
  slot_duration_min smallint not null default 30,           -- consultation slot length
  max_slots        smallint not null default 10,            -- max bookings per day
  is_active        boolean not null default true,
  notes            text,                                     -- e.g. "Morning only — afternoon reserved for surgery"
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint valid_times check (end_time > start_time),
  constraint unique_doctor_day unique (doctor_id, day_of_week)
);

-- Trigger for updated_at
create trigger doctor_availability_updated_at
  before update on public.doctor_availability
  for each row execute procedure public.set_updated_at();

-- Doctor leave / blocked dates
create table if not exists public.doctor_leave (
  id               uuid primary key default gen_random_uuid(),
  doctor_id        uuid not null references public.doctor_profiles(id) on delete cascade,
  leave_date       date not null,
  reason           text,
  created_at       timestamptz not null default now(),
  constraint unique_doctor_leave unique (doctor_id, leave_date)
);

-- RLS for doctor_availability
alter table public.doctor_availability enable row level security;

-- Any authenticated user can see availability (needed for appointment booking)
create policy "availability_select_all"
  on public.doctor_availability for select
  to authenticated using (true);

-- Only the doctor can manage their own schedule
create policy "availability_insert_own"
  on public.doctor_availability for insert
  with check (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

create policy "availability_update_own"
  on public.doctor_availability for update
  using (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

create policy "availability_delete_own"
  on public.doctor_availability for delete
  using (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

-- RLS for doctor_leave
alter table public.doctor_leave enable row level security;

create policy "leave_select_all"
  on public.doctor_leave for select
  to authenticated using (true);

create policy "leave_insert_own"
  on public.doctor_leave for insert
  with check (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );

create policy "leave_delete_own"
  on public.doctor_leave for delete
  using (
    doctor_id = (select id from public.doctor_profiles where user_id = auth.uid() limit 1)
  );
