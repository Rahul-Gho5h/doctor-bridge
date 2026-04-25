-- Add referral_type to distinguish standard referrals from second-opinion requests
alter table public.referrals
  add column if not exists referral_type text not null default 'REFERRAL'
    check (referral_type in ('REFERRAL', 'SECOND_OPINION'));

comment on column public.referrals.referral_type is
  'REFERRAL = standard treatment referral; SECOND_OPINION = request for a second diagnostic/treatment opinion';
