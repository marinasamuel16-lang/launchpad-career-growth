-- Bonus question for live interviews.
-- Leader Drops already end with an optional bonus question whose answer goes to
-- Career Hub members first (member_bonuses). Live interviews can now carry one
-- too: it shows on the guest's /live page so they can think ahead, the host asks
-- it at the end of the call, and the clip is published from the Career Hub
-- admin (Extras → Bonus answers) the same way.

-- 1. The guest's page gets the bonus question (null when there isn't one).
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
    'bonus_question', nullif(btrim(coalesce(i.bonus_question, '')), ''),
    'bio', i.guest_bio,
    'headshot', i.guest_headshot_url,
    'saved_at', i.guest_saved_at
  );
end $function$;

revoke all on function public.ld_live_get(text) from public, anon, authenticated;
grant execute on function public.ld_live_get(text) to anon, authenticated;

-- 2. A members' bonus can come from a live interview instead of a Leader Drop.
alter table public.member_bonuses
  add column if not exists invite_id uuid references public.leader_drop_invites(id) on delete set null;
create unique index if not exists member_bonuses_invite_key
  on public.member_bonuses (invite_id) where invite_id is not null;
