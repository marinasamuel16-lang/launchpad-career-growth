-- ============================================================
-- Actions of the Week
-- Themes tied to podcast episodes + the actions users take.
-- Cadence-independent: the live theme is whichever row has
-- is_active = true, never a calculated date range.
-- ============================================================

-- ---------- Roles (needed for admin-only publishing) ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'moderator', 'user');
  end if;
end $$;

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security-definer so RLS policies can call it without recursing.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles
  for select using (auth.uid() = user_id);

drop policy if exists "admins read all roles" on public.user_roles;
create policy "admins read all roles" on public.user_roles
  for select using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------- weekly_themes ----------

create table if not exists public.weekly_themes (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  subtitle       text,
  episode_number int,
  episode_url    text,
  guest_name     text,
  summary        text not null default '',
  key_advice     text[] not null default '{}',
  accent_color   text,
  is_active      boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.weekly_themes enable row level security;

-- Only one theme can be live at a time.
create unique index if not exists weekly_themes_single_active
  on public.weekly_themes (is_active)
  where is_active;

create index if not exists weekly_themes_published_at_idx
  on public.weekly_themes (published_at desc nulls last);

drop policy if exists "themes readable by authenticated" on public.weekly_themes;
create policy "themes readable by authenticated" on public.weekly_themes
  for select to authenticated using (true);

drop policy if exists "admins manage themes" on public.weekly_themes;
create policy "admins manage themes" on public.weekly_themes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------- weekly_actions ----------

create table if not exists public.weekly_actions (
  id          uuid primary key default gen_random_uuid(),
  theme_id    uuid not null references public.weekly_themes(id) on delete cascade,
  title       text not null,
  description text,
  difficulty  text not null default 'medium'
              check (difficulty in ('easy', 'medium', 'stretch')),
  xp_reward   int not null default 50 check (xp_reward >= 0 and xp_reward <= 500),
  sort_order  int not null default 0
);

alter table public.weekly_actions enable row level security;

create index if not exists weekly_actions_theme_idx
  on public.weekly_actions (theme_id, sort_order);

drop policy if exists "actions readable by authenticated" on public.weekly_actions;
create policy "actions readable by authenticated" on public.weekly_actions
  for select to authenticated using (true);

drop policy if exists "admins manage actions" on public.weekly_actions;
create policy "admins manage actions" on public.weekly_actions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------- user_action_completions ----------

create table if not exists public.user_action_completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  action_id    uuid not null references public.weekly_actions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  reflection   text,
  unique (user_id, action_id)
);

alter table public.user_action_completions enable row level security;

create index if not exists user_action_completions_user_idx
  on public.user_action_completions (user_id);

drop policy if exists "own completions select" on public.user_action_completions;
create policy "own completions select" on public.user_action_completions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own completions insert" on public.user_action_completions;
create policy "own completions insert" on public.user_action_completions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own completions update" on public.user_action_completions;
create policy "own completions update" on public.user_action_completions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own completions delete" on public.user_action_completions;
create policy "own completions delete" on public.user_action_completions
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- publish_theme(): atomic swap of the live theme ----------

create or replace function public.publish_theme(p_theme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can publish a theme';
  end if;

  update public.weekly_themes
     set is_active = false
   where is_active and id <> p_theme_id;

  update public.weekly_themes
     set is_active    = true,
         published_at = coalesce(published_at, now())
   where id = p_theme_id;
end;
$$;

-- ---------- completion counts (social proof, without leaking rows) ----------
-- RLS keeps users from reading each other's completions, so aggregate
-- counts come from a security-definer function that returns numbers only.

create or replace function public.action_completion_counts(p_theme_id uuid)
returns table (action_id uuid, completions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.action_id, count(*)::bigint
    from public.user_action_completions c
    join public.weekly_actions a on a.id = c.action_id
   where a.theme_id = p_theme_id
   group by c.action_id;
$$;

create or replace function public.admin_theme_stats()
returns table (
  theme_id     uuid,
  completions  bigint,
  participants bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select a.theme_id,
         count(c.id)::bigint,
         count(distinct c.user_id)::bigint
    from public.weekly_actions a
    left join public.user_action_completions c on c.action_id = a.id
   where public.has_role(auth.uid(), 'admin')
   group by a.theme_id;
$$;

grant execute on function public.publish_theme(uuid)            to authenticated;
grant execute on function public.action_completion_counts(uuid) to authenticated;
grant execute on function public.admin_theme_stats()            to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ---------- Allow 'weekly_action' as an XP event kind ----------
-- xp_events.kind currently allows only task/milestone/step/daily_checkin.

alter table public.xp_events drop constraint if exists xp_events_kind_check;
alter table public.xp_events add constraint xp_events_kind_check
  check (kind = any (array['task', 'milestone', 'step', 'daily_checkin', 'weekly_action']));

-- ---------- Seed: make the podcast owner an admin ----------
-- Safe to run before the account exists; re-run this block later if so.

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
  from auth.users
 where lower(email) = 'launchpadeic@gmail.com'
on conflict (user_id, role) do nothing;

-- ---------- Seed: Episode 5 ----------

do $$
declare
  v_theme_id uuid;
begin
  if not exists (select 1 from public.weekly_themes) then
    insert into public.weekly_themes
      (title, subtitle, episode_number, guest_name, summary, key_advice, is_active, published_at)
    values (
      'Climbing the Corporate Ladder',
      'How to Become a VP',
      5,
      'Michael Cutri, CFA — VP at PGIM Credit',
      'Getting to VP isn''t about waiting your turn. This week''s conversation breaks down what actually moves you up: who knows your name, how you advocate for yourself, and being genuinely excellent at the work.',
      array['Network intentionally', 'Speak up for yourself', 'Stay competitive', 'Get exceptional at your job'],
      true,
      now()
    )
    returning id into v_theme_id;

    insert into public.weekly_actions (theme_id, title, description, difficulty, xp_reward, sort_order)
    values (
      v_theme_id,
      'Network with one new person at your company this week.',
      'Pick someone outside your immediate team, ideally a level or two above you. Send a short message asking for 15 minutes to hear how they got where they are. No agenda, no ask — just curiosity.',
      'medium',
      50,
      0
    );
  end if;
end $$;
