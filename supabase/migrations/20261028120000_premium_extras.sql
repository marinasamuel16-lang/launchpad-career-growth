-- Premium extras (Oct 28, 2026):
--   1. Review Season Pack — turns Career Memory into a self-review, resume
--      bullets, a LinkedIn post and talking points (review_packs).
--   2. Members' bonus answer — each Leader Drop can include one optional bonus
--      question. Members see the answer first; after a set number of days it
--      unlocks for everyone, so no guest's answer goes unseen (member_bonuses).
--   3. Playbooks — a written playbook for each episode (playbooks).
--
-- Who counts as a member: an active, unexpired subscription, or an admin
-- (the owner accounts see everything).

create or replace function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_user is not null and (
    exists (
      select 1 from public.subscriptions s
       where s.user_id = p_user
         and s.status = 'active'
         and (s.current_period_end is null or s.current_period_end > now())
    )
    or public.has_role(p_user, 'admin'::app_role)
  );
$function$;
revoke all on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated, service_role;

/* ------------------------------------------------------------------ */
/* Bonus question on Leader Drops                                      */
/* ------------------------------------------------------------------ */

alter table public.leader_drop_invites
  add column if not exists bonus_question text
    default 'What''s one unwritten rule of getting ahead that nobody told you early on?';

alter table public.leader_drops
  add column if not exists bonus_question text,
  add column if not exists bonus_video_url text;

do $$ begin
  alter table public.leader_drop_invites
    add constraint leader_drop_invites_bonus_question_check
    check (bonus_question is null or char_length(bonus_question) <= 300);
exception when duplicate_object then null; end $$;

-- The recording page also gets the (optional) bonus question.
create or replace function public.ld_get_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare i public.leader_drop_invites;
declare c text := lower(btrim(coalesce(p_code, '')));
declare v_preview boolean := false;
begin
  if c ~ '-preview$' then
    v_preview := true;
    c := regexp_replace(c, '-preview$', '');
  end if;
  if c ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into i from public.leader_drop_invites where id = c::uuid;
  elsif c ~ '^[a-z0-9-]{3,60}$' then
    select * into i from public.leader_drop_invites where slug = c;
  end if;
  if i.id is null then return null; end if;
  if i.format = 'live' then
    return jsonb_build_object('format', 'live', 'slug', i.slug, 'preview', v_preview);
  end if;
  if not v_preview and i.sent_at is not null and i.first_opened_at is null then
    update public.leader_drop_invites set first_opened_at = now() where id = i.id;
  end if;
  return jsonb_build_object(
    'format', 'drop',
    'invite_id', case when v_preview then '00000000-0000-4000-8000-0000000000aa'::uuid else i.id end,
    'slug', i.slug,
    'leader_name', i.leader_name,
    'title', i.title,
    'company', i.company,
    'linkedin', i.linkedin,
    'questions', jsonb_build_array(i.question_1, i.question_2, i.question_3),
    'bonus_question', nullif(btrim(coalesce(i.bonus_question, '')), ''),
    'submitted', i.submitted_at is not null,
    'preview', v_preview
  );
end $function$;

