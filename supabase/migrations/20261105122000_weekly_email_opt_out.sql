-- Weekly Action-of-the-Week emails must let people opt out (US CAN-SPAM).
-- People unsubscribe by replying "unsubscribe"; the weekly run records it here
-- and leaves them off the next send.
alter table public.profiles
  add column if not exists weekly_email_opt_out boolean not null default false;

comment on column public.profiles.weekly_email_opt_out is
  'True once the person has asked to stop the weekly Action-of-the-Week email.';
