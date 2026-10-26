-- Guest leads: people Marina might invite onto LaunchPad EIC.
-- Managed from the Leader Drops admin (/admin → Leads). Admins only.
create table if not exists public.guest_leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 1 and 120),
  title         text,
  company       text,
  linkedin      text,
  email         text,
  source        text,          -- how we found / know them
  topic         text,          -- episode idea or angle
  notes         text,
  status        text not null default 'New'
                check (status in ('New', 'Contacted', 'Invited', 'Recorded', 'Not now')),
  format        text check (format in ('leader_drop', 'live')),
  invite_id     uuid references public.leader_drop_invites(id) on delete set null,
  live_invited_at timestamptz,
  live_date     date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists guest_leads_created_idx on public.guest_leads (created_at desc);

alter table public.guest_leads enable row level security;

drop policy if exists "guest leads admin all" on public.guest_leads;
create policy "guest leads admin all" on public.guest_leads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.guest_leads_touch()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists guest_leads_touch on public.guest_leads;
create trigger guest_leads_touch before update on public.guest_leads
  for each row execute function public.guest_leads_touch();
