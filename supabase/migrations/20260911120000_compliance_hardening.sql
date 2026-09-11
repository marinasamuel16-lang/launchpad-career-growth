-- ============================================================================
-- LaunchPad EIC — compliance hardening migration
-- Prepared 2026-09-11 for higher-education procurement readiness.
--
-- Apply as: supabase/migrations/20260911000000_compliance_hardening.sql
--
-- What this does:
--   1. Adds content reporting + user blocking (required by any university
--      reviewing a user-generated-content platform).
--   2. Adds an immutable admin audit log.
--   3. Adds consent-record columns so you can prove, per user, which version
--      of the Terms and Privacy Policy they accepted and when.
--   4. Adds a privacy-request log (access / correction / deletion / appeal)
--      so NJDPA response deadlines are evidenced rather than asserted.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2. Content reporting and user blocking
-- ---------------------------------------------------------------------------

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

create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.content_reports (
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
  -- exactly one target
  constraint one_target check (
    (post_id is not null)::int + (comment_id is not null)::int + (reported_user is not null)::int = 1
  )
);

create index content_reports_status_idx  on public.content_reports (status, created_at desc);
create index content_reports_reporter_idx on public.content_reports (reporter_id);

alter table public.content_reports enable row level security;

create policy "users file own reports"
  on public.content_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "users read own reports"
  on public.content_reports for select to authenticated
  using (auth.uid() = reporter_id);

create policy "admins manage reports"
  on public.content_reports for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "users manage own blocks"
  on public.user_blocks for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- Hide blocked users' content from the feed. Existing SELECT policies are
-- replaced so the block is enforced in the database, not just the UI.
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
-- 3. Admin audit log
-- ---------------------------------------------------------------------------
-- HECVAT 4 and every campus security review ask whether privileged actions are
-- logged and whether the log can be altered by the person who generated it.
-- Insert-only for admins, no update or delete policy at all.

create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admins read audit log"
  on public.admin_audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "admins append audit log"
  on public.admin_audit_log for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role) and auth.uid() = actor_id);

-- deliberately no UPDATE or DELETE policy: the log is append-only to
-- non-superusers, which is the property a reviewer is actually asking about.

-- ---------------------------------------------------------------------------
-- 4. Consent records
-- ---------------------------------------------------------------------------
-- Today the signup checkbox gates the button but nothing is persisted, so there
-- is no way to prove what a given user agreed to. These columns fix that.

alter table public.profiles
  add column if not exists terms_version_accepted   text,
  add column if not exists privacy_version_accepted text,
  add column if not exists consent_accepted_at      timestamptz,
  add column if not exists ai_disclaimer_ack_at     timestamptz;

comment on column public.profiles.terms_version_accepted is
  'Version string (e.g. "2026-09-11") of the Terms of Service the user accepted at signup or at re-consent.';

-- ---------------------------------------------------------------------------
-- 5. Privacy-request log
-- ---------------------------------------------------------------------------
-- NJDPA gives consumers access / correction / deletion / portability rights,
-- a 45-day response clock, and a right to APPEAL a refusal. The appeal right is
-- the part most small vendors miss. Logging requests is how you evidence the
-- clock was met.

create type public.privacy_request_kind as enum (
  'access', 'correction', 'deletion', 'portability', 'opt_out', 'appeal'
);

create type public.privacy_request_state as enum (
  'received', 'in_progress', 'fulfilled', 'refused', 'appeal_upheld', 'appeal_denied'
);

create table public.privacy_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  contact_email text not null,
  kind         public.privacy_request_kind not null,
  state        public.privacy_request_state not null default 'received',
  detail       text,
  received_at  timestamptz not null default now(),
  due_at       timestamptz not null default (now() + interval '45 days'),
  closed_at    timestamptz,
  handler_note text
);

create index privacy_requests_due_idx on public.privacy_requests (state, due_at);

alter table public.privacy_requests enable row level security;

create policy "users read own privacy requests"
  on public.privacy_requests for select to authenticated
  using (auth.uid() = user_id);

create policy "users file own privacy requests"
  on public.privacy_requests for insert to authenticated
  with check (auth.uid() = user_id);

create policy "admins manage privacy requests"
  on public.privacy_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- 5. Carry consent metadata from signup into the profile
-- ---------------------------------------------------------------------------
-- The signup form now sends terms/privacy versions and timestamps in
-- raw_user_meta_data. Without this, they would sit in auth.users and never
-- reach the profiles columns added above. Body is otherwise unchanged from the
-- existing function — only the INSERT into public.profiles is extended.

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
