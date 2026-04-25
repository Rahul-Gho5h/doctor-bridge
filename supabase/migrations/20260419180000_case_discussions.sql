-- Group case discussions
-- Any doctor can open a multi-participant discussion thread on a referral.
-- Other doctors can be invited to join and post comments.

create table if not exists public.case_discussions (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references public.referrals(id) on delete cascade,
  created_by   uuid not null references auth.users(id),
  title        text not null,
  description  text,
  status       text not null default 'OPEN' check (status in ('OPEN','RESOLVED','ARCHIVED')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger case_discussions_updated_at
  before update on public.case_discussions
  for each row execute procedure public.set_updated_at();

-- Participants (doctors invited to the discussion)
create table if not exists public.case_discussion_participants (
  id              uuid primary key default gen_random_uuid(),
  discussion_id   uuid not null references public.case_discussions(id) on delete cascade,
  user_id         uuid not null references auth.users(id),
  display_name    text not null,
  specialization  text,
  joined_at       timestamptz not null default now(),
  constraint unique_participant unique (discussion_id, user_id)
);

-- Messages/comments in the discussion
create table if not exists public.case_discussion_messages (
  id             uuid primary key default gen_random_uuid(),
  discussion_id  uuid not null references public.case_discussions(id) on delete cascade,
  sender_id      uuid not null references auth.users(id),
  sender_name    text not null,
  message        text not null,
  created_at     timestamptz not null default now()
);

create index if not exists case_discussion_messages_discussion_idx
  on public.case_discussion_messages (discussion_id, created_at);

-- RLS
alter table public.case_discussions enable row level security;
alter table public.case_discussion_participants enable row level security;
alter table public.case_discussion_messages enable row level security;

-- Discussions: visible to all authenticated users for discovery;
-- in practice filter by participation in your app
create policy "discussions_select_auth"
  on public.case_discussions for select to authenticated using (true);

create policy "discussions_insert_auth"
  on public.case_discussions for insert to authenticated
  with check (created_by = auth.uid());

create policy "discussions_update_own"
  on public.case_discussions for update
  using (created_by = auth.uid());

-- Participants
create policy "participants_select_auth"
  on public.case_discussion_participants for select to authenticated using (true);

create policy "participants_insert_auth"
  on public.case_discussion_participants for insert to authenticated
  with check (user_id = auth.uid());

create policy "participants_insert_creator"
  on public.case_discussion_participants for insert to authenticated
  with check (
    discussion_id in (
      select id from public.case_discussions where created_by = auth.uid()
    )
  );

-- Messages: participants can post
create policy "messages_select_auth"
  on public.case_discussion_messages for select to authenticated using (true);

create policy "messages_insert_auth"
  on public.case_discussion_messages for insert to authenticated
  with check (sender_id = auth.uid());