-- Same as before, plus an optional bonus answer video.
create or replace function public.ld_submit(p_invite uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  i public.leader_drop_invites;
  v_prefix text := p_invite::text || '/';
  v_paths text[];
  v_path text;
  v_id uuid;
  v_name text;
  v_title text;
  v_company text;
  v_linkedin text;
  v_bio text := nullif(btrim(coalesce(p->>'bio','')),'');
  v_one_drop text := nullif(btrim(coalesce(p->>'one_drop','')),'');
  v_one_drop_video text := nullif(p->>'one_drop_video_url','');
  v_headshot text := nullif(p->>'headshot_url','');
  v_bonus_video text := nullif(p->>'bonus_video_url','');
begin
  select * into i from public.leader_drop_invites where id = p_invite for update;
  if not found then raise exception 'invalid_link'; end if;
  if i.submitted_at is not null then raise exception 'already_submitted'; end if;
  if coalesce((p->>'permission_granted')::boolean, false) is not true then
    raise exception 'permission_required';
  end if;
  -- Leaders only type these if they want to correct what we pre-filled.
  v_name     := coalesce(nullif(btrim(coalesce(p->>'name','')),''),    i.leader_name);
  v_title    := coalesce(nullif(btrim(coalesce(p->>'title','')),''),   i.title, '');
  v_company  := coalesce(nullif(btrim(coalesce(p->>'company','')),''), i.company, '');
  v_linkedin := coalesce(nullif(btrim(coalesce(p->>'linkedin','')),''), i.linkedin);
  if v_name = '' or v_title = '' or v_company = '' then raise exception 'missing_details'; end if;
  if char_length(v_name) > 120 or char_length(v_title) > 160 or char_length(v_company) > 160
     or char_length(coalesce(v_linkedin,'')) > 300 or char_length(coalesce(v_one_drop,'')) > 400
     or char_length(coalesce(v_bio,'')) > 600 then
    raise exception 'too_long';
  end if;
  if v_linkedin is not null and v_linkedin !~* '^(https?://)?([a-z0-9-]+\.)?linkedin\.com/' then
    raise exception 'bad_linkedin';
  end if;
  if v_one_drop is null and v_one_drop_video is null then raise exception 'one_drop_required'; end if;
  -- A bonus answer only counts if this invite actually asked a bonus question.
  if nullif(btrim(coalesce(i.bonus_question, '')), '') is null then v_bonus_video := null; end if;

  v_paths := array[p->>'video_1_url', p->>'video_2_url', p->>'video_3_url'];
  if v_one_drop_video is not null then v_paths := v_paths || v_one_drop_video; end if;
  if v_headshot is not null then v_paths := v_paths || v_headshot; end if;
  if v_bonus_video is not null then v_paths := v_paths || v_bonus_video; end if;
  foreach v_path in array v_paths loop
    if v_path is null or left(v_path, length(v_prefix)) <> v_prefix
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'leader-drops' and o.name = v_path) then
      raise exception 'missing_upload';
    end if;
  end loop;

  insert into public.leader_drops (
    invite_id, name, title, company, linkedin, intro_name, intro_line, bio,
    question_1, video_1_url, question_2, video_2_url, question_3, video_3_url,
    one_drop, one_drop_video_url, headshot_url,
    bonus_question, bonus_video_url,
    permission_granted, permission_text
  ) values (
    p_invite, v_name, v_title, v_company, v_linkedin,
    left(coalesce(nullif(btrim(coalesce(p->>'intro_name','')),''), v_name), 120),
    left(coalesce(nullif(btrim(coalesce(p->>'intro_line','')),''), v_title || ' • ' || v_company), 240),
    v_bio,
    i.question_1, v_paths[1], i.question_2, v_paths[2], i.question_3, v_paths[3],
    v_one_drop, v_one_drop_video, v_headshot,
    case when v_bonus_video is not null then i.bonus_question end, v_bonus_video,
    true, left(coalesce(p->>'permission_text',''), 2000)
  ) returning leader_id into v_id;

  update public.leader_drop_invites
     set submitted_at = now(), started_at = coalesce(started_at, now())
   where id = p_invite;
  return jsonb_build_object('leader_id', v_id, 'first_name', split_part(v_name, ' ', 1));
end $function$;

-- Admins can upload an edited bonus clip (under bonus/) to the same private bucket.
do $$ begin
  create policy "ld admin upload" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'leader-drops' and public.has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

/* ------------------------------------------------------------------ */
/* Members' bonus answers                                              */
/* ------------------------------------------------------------------ */

