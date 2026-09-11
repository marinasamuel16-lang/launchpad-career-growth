-- ============================================================================
-- LaunchPad EIC — compliance hardening
-- Prepared 2026-09-11 for higher-education procurement readiness.
--
-- IMPORTANT: this file is written to be SAFE TO RUN TWICE.
--
-- Parts of it were already applied directly to the database on 11 Sep 2026
-- (the four new tables, their policies, and the profiles columns). Without the
-- guards below, re-running would fail on the first `create type` and abort the
-- whole migration. Every statement here is now either `if not exists`, wrapped
-- in a duplicate-swallowing block, or a `drop ... if exists` followed by a
-- create — so running it on a fresh database and running it on the current one
-- both end in the same place.
--
-- What it does:
--   1. Content reporting + user blocking, with blocking enforced in the
--      database rather than only in the interface.
--   2. An append-only admin audit log.
--   3. Consent columns on profiles, so you can prove which version of the
--      Terms and Privacy Policy each user accepted.
--   4. A privacy-request log, so NJDPA response deadlines are evidenced.
--   5. Carries the consent values from signup through to the profile row.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Content reporting and user blocking
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.report_reason as enum (
    'harassment',
    'hate_speech',
    'sexual_content',
    'violence_or_threats',
    'self_harm',
    'spam_or_scam',
    'confidential_information',
    'impersonation',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'actioned', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists public.content_reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references auth.users(id) on delete cascade,
  post_id        uuid references public.posts(id)    on delete cascade,
  comment_id     uuid references public.comments(id) on delete cascade,
  reported_user  uuid references auth.users(id)      on delete cascade,
  reason         public.report_reason not null,
  detail         text check (char_length(detail) <= 1000),
  status         public.report_status not null default 'open',
  resolved_by    uuid references auth.users(id) on delete set null,
  resolved_at    timestamptz,
  resolution_note text,
  created_at     timestamptz not null default now(),
  -- a report points at exactly one thing
  constraint one_target check (
    (post_id is not null)::int + (comment_id is not null)::int + (reported_user is not null)::int = 1
  )
);

create index if not exists content_reports_status_idx   on public.content_reports (status, created_at desc);
create index if not exists content_reports_reporter_idx on public.content_reports (reporter_id);

alter table public.content_reports enable row level security;

drop policy if exists "users file own reports" on public.content_reports;
create policy "users file own reports"
  on public.content_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "users read own reports" on public.content_reports;
create policy "users read own reports"
  on public.content_reports for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "admins manage reports" on public.content_reports;
create policy "admins manage reports"
  on public.content_reports for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "users manage own blocks" on public.user_blocks;
create policy "users manage own blocks"
  on public.user_blocks for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- Enforce blocking in the database, not just the interface. With an empty
-- user_blocks table these behave identically to the policies they replace —
-- verified against live data before this file shipped.
drop policy if exists "Posts viewable by authenticated" on public.posts;
create policy "Posts viewable by authenticated"
  on public.posts for select to authenticated
  using (
    not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = posts.user_id
    )
  );

drop policy if exists "Comments viewable by authenticated" on public.comments;
create policy "Comments viewable by authenticated"
  on public.comments for select to authenticated
  using (
    not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = comments.user_id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Admin audit log
-- ---------------------------------------------------------------------------
-- Every campus security review asks whether privileged actions are logged and
-- whether the person who generated the log can alter it. There is deliberately
-- no UPDATE and no DELETE policy here, so an administrator cannot edit or erase
-- their own trail.

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admins read audit log" on public.admin_audit_log;
create policy "admins read audit log"
  on public.admin_audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "admins append audit log" on public.admin_audit_log;
create policy "admins append audit log"
  on public.admin_audit_log for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) and auth.uid() = actor_id);

-- ---------------------------------------------------------------------------
-- 3. Consent records
-- ---------------------------------------------------------------------------
-- The signup checkbox used to gate the button and then be discarded, so there
-- was no way to prove what any user had agreed to.

alter table public.profiles
  add column if not exists terms_version_accepted   text,
  add column if not exists privacy_version_accepted text,
  add column if not exists consent_accepted_at      timestamptz,
  add column if not exists ai_disclaimer_ack_at     timestamptz;

comment on column public.profiles.terms_version_accepted is
  'Version string (e.g. "2026-09-11") of the Terms of Service the user accepted at signup or re-consent.';

