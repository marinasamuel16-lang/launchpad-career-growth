-- Members' bonus answers can be an unlisted YouTube video instead of an uploaded clip.
--
-- Everyone signed in can read member_bonuses (that's the locked teaser card), so
-- the YouTube video's ID is NOT kept there. It lives in member_bonus_youtube,
-- which only admins can read. The server looks it up and hands it out only to
-- members (or to everyone once a bonus has been made free).
--
-- A bonus can also stay members-only for good: publish it with public_at left
-- empty and it never unlocks for free accounts.

alter table public.member_bonuses alter column video_path drop not null;

alter table public.member_bonuses
  add column if not exists video_source text not null default 'file';
do $$ begin
  alter table public.member_bonuses
    add constraint member_bonuses_video_source_check check (video_source in ('file', 'youtube'));
exception when duplicate_object then null; end $$;

create table if not exists public.member_bonus_youtube (
  bonus_id uuid primary key references public.member_bonuses(id) on delete cascade,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  updated_at timestamptz not null default now()
);

alter table public.member_bonus_youtube enable row level security;

drop policy if exists "bonus youtube admin all" on public.member_bonus_youtube;
create policy "bonus youtube admin all" on public.member_bonus_youtube
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on public.member_bonus_youtube from anon, public;
grant select, insert, update, delete on public.member_bonus_youtube to authenticated;