create table if not exists public.member_bonuses (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid references public.leader_drops(leader_id) on delete set null,
  youtube_video_id text,
  guest_name text not null check (char_length(guest_name) <= 120),
  guest_role text check (guest_role is null or char_length(guest_role) <= 200),
  question text not null check (char_length(question) <= 300),
  -- Path inside the private leader-drops bucket. Played through a short-lived
  -- signed link that the server only hands out to members, or to everyone
  -- once public_at has passed.
  video_path text not null check (char_length(video_path) <= 500),
  members_only_days integer not null default 14 check (members_only_days between 0 and 90),
  published_at timestamptz,
  public_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists member_bonuses_leader_key on public.member_bonuses (leader_id) where leader_id is not null;

alter table public.member_bonuses enable row level security;

drop policy if exists "bonuses admin all" on public.member_bonuses;
create policy "bonuses admin all" on public.member_bonuses
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

-- Everyone signed in can see that a bonus exists (that's the teaser); the video
-- itself stays locked behind the server's signed link.
drop policy if exists "bonuses readable when published" on public.member_bonuses;
create policy "bonuses readable when published" on public.member_bonuses
  for select to authenticated
  using (published_at is not null and published_at <= now());

/* ------------------------------------------------------------------ */
/* Playbooks                                                           */
/* ------------------------------------------------------------------ */

create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text,
  episode_title text check (episode_title is null or char_length(episode_title) <= 300),
  guest_name text not null check (char_length(guest_name) <= 120),
  guest_role text check (guest_role is null or char_length(guest_role) <= 200),
  title text not null check (char_length(title) <= 160),
  hook text check (hook is null or char_length(hook) <= 300),
  -- { lessons:[{title,body}], scripts:[{situation,say}], this_week:[text],
  --   mistakes:[text], one_drop:text }
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists playbooks_video_key on public.playbooks (youtube_video_id) where youtube_video_id is not null;

alter table public.playbooks enable row level security;

drop policy if exists "playbooks admin all" on public.playbooks;
create policy "playbooks admin all" on public.playbooks
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "playbooks members read" on public.playbooks;
create policy "playbooks members read" on public.playbooks
  for select to authenticated
  using (status = 'published' and public.is_premium(auth.uid()));

-- What a free user sees: the title, the hook and how much is inside.
create or replace function public.playbook_teasers()
returns table (
  id uuid,
  youtube_video_id text,
  episode_title text,
  guest_name text,
  guest_role text,
  title text,
  hook text,
  lesson_count integer,
  script_count integer,
  first_lesson_title text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.id, p.youtube_video_id, p.episode_title, p.guest_name, p.guest_role,
         p.title, p.hook,
         coalesce(jsonb_array_length(case when jsonb_typeof(p.content->'lessons') = 'array' then p.content->'lessons' end), 0),
         coalesce(jsonb_array_length(case when jsonb_typeof(p.content->'scripts') = 'array' then p.content->'scripts' end), 0),
         p.content->'lessons'->0->>'title',
         p.published_at
    from public.playbooks p
   where p.status = 'published' and auth.uid() is not null
   order by p.published_at desc nulls last;
$function$;
revoke all on function public.playbook_teasers() from public, anon;
grant execute on function public.playbook_teasers() to authenticated;

/* ------------------------------------------------------------------ */
/* Review Season Packs                                                 */
/* ------------------------------------------------------------------ */

create table if not exists public.review_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('this_year', 'last_6_months', 'last_90_days')),
  period_start date not null,
  period_end date not null,
  entries_used integer not null default 0,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists review_packs_user_idx on public.review_packs (user_id, created_at desc);

alter table public.review_packs enable row level security;

drop policy if exists "review packs read own" on public.review_packs;
create policy "review packs read own" on public.review_packs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "review packs members insert own" on public.review_packs;
create policy "review packs members insert own" on public.review_packs
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

drop policy if exists "review packs delete own" on public.review_packs;
create policy "review packs delete own" on public.review_packs
  for delete to authenticated using (auth.uid() = user_id);

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end $function$;

drop trigger if exists member_bonuses_touch on public.member_bonuses;
create trigger member_bonuses_touch before update on public.member_bonuses
  for each row execute function public.touch_updated_at();
drop trigger if exists playbooks_touch on public.playbooks;
create trigger playbooks_touch before update on public.playbooks
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.member_bonuses to authenticated;
grant select, insert, update, delete on public.playbooks to authenticated;
grant select, insert, delete on public.review_packs to authenticated;
