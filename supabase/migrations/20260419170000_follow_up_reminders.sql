-- Follow-up & outcome reminders
-- Any party on a referral can set a reminder. On the due date the client
-- fires a notification and marks the reminder as delivered.

create table if not exists public.follow_up_reminders (
  id             uuid primary key default gen_random_uuid(),
  referral_id    uuid not null references public.referrals(id) on delete cascade,
  created_by     uuid not null references auth.users(id),
  remind_at      timestamptz not null,
  reminder_type  text not null default 'FOLLOW_UP'
                   check (reminder_type in ('FOLLOW_UP','OUTCOME_DUE','APPOINTMENT_REMINDER','CUSTOM')),
  message        text not null,
  fired_at       timestamptz,           -- null = not yet delivered
  created_at     timestamptz not null default now()
);

create index if not exists follow_up_reminders_due_idx
  on public.follow_up_reminders (created_by, remind_at)
  where fired_at is null;

-- RLS
alter table public.follow_up_reminders enable row level security;

create policy "reminders_select_own"
  on public.follow_up_reminders for select
  to authenticated
  using (created_by = auth.uid());

create policy "reminders_insert_own"
  on public.follow_up_reminders for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "reminders_update_own"
  on public.follow_up_reminders for update
  to authenticated
  using (created_by = auth.uid());

create policy "reminders_delete_own"
  on public.follow_up_reminders for delete
  to authenticated
  using (created_by = auth.uid());