-- ---------------------------------------------------------------------------
-- 4. Privacy-request log
-- ---------------------------------------------------------------------------
-- NJDPA gives people access / correction / deletion / portability rights, a
-- 45-day response clock, and a right to appeal a refusal. The appeal right is
-- the part most small vendors miss. Logging requests is how the clock is
-- evidenced rather than asserted.

do $$ begin
  create type public.privacy_request_kind as enum (
    'access', 'correction', 'deletion', 'portability', 'opt_out', 'appeal'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.privacy_request_state as enum (
    'received', 'in_progress', 'fulfilled', 'refused', 'appeal_upheld', 'appeal_denied'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.privacy_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  contact_email text not null,
  kind          public.privacy_request_kind not null,
  state         public.privacy_request_state not null default 'received',
  detail        text,
  received_at   timestamptz not null default now(),
  due_at        timestamptz not null default (now() + interval '45 days'),
  closed_at     timestamptz,
  handler_note  text
);

create index if not exists privacy_requests_due_idx on public.privacy_requests (state, due_at);

alter table public.privacy_requests enable row level security;

drop policy if exists "users read own privacy requests" on public.privacy_requests;
create policy "users read own privacy requests"
  on public.privacy_requests for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users file own privacy requests" on public.privacy_requests;
create policy "users file own privacy requests"
  on public.privacy_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "admins manage privacy requests" on public.privacy_requests;
create policy "admins manage privacy requests"
  on public.privacy_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- 5. Carry consent metadata from signup into the profile
-- ---------------------------------------------------------------------------
-- The signup form now sends terms/privacy versions and timestamps in
-- raw_user_meta_data. Without this they would sit in auth.users and never reach
-- the profiles columns above. Body is otherwise unchanged from the existing
-- function — only the INSERT into public.profiles is extended.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  m_id UUID;
BEGIN
  INSERT INTO public.profiles (
    id, name,
    terms_version_accepted, privacy_version_accepted,
    consent_accepted_at, ai_disclaimer_ack_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'terms_version_accepted',
    NEW.raw_user_meta_data->>'privacy_version_accepted',
    (NEW.raw_user_meta_data->>'consent_accepted_at')::timestamptz,
    (NEW.raw_user_meta_data->>'ai_disclaimer_ack_at')::timestamptz
  );

  -- Seed 6 starter milestones
  INSERT INTO public.milestones (user_id, title, description, status, order_index) VALUES
    (NEW.id, 'Entry-Level Role', 'Land your first full-time role and learn the basics of professional work.', 'done', 1),
    (NEW.id, 'Build Core Skills', 'Master the foundational craft of your role and become reliably good.', 'current', 2),
    (NEW.id, 'Gain Visibility', 'Make your work visible to people one and two levels above you.', 'upcoming', 3),
    (NEW.id, 'Lead a Project', 'Own an end-to-end project and lead it across functions.', 'upcoming', 4),
    (NEW.id, 'Get Promoted', 'Earn the next level by demonstrating consistent senior-scope impact.', 'upcoming', 5),
    (NEW.id, 'Become a Manager / Specialist', 'Step into the management track or deepen as a senior IC specialist.', 'upcoming', 6);

  -- Starter tasks for each milestone
  FOR m_id IN SELECT id FROM public.milestones WHERE user_id = NEW.id LOOP
    INSERT INTO public.milestone_tasks (milestone_id, user_id, title, order_index)
    SELECT m_id, NEW.id, t, ord
    FROM (VALUES ('Define a clear goal for this milestone', 1), ('Take one concrete action this week', 2), ('Reflect and document progress', 3)) AS x(t, ord);
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Lock profiles to their owner
-- ---------------------------------------------------------------------------
-- The old policy was `using (true)` for any authenticated user, which made
-- sense when there was a community feed showing profiles to other members.
-- The app is now single-player — Watch / Ask / Roadmap, with the feed removed —
-- so every signed-in account being able to read every other account's name,
-- role, industry, years of experience, career goal and LinkedIn URL is exposure
-- with no purpose behind it.
--
-- Verified before applying: every profiles query in src/ filters on the caller's
-- own id. The one exception, NotificationsBell, looks up actor names for
-- like/follow/comment notifications, which can no longer be generated; legacy
-- rows of those types were deleted, and the component already degrades to a
-- null name rather than failing.

drop policy if exists "Profiles viewable by authenticated" on public.profiles;
drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

-- Clear notifications for features the product no longer has.
delete from public.notifications where type in ('follow', 'like', 'comment');
