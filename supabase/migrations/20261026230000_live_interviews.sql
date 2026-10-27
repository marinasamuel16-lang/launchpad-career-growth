-- Live interviews on the Leader Drops site.
-- An invite is now either a Leader Drop ('drop': the guest records answers on
-- their own) or a live interview ('live': a scheduled conversation). Live guests
-- get a page at launchpad-leader-drops.netlify.app/live/<slug> with the date,
-- calendar buttons, their three questions, and a short details form.
-- Column names match what the earlier live-guests site used, so its data copies
-- straight over.

alter table public.leader_drop_invites
  add column if not exists format text not null default 'drop',
  add column if not exists recording_at timestamptz,
  add column if not exists topic text,
  add column if not exists meeting_url text,
  add column if not exists guest_bio text,
  add column if not exists guest_headshot_url text,
  add column if not exists guest_saved_at timestamptz;

do $$ begin
  alter table public.leader_drop_invites
    add constraint leader_drop_invites_format_check check (format in ('drop', 'live'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.leader_drop_invites
    add constraint leader_drop_invites_topic_check check (topic is null or char_length(topic) <= 200);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.leader_drop_invites
    add constraint leader_drop_invites_meeting_url_check check (meeting_url is null or (char_length(meeting_url) <= 500 and meeting_url ~* '^https?://'));
exception when duplicate_object then null; end $$;

-- Phone alert (ntfy) with a custom tap-through link.
create or replace function public.ld_ping_to(p_title text, p_message text, p_click text, p_priority integer default 4)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare rid bigint;
begin
  select net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object('topic', 'launchpad-drops-9e4f4c2f22f52da4', 'title', p_title, 'message', p_message,
      'tags', jsonb_build_array('studio_microphone'), 'priority', p_priority, 'click', p_click),
    headers := '{"Content-Type":"application/json"}'::jsonb) into rid;
  return rid;
exception when others then return null;
end $function$;
revoke all on function public.ld_ping_to(text, text, text, integer) from public, anon, authenticated;

-- The Leader Drop page asks for an invite by code; tell it the format so a live
-- invite opened through a /drop/ link can move to its /live/ page.
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
    'submitted', i.submitted_at is not null,
    'preview', v_preview
  );
end $function$;

-- Everything the live guest's page shows.
create or replace function public.ld_live_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare i public.leader_drop_invites;
declare c text := lower(btrim(coalesce(p_code, '')));
declare v_preview boolean := false;
begin
  if c ~ '-preview$' then v_preview := true; c := regexp_replace(c, '-preview$', ''); end if;
  if c !~ '^[a-z0-9-]{3,60}$' then return null; end if;
  select * into i from public.leader_drop_invites where slug = c;
  if i.id is null then return null; end if;
  if i.format <> 'live' then return jsonb_build_object('format', i.format, 'slug', i.slug); end if;
  if not v_preview and i.sent_at is not null and i.first_opened_at is null then
    update public.leader_drop_invites set first_opened_at = now() where id = i.id;
  end if;
  return jsonb_build_object(
    'format', 'live',
    'invite_id', case when v_preview then null else i.id end,
    'slug', i.slug,
    'preview', v_preview,
    'leader_name', i.leader_name,
    'title', i.title,
    'company', i.company,
    'linkedin', i.linkedin,
    'topic', i.topic,
    'recording_at', i.recording_at,
    'meeting_url', i.meeting_url,
    'questions', jsonb_build_array(i.question_1, i.question_2, i.question_3),
    'bio', i.guest_bio,
    'headshot', i.guest_headshot_url,
    'saved_at', i.guest_saved_at
  );
end $function$;

-- The live guest saves the details used to introduce them.
create or replace function public.ld_live_save(p_invite uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  i public.leader_drop_invites;
  v_name text; v_title text; v_company text; v_linkedin text; v_bio text; v_headshot text;
  v_first boolean;
begin
  select * into i from public.leader_drop_invites where id = p_invite for update;
  if not found or i.format <> 'live' then raise exception 'invalid_link'; end if;
  v_name     := coalesce(nullif(btrim(coalesce(p->>'name','')),''), i.leader_name);
  v_title    := nullif(btrim(coalesce(p->>'title','')),'');
  v_company  := nullif(btrim(coalesce(p->>'company','')),'');
  v_linkedin := nullif(btrim(coalesce(p->>'linkedin','')),'');
  v_bio      := nullif(btrim(coalesce(p->>'bio','')),'');
  v_headshot := nullif(p->>'headshot_url','');
  if v_title is null or v_company is null then raise exception 'missing_details'; end if;
  if char_length(v_name) > 120 or char_length(v_title) > 160 or char_length(v_company) > 160
     or char_length(coalesce(v_linkedin,'')) > 300 or char_length(coalesce(v_bio,'')) > 800 then
    raise exception 'too_long';
  end if;
  if v_linkedin is not null and v_linkedin !~* '^(https?://)?([a-z0-9-]+\.)?linkedin\.com/' then raise exception 'bad_linkedin'; end if;
  if v_headshot is not null and (left(v_headshot, 37) <> p_invite::text || '/'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'leader-drops' and o.name = v_headshot)) then
    raise exception 'missing_upload';
  end if;
  v_first := i.guest_saved_at is null;
  update public.leader_drop_invites set
    leader_name = v_name, title = v_title, company = v_company,
    linkedin = coalesce(v_linkedin, linkedin),
    guest_bio = v_bio,
    guest_headshot_url = coalesce(v_headshot, guest_headshot_url),
    guest_saved_at = now(),
    started_at = coalesce(started_at, now())
  where id = p_invite;
  perform public.ld_ping_to(
    case when v_first then 'Live guest details in' else 'Live guest updated details' end,
    v_name || ' (' || v_title || ', ' || v_company || ') ' ||
      case when v_first then 'added their details' else 'updated their details' end ||
      case when i.recording_at is not null then ' for ' || to_char(i.recording_at at time zone 'America/New_York', 'Dy Mon FMDD, FMHH12:MI AM') || ' ET' else '' end || '. Tap to view.',
    'https://launchpad-leader-drops.netlify.app/live/' || i.slug || '-preview');
  return jsonb_build_object('saved', true, 'first_name', split_part(v_name, ' ', 1));
end $function$;

revoke all on function public.ld_get_invite(text) from public, anon, authenticated;
grant execute on function public.ld_get_invite(text) to anon, authenticated;
revoke all on function public.ld_live_get(text) from public, anon, authenticated;
grant execute on function public.ld_live_get(text) to anon, authenticated;
revoke all on function public.ld_live_save(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ld_live_save(uuid, jsonb) to anon, authenticated;

-- A live guest can't submit a Leader Drop, so their open invite folder would stay
-- writable forever. Close it to uploads (headshot only) once the recording is a
-- week past.
create or replace function public.ld_invite_open(p_folder text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select case
    when p_folder is null or p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    else exists (select 1 from public.leader_drop_invites i
                 where i.id = p_folder::uuid and i.submitted_at is null
                   and (i.format = 'drop' or i.recording_at is null or i.recording_at > now() - interval '7 days'))
  end
$function$;
revoke all on function public.ld_invite_open(text) from public, anon, authenticated;
grant execute on function public.ld_invite_open(text) to anon, authenticated;

notify pgrst, 'reload schema';
