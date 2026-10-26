-- Database layout copied from Lovable Cloud (project whqllgoqtztzbdegrnby) on
-- Oct 25, 2026, for the Career Hub's own Supabase project (yvebvsgixedduxicjisv).
-- Generated from the live database, not from supabase/migrations, because the
-- Leader Drops tables were added by hand and never had migration files.
--
-- Differences from the live copy, on purpose:
--   * leader-drops bucket: 50 MB per file (the most Supabase's free plan allows;
--     Lovable Cloud allowed 500 MB). Largest video so far was 32 MB.
--   * ld_ping: the phone alert opens launchpad-leader-drops.netlify.app/admin
--     (it pointed at the site's old visionary-lolly address).
--   * broadcast_active_theme(): no longer callable by signed-out visitors (it is
--     only ever run from SQL).

SET check_function_bodies = off;
SET search_path = public, extensions;

-- ---- Extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---- Types
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.privacy_request_kind AS ENUM ('access', 'correction', 'deletion', 'portability', 'opt_out', 'appeal');
CREATE TYPE public.privacy_request_state AS ENUM ('received', 'in_progress', 'fulfilled', 'refused', 'appeal_upheld', 'appeal_denied');
CREATE TYPE public.report_reason AS ENUM ('harassment', 'hate_speech', 'sexual_content', 'violence_or_threats', 'self_harm', 'spam_or_scam', 'confidential_information', 'impersonation', 'other');
CREATE TYPE public.report_status AS ENUM ('open', 'actioned', 'dismissed');

-- ---- Tables
CREATE TABLE public.action_steps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  week_label text NOT NULL,
  content text NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_usage (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  feature text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.career_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  action_text text NOT NULL,
  why_text text,
  category text NOT NULL,
  effort_minutes smallint DEFAULT 10 NOT NULL,
  source text DEFAULT 'ai'::text NOT NULL,
  goal_id uuid,
  milestone_id uuid,
  theme_id uuid,
  offered_on date,
  status text DEFAULT 'pending'::text NOT NULL,
  completed_at timestamp with time zone,
  skipped_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.career_goals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  target_date date,
  focus_area text,
  blocker text,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.career_journey (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  completed_at timestamp with time zone DEFAULT now() NOT NULL,
  source text NOT NULL,
  ref_id uuid NOT NULL,
  theme_id uuid,
  milestone_id uuid,
  personalized boolean DEFAULT false NOT NULL,
  category text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.career_memory_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  occurred_on date DEFAULT CURRENT_DATE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  skill text,
  impact text,
  source text DEFAULT 'manual'::text NOT NULL,
  source_ref uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.coach_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.content_reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reporter_id uuid NOT NULL,
  post_id uuid,
  comment_id uuid,
  reported_user uuid,
  reason report_reason NOT NULL,
  detail text,
  status report_status DEFAULT 'open'::report_status NOT NULL,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  resolution_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.daily_checkins (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  checkin_on date DEFAULT CURRENT_DATE NOT NULL,
  mood smallint NOT NULL,
  note text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leader_drop_invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  leader_name text NOT NULL,
  leader_email text,
  note text,
  question_1 text DEFAULT 'What took you way too long to understand about building a successful career?'::text NOT NULL,
  question_2 text DEFAULT 'What career advice do you disagree with — and what would you tell someone instead?'::text NOT NULL,
  question_3 text DEFAULT 'If you were starting your career again tomorrow, what would you do differently?'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  first_opened_at timestamp with time zone,
  submitted_at timestamp with time zone,
  title text,
  company text,
  linkedin text,
  slug text NOT NULL,
  sent_at timestamp with time zone,
  started_at timestamp with time zone
);

CREATE TABLE public.leader_drop_nominations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  from_leader_id uuid,
  nominee_name text NOT NULL,
  nominee_contact text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.leader_drops (
  leader_id uuid DEFAULT gen_random_uuid() NOT NULL,
  invite_id uuid,
  name text NOT NULL,
  title text NOT NULL,
  company text NOT NULL,
  linkedin text,
  intro_name text,
  intro_line text,
  question_1 text NOT NULL,
  video_1_url text NOT NULL,
  question_2 text NOT NULL,
  video_2_url text NOT NULL,
  question_3 text NOT NULL,
  video_3_url text NOT NULL,
  one_drop text,
  one_drop_video_url text,
  headshot_url text,
  permission_granted boolean NOT NULL,
  permission_text text NOT NULL,
  permission_granted_at timestamp with time zone DEFAULT now() NOT NULL,
  submission_timestamp timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'Submitted'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  bio text
);

CREATE TABLE public.milestone_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  milestone_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.milestones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'upcoming'::text NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  archived boolean DEFAULT false NOT NULL
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  actor_id uuid,
  type text NOT NULL,
  post_id uuid,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.personalized_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  theme_id uuid,
  week_start date NOT NULL,
  action_text text NOT NULL,
  why_text text,
  milestone_id uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.post_reposts (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  topic text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.privacy_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  contact_email text NOT NULL,
  kind privacy_request_kind NOT NULL,
  state privacy_request_state DEFAULT 'received'::privacy_request_state NOT NULL,
  detail text,
  received_at timestamp with time zone DEFAULT now() NOT NULL,
  due_at timestamp with time zone DEFAULT (now() + '45 days'::interval) NOT NULL,
  closed_at timestamp with time zone,
  handler_note text
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  role text,
  industry text,
  years_experience integer,
  career_goal text,
  linkedin_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  avatar_url text,
  xp integer DEFAULT 0 NOT NULL,
  streak_days integer DEFAULT 0 NOT NULL,
  last_active_on date,
  terms_version_accepted text,
  privacy_version_accepted text,
  consent_accepted_at timestamp with time zone,
  ai_disclaimer_ack_at timestamp with time zone
);

CREATE TABLE public.subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'free'::text NOT NULL,
  plan text DEFAULT 'coach_monthly'::text NOT NULL,
  current_period_end timestamp with time zone,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_action_completions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  action_id uuid NOT NULL,
  completed_at timestamp with time zone DEFAULT now() NOT NULL,
  reflection text
);

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role DEFAULT 'user'::app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.videos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  guest_name text NOT NULL,
  guest_role text,
  topic text NOT NULL,
  description text,
  youtube_url text NOT NULL,
  thumbnail_url text,
  is_featured boolean DEFAULT false NOT NULL,
  duration text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.weekly_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  theme_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  difficulty text DEFAULT 'medium'::text NOT NULL,
  xp_reward integer DEFAULT 50 NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.weekly_themes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  subtitle text,
  episode_number integer,
  episode_url text,
  guest_name text,
  summary text DEFAULT ''::text NOT NULL,
  key_advice text[] DEFAULT '{}'::text[] NOT NULL,
  accent_color text,
  is_active boolean DEFAULT false NOT NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.xp_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  amount integer NOT NULL,
  reference_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---- Keys and checks
ALTER TABLE public.action_steps ADD CONSTRAINT action_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_pkey PRIMARY KEY (id);
ALTER TABLE public.career_goals ADD CONSTRAINT career_goals_pkey PRIMARY KEY (id);
ALTER TABLE public.career_journey ADD CONSTRAINT career_journey_pkey PRIMARY KEY (id);
ALTER TABLE public.career_memory_entries ADD CONSTRAINT career_memory_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.coach_messages ADD CONSTRAINT coach_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_pkey PRIMARY KEY (id);
ALTER TABLE public.follows ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.leader_drop_nominations ADD CONSTRAINT leader_drop_nominations_pkey PRIMARY KEY (id);
ALTER TABLE public.leader_drops ADD CONSTRAINT leader_drops_pkey PRIMARY KEY (leader_id);
ALTER TABLE public.milestone_tasks ADD CONSTRAINT milestone_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.milestones ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.personalized_actions ADD CONSTRAINT personalized_actions_pkey PRIMARY KEY (id);
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);
ALTER TABLE public.post_reposts ADD CONSTRAINT post_reposts_pkey PRIMARY KEY (post_id, user_id);
ALTER TABLE public.posts ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE public.privacy_requests ADD CONSTRAINT privacy_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_action_completions ADD CONSTRAINT user_action_completions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.videos ADD CONSTRAINT videos_pkey PRIMARY KEY (id);
ALTER TABLE public.weekly_actions ADD CONSTRAINT weekly_actions_pkey PRIMARY KEY (id);
ALTER TABLE public.weekly_themes ADD CONSTRAINT weekly_themes_pkey PRIMARY KEY (id);
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_pkey PRIMARY KEY (id);
ALTER TABLE public.career_journey ADD CONSTRAINT career_journey_unique_ref UNIQUE (user_id, source, ref_id);
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_user_id_checkin_on_key UNIQUE (user_id, checkin_on);
ALTER TABLE public.leader_drops ADD CONSTRAINT leader_drops_invite_id_key UNIQUE (invite_id);
ALTER TABLE public.personalized_actions ADD CONSTRAINT personalized_actions_user_week_key UNIQUE (user_id, week_start);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_action_completions ADD CONSTRAINT user_action_completions_user_id_action_id_key UNIQUE (user_id, action_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_category_check CHECK ((category = ANY (ARRAY['win'::text, 'project'::text, 'skill'::text, 'feedback'::text, 'leadership'::text, 'networking'::text, 'challenge'::text, 'decision'::text])));
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_effort_minutes_check CHECK ((effort_minutes > 0));
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_source_check CHECK ((source = ANY (ARRAY['ai'::text, 'template'::text, 'podcast'::text, 'sprint'::text])));
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'skipped'::text])));
ALTER TABLE public.career_goals ADD CONSTRAINT career_goals_focus_area_check CHECK ((focus_area = ANY (ARRAY['promotion'::text, 'career_change'::text, 'leadership'::text, 'compensation'::text, 'networking'::text, 'skill_development'::text, 'work_life_balance'::text, 'direction'::text])));
ALTER TABLE public.career_goals ADD CONSTRAINT career_goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'achieved'::text, 'abandoned'::text])));
ALTER TABLE public.career_journey ADD CONSTRAINT career_journey_source_check CHECK ((source = ANY (ARRAY['weekly_action'::text, 'personalized_action'::text, 'milestone_task'::text, 'manual_step'::text, 'coach_action'::text, 'content_action'::text])));
ALTER TABLE public.career_memory_entries ADD CONSTRAINT career_memory_entries_category_check CHECK ((category = ANY (ARRAY['win'::text, 'project'::text, 'skill'::text, 'feedback'::text, 'leadership'::text, 'networking'::text, 'challenge'::text, 'decision'::text])));
ALTER TABLE public.career_memory_entries ADD CONSTRAINT career_memory_entries_description_check CHECK ((length(description) <= 1000));
ALTER TABLE public.career_memory_entries ADD CONSTRAINT career_memory_entries_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'checkin'::text, 'coach'::text, 'action'::text, 'sprint'::text, 'onboarding'::text])));
ALTER TABLE public.career_memory_entries ADD CONSTRAINT career_memory_entries_title_check CHECK (((length(title) >= 1) AND (length(title) <= 120)));
ALTER TABLE public.coach_messages ADD CONSTRAINT coach_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])));
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_detail_check CHECK ((char_length(detail) <= 1000));
ALTER TABLE public.content_reports ADD CONSTRAINT one_target CHECK ((((((post_id IS NOT NULL))::integer + ((comment_id IS NOT NULL))::integer) + ((reported_user IS NOT NULL))::integer) = 1));
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_mood_check CHECK (((mood >= 1) AND (mood <= 5)));
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_note_check CHECK ((length(note) <= 1000));
ALTER TABLE public.follows ADD CONSTRAINT follows_check CHECK ((follower_id <> following_id));
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_company_check CHECK (((company IS NULL) OR (char_length(company) <= 160)));
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_leader_email_check CHECK (((leader_email IS NULL) OR (char_length(leader_email) <= 255)));
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_leader_name_check CHECK (((char_length(leader_name) >= 1) AND (char_length(leader_name) <= 120)));
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_linkedin_check CHECK (((linkedin IS NULL) OR (char_length(linkedin) <= 300)));
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));
ALTER TABLE public.leader_drop_invites ADD CONSTRAINT leader_drop_invites_title_check CHECK (((title IS NULL) OR (char_length(title) <= 160)));
ALTER TABLE public.leader_drop_nominations ADD CONSTRAINT leader_drop_nominations_nominee_contact_check CHECK (((char_length(nominee_contact) >= 3) AND (char_length(nominee_contact) <= 255)));
ALTER TABLE public.leader_drop_nominations ADD CONSTRAINT leader_drop_nominations_nominee_name_check CHECK (((char_length(nominee_name) >= 1) AND (char_length(nominee_name) <= 120)));
ALTER TABLE public.leader_drops ADD CONSTRAINT leader_drops_bio_check CHECK (((bio IS NULL) OR (char_length(bio) <= 600)));
ALTER TABLE public.leader_drops ADD CONSTRAINT leader_drops_permission_granted_check CHECK (permission_granted);
ALTER TABLE public.leader_drops ADD CONSTRAINT leader_drops_status_check CHECK ((status = ANY (ARRAY['Submitted'::text, 'Editing'::text, 'Scheduled'::text, 'Published'::text])));
ALTER TABLE public.leader_drops ADD CONSTRAINT one_drop_present CHECK (((one_drop IS NOT NULL) OR (one_drop_video_url IS NOT NULL)));
ALTER TABLE public.milestones ADD CONSTRAINT milestones_status_check CHECK ((status = ANY (ARRAY['done'::text, 'current'::text, 'upcoming'::text])));
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'milestone_earned'::text, 'weekly_action'::text])));
ALTER TABLE public.user_blocks ADD CONSTRAINT no_self_block CHECK ((blocker_id <> blocked_id));
ALTER TABLE public.weekly_actions ADD CONSTRAINT weekly_actions_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'stretch'::text])));
ALTER TABLE public.weekly_actions ADD CONSTRAINT weekly_actions_xp_reward_check CHECK (((xp_reward >= 0) AND (xp_reward <= 500)));
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_kind_check CHECK ((kind = ANY (ARRAY['task'::text, 'milestone'::text, 'step'::text, 'daily_checkin'::text, 'weekly_action'::text, 'personalized_action'::text, 'journey_entry'::text])));

-- ---- Links between tables
ALTER TABLE public.action_steps ADD CONSTRAINT action_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.career_goals(id) ON DELETE SET NULL;
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE SET NULL;
ALTER TABLE public.career_actions ADD CONSTRAINT career_actions_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.weekly_themes(id) ON DELETE SET NULL;
ALTER TABLE public.career_journey ADD CONSTRAINT career_journey_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE SET NULL;
ALTER TABLE public.career_journey ADD CONSTRAINT career_journey_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.weekly_themes(id) ON DELETE SET NULL;
ALTER TABLE public.career_journey ADD CONSTRAINT career_journey_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.coach_messages ADD CONSTRAINT coach_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_reported_user_fkey FOREIGN KEY (reported_user) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leader_drop_nominations ADD CONSTRAINT leader_drop_nominations_from_leader_id_fkey FOREIGN KEY (from_leader_id) REFERENCES public.leader_drops(leader_id) ON DELETE SET NULL;
ALTER TABLE public.leader_drops ADD CONSTRAINT leader_drops_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.leader_drop_invites(id) ON DELETE SET NULL;
ALTER TABLE public.milestone_tasks ADD CONSTRAINT milestone_tasks_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE CASCADE;
ALTER TABLE public.milestone_tasks ADD CONSTRAINT milestone_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.milestones ADD CONSTRAINT milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.personalized_actions ADD CONSTRAINT personalized_actions_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE SET NULL;
ALTER TABLE public.personalized_actions ADD CONSTRAINT personalized_actions_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.weekly_themes(id) ON DELETE SET NULL;
ALTER TABLE public.personalized_actions ADD CONSTRAINT personalized_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.post_reposts ADD CONSTRAINT post_reposts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_reposts ADD CONSTRAINT post_reposts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.privacy_requests ADD CONSTRAINT privacy_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_action_completions ADD CONSTRAINT user_action_completions_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.weekly_actions(id) ON DELETE CASCADE;
ALTER TABLE public.user_action_completions ADD CONSTRAINT user_action_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_actions ADD CONSTRAINT weekly_actions_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.weekly_themes(id) ON DELETE CASCADE;
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---- Indexes
CREATE INDEX action_steps_user_id_idx ON public.action_steps USING btree (user_id, order_index);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log USING btree (created_at DESC);
CREATE INDEX ai_usage_user_created_idx ON public.ai_usage USING btree (user_id, created_at DESC);
CREATE INDEX actions_date ON public.career_actions USING btree (user_id, offered_on DESC);
CREATE INDEX actions_status ON public.career_actions USING btree (user_id, status);
CREATE INDEX goals_owner ON public.career_goals USING btree (user_id);
CREATE UNIQUE INDEX one_active_career_goal ON public.career_goals USING btree (user_id) WHERE (status = 'active'::text);
CREATE INDEX career_journey_milestone_idx ON public.career_journey USING btree (milestone_id);
CREATE INDEX career_journey_theme_idx ON public.career_journey USING btree (theme_id);
CREATE INDEX career_journey_user_completed_idx ON public.career_journey USING btree (user_id, completed_at DESC);
CREATE INDEX memory_category ON public.career_memory_entries USING btree (user_id, category);
CREATE INDEX memory_date ON public.career_memory_entries USING btree (user_id, occurred_on DESC);
CREATE INDEX coach_messages_user_created_idx ON public.coach_messages USING btree (user_id, created_at);
CREATE INDEX comments_post_id_idx ON public.comments USING btree (post_id, created_at);
CREATE INDEX content_reports_status_idx ON public.content_reports USING btree (status, created_at DESC);
CREATE INDEX idx_follows_follower ON public.follows USING btree (follower_id);
CREATE INDEX idx_follows_following ON public.follows USING btree (following_id);
CREATE UNIQUE INDEX leader_drop_invites_slug_key ON public.leader_drop_invites USING btree (slug);
CREATE INDEX leader_drops_submitted_idx ON public.leader_drops USING btree (submission_timestamp DESC);
CREATE INDEX milestone_tasks_milestone_idx ON public.milestone_tasks USING btree (milestone_id, order_index);
CREATE INDEX milestones_user_archived_idx ON public.milestones USING btree (user_id, archived, order_index);
CREATE INDEX milestones_user_id_idx ON public.milestones USING btree (user_id, order_index);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX personalized_actions_user_week_idx ON public.personalized_actions USING btree (user_id, week_start DESC);
CREATE INDEX post_reposts_user_idx ON public.post_reposts USING btree (user_id);
CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at DESC);
CREATE INDEX posts_topic_idx ON public.posts USING btree (topic);
CREATE INDEX user_action_completions_user_idx ON public.user_action_completions USING btree (user_id);
CREATE INDEX weekly_actions_theme_idx ON public.weekly_actions USING btree (theme_id, sort_order);
CREATE INDEX weekly_themes_published_at_idx ON public.weekly_themes USING btree (published_at DESC NULLS LAST);
CREATE UNIQUE INDEX weekly_themes_single_active ON public.weekly_themes USING btree (is_active) WHERE is_active;
CREATE INDEX xp_events_user_created_idx ON public.xp_events USING btree (user_id, created_at DESC);

-- ---- Functions
CREATE OR REPLACE FUNCTION public.action_completion_counts(p_theme_id uuid)
 RETURNS TABLE(action_id uuid, completions bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.action_id, count(*)::bigint
    from public.user_action_completions c
    join public.weekly_actions a on a.id = c.action_id
   where a.theme_id = p_theme_id
   group by c.action_id;
$function$;

CREATE OR REPLACE FUNCTION public.admin_theme_stats()
 RETURNS TABLE(theme_id uuid, completions bigint, participants bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.theme_id, count(c.id)::bigint, count(distinct c.user_id)::bigint
    from public.weekly_actions a
    left join public.user_action_completions c on c.action_id = a.id
   where public.has_role(auth.uid(), 'admin')
   group by a.theme_id;
$function$;

CREATE OR REPLACE FUNCTION public.broadcast_active_theme()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_theme   public.weekly_themes%rowtype;
  v_action  text;
  v_count   integer;
begin
  select * into v_theme from public.weekly_themes where is_active limit 1;
  if v_theme.id is null then
    raise exception 'No active theme to announce';
  end if;

  select title into v_action
    from public.weekly_actions
   where theme_id = v_theme.id
   order by sort_order
   limit 1;

  -- one notification per profile per theme; re-running is a no-op
  insert into public.notifications (user_id, type, data)
  select p.id,
         'weekly_action',
         jsonb_build_object(
           'title',    v_theme.title,
           'subtitle', v_theme.subtitle,
           'action',   v_action,
           'theme_id', v_theme.id
         )
    from public.profiles p
   where not exists (
     select 1 from public.notifications n
      where n.user_id = p.id
        and n.type = 'weekly_action'
        and n.data->>'theme_id' = v_theme.id::text
   );

  get diagnostics v_count = row_count;
  return v_count;
end $function$;

CREATE OR REPLACE FUNCTION public.career_record_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'Owner cannot change'; END IF;
 IF TG_TABLE_NAME='career_actions' THEN
  IF NEW.goal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.career_goals WHERE id=NEW.goal_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Invalid goal'; END IF;
  IF NEW.milestone_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.milestones WHERE id=NEW.milestone_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Invalid milestone'; END IF;
 ELSIF TG_TABLE_NAME IN ('career_goals','career_memory_entries') THEN NEW.updated_at=now();
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.finish_checkin_extraction(p_user uuid, p_id uuid, p_note text, p_entries jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.daily_checkins; e jsonb; result jsonb='[]'::jsonb; mid uuid;
BEGIN
 SELECT * INTO c FROM public.daily_checkins WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF c.id IS NULL OR c.note IS DISTINCT FROM p_note OR c.processed_at IS NOT NULL THEN RETURN result; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LIMIT 3 LOOP
  IF NOT EXISTS(SELECT 1 FROM public.career_memory_entries WHERE user_id=p_user AND source='checkin' AND source_ref=p_id AND lower(title)=lower(e->>'title')) THEN
   INSERT INTO public.career_memory_entries(user_id,occurred_on,title,description,category,skill,impact,source,source_ref)
   VALUES(p_user,c.checkin_on,e->>'title',e->>'description',e->>'category',e->>'skill',e->>'impact','checkin',p_id) RETURNING id INTO mid;
   result=result || jsonb_build_array(jsonb_build_object('id',mid,'title',e->>'title'));
  END IF;
 END LOOP;
 UPDATE public.daily_checkins SET processed_at=now() WHERE id=p_id AND user_id=p_user;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m_id UUID;
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$function$;

CREATE OR REPLACE FUNCTION public.journey_from_action_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.career_journey
     WHERE user_id = OLD.user_id AND source = 'weekly_action' AND ref_id = OLD.action_id;
    RETURN OLD;
  END IF;

  SELECT id, title, description, theme_id INTO a
    FROM public.weekly_actions WHERE id = NEW.action_id;
  IF a.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.career_journey (user_id, title, description, completed_at, source, ref_id, theme_id)
  VALUES (NEW.user_id, a.title, a.description, NEW.completed_at, 'weekly_action', NEW.action_id, a.theme_id)
  ON CONFLICT (user_id, source, ref_id) DO UPDATE
    SET title = EXCLUDED.title, completed_at = EXCLUDED.completed_at;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.journey_from_action_step()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.career_journey
     WHERE user_id = OLD.user_id AND source = 'manual_step' AND ref_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.completed THEN
    INSERT INTO public.career_journey (user_id, title, description, completed_at, source, ref_id)
    VALUES (NEW.user_id, NEW.content, NEW.week_label, now(), 'manual_step', NEW.id)
    ON CONFLICT (user_id, source, ref_id) DO UPDATE SET title = EXCLUDED.title;
  ELSE
    DELETE FROM public.career_journey
     WHERE user_id = NEW.user_id AND source = 'manual_step' AND ref_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.journey_from_milestone_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.career_journey
     WHERE user_id = OLD.user_id AND source = 'milestone_task' AND ref_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.completed THEN
    INSERT INTO public.career_journey (user_id, title, completed_at, source, ref_id, milestone_id)
    VALUES (NEW.user_id, NEW.title, now(), 'milestone_task', NEW.id, NEW.milestone_id)
    ON CONFLICT (user_id, source, ref_id) DO UPDATE SET title = EXCLUDED.title;
  ELSE
    DELETE FROM public.career_journey
     WHERE user_id = NEW.user_id AND source = 'milestone_task' AND ref_id = NEW.id;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.ld_get_invite(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not v_preview and i.sent_at is not null and i.first_opened_at is null then
    update public.leader_drop_invites set first_opened_at = now() where id = i.id;
  end if;
  return jsonb_build_object(
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

CREATE OR REPLACE FUNCTION public.ld_invite_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.slug is null or new.slug = '' then new.slug := public.ld_make_slug(new.leader_name); end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.ld_invite_open(p_folder text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_folder is null or p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    else exists (select 1 from public.leader_drop_invites i
                 where i.id = p_folder::uuid and i.submitted_at is null)
  end
$function$;

CREATE OR REPLACE FUNCTION public.ld_make_slug(p_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  base text;
  s text;
  chars constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  b bytea;
  suffix text;
begin
  base := trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'));
  base := coalesce(nullif(left(base, 40), ''), 'leader');
  base := trim(both '-' from base);
  loop
    b := extensions.gen_random_bytes(6);
    suffix := '';
    for k in 0..5 loop
      suffix := suffix || substr(chars, 1 + (get_byte(b, k) % length(chars)), 1);
    end loop;
    s := base || '-' || suffix;
    exit when not exists (select 1 from public.leader_drop_invites where slug = s);
  end loop;
  return s;
end $function$;

CREATE OR REPLACE FUNCTION public.ld_mark_started(p_invite uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.leader_drop_invites
     set started_at = now()
   where id = p_invite and started_at is null and submitted_at is null and sent_at is not null;
$function$;

CREATE OR REPLACE FUNCTION public.ld_nominate(p_invite uuid, p_leader uuid, p_name text, p_contact text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.leader_drops where leader_id = p_leader and invite_id = p_invite) then
    raise exception 'invalid_link';
  end if;
  if (select count(*) from public.leader_drop_nominations where from_leader_id = p_leader) >= 10 then
    raise exception 'limit_reached';
  end if;
  insert into public.leader_drop_nominations (from_leader_id, nominee_name, nominee_contact)
  values (p_leader, btrim(p_name), btrim(p_contact));
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.ld_notify_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.ld_ping('New Leader Drop',
    new.name || ' (' || new.title || ', ' || new.company || ') just submitted. Tap to watch.');
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.ld_ping(p_title text, p_message text, p_priority integer DEFAULT 4)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare rid bigint;
begin
  select net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object(
      'topic', 'launchpad-drops-9e4f4c2f22f52da4',
      'title', p_title,
      'message', p_message,
      'tags', jsonb_build_array('microphone'),
      'priority', p_priority,
      'click', 'https://launchpad-leader-drops.netlify.app/admin'),
    headers := '{"Content-Type":"application/json"}'::jsonb
  ) into rid;
  return rid;
exception when others then
  return null; -- never block a submission because an alert failed
end $function$;

CREATE OR REPLACE FUNCTION public.ld_submit(p_invite uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  v_paths := array[p->>'video_1_url', p->>'video_2_url', p->>'video_3_url'];
  if v_one_drop_video is not null then v_paths := v_paths || v_one_drop_video; end if;
  if v_headshot is not null then v_paths := v_paths || v_headshot; end if;
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
    permission_granted, permission_text
  ) values (
    p_invite, v_name, v_title, v_company, v_linkedin,
    left(coalesce(nullif(btrim(coalesce(p->>'intro_name','')),''), v_name), 120),
    left(coalesce(nullif(btrim(coalesce(p->>'intro_line','')),''), v_title || ' • ' || v_company), 240),
    v_bio,
    i.question_1, v_paths[1], i.question_2, v_paths[2], i.question_3, v_paths[3],
    v_one_drop, v_one_drop_video, v_headshot,
    true, left(coalesce(p->>'permission_text',''), 2000)
  ) returning leader_id into v_id;

  update public.leader_drop_invites
     set submitted_at = now(), started_at = coalesce(started_at, now())
   where id = p_invite;
  return jsonb_build_object('leader_id', v_id, 'first_name', split_part(v_name, ' ', 1));
end $function$;

CREATE OR REPLACE FUNCTION public.ld_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at := now(); return new; end $function$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE author uuid;
BEGIN
  SELECT user_id INTO author FROM public.posts WHERE id = NEW.post_id;
  IF author IS NOT NULL AND author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id, data)
    VALUES (author, NEW.user_id, 'comment', NEW.post_id, jsonb_build_object('preview', left(NEW.content, 140)));
  END IF;
  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.notify_on_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE author uuid;
BEGIN
  SELECT user_id INTO author FROM public.posts WHERE id = NEW.post_id;
  IF author IS NOT NULL AND author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (author, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF current_user IN ('authenticated','anon') AND (NEW.xp IS DISTINCT FROM OLD.xp OR NEW.streak_days IS DISTINCT FROM OLD.streak_days OR NEW.last_active_on IS DISTINCT FROM OLD.last_active_on) THEN RAISE EXCEPTION 'Progress is managed by verified server operations'; END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.publish_theme(p_theme_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can publish a theme';
  end if;
  update public.weekly_themes set is_active = false where is_active and id <> p_theme_id;
  update public.weekly_themes
     set is_active = true, published_at = coalesce(published_at, now())
   where id = p_theme_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_daily_checkin(p_date date, p_mood smallint, p_note text)
 RETURNS daily_checkins
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE result public.daily_checkins;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 INSERT INTO public.daily_checkins(user_id,checkin_on,mood,note) VALUES(auth.uid(),p_date,p_mood,p_note)
 ON CONFLICT(user_id,checkin_on) DO UPDATE SET mood=excluded.mood,note=excluded.note,processed_at=CASE WHEN daily_checkins.note IS DISTINCT FROM excluded.note THEN NULL ELSE daily_checkins.processed_at END
 RETURNING * INTO result;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.sync_career_goal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='profiles' THEN
  IF TG_OP='UPDATE' AND NEW.career_goal IS NOT DISTINCT FROM OLD.career_goal THEN RETURN NULL; END IF;
  IF nullif(btrim(NEW.career_goal),'') IS NULL THEN
   UPDATE public.career_goals SET status='abandoned',updated_at=now() WHERE user_id=NEW.id AND status='active';
  ELSE
   INSERT INTO public.career_goals(user_id,title) VALUES(NEW.id,btrim(NEW.career_goal)) ON CONFLICT(user_id) WHERE status='active' DO UPDATE SET title=excluded.title,updated_at=now();
  END IF;
 ELSE
  IF TG_OP='DELETE' THEN uid=OLD.user_id; ELSE uid=NEW.user_id; END IF;
  UPDATE public.profiles SET career_goal=(SELECT title FROM public.career_goals WHERE user_id=uid AND status='active'),updated_at=now() WHERE id=uid;
 END IF;
 RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.verified_xp(p_kind text, p_ref uuid, p_revoke boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid=auth.uid(); done boolean; reward integer; balance integer; delta integer; oldxp integer; newxp integer; streak integer; lastday date; increased boolean=false;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 IF p_kind='task' THEN SELECT completed INTO done FROM public.milestone_tasks WHERE id=p_ref AND user_id=uid; reward=10;
 ELSIF p_kind='step' THEN SELECT completed INTO done FROM public.action_steps WHERE id=p_ref AND user_id=uid; reward=25;
 ELSIF p_kind='milestone' THEN
  SELECT (m.status='done' AND EXISTS(SELECT 1 FROM public.milestone_tasks t WHERE t.milestone_id=m.id AND t.user_id=uid) AND NOT EXISTS(SELECT 1 FROM public.milestone_tasks t WHERE t.milestone_id=m.id AND (NOT t.completed OR t.user_id<>uid))) INTO done FROM public.milestones m WHERE m.id=p_ref AND m.user_id=uid; reward=100;
 ELSIF p_kind='daily_checkin' THEN SELECT true INTO done FROM public.daily_checkins WHERE id=p_ref AND user_id=uid AND checkin_on=current_date; reward=5;
 ELSE RAISE EXCEPTION 'Invalid award kind'; END IF;
 IF done IS NULL THEN RAISE EXCEPTION 'Referenced activity not found'; END IF;
 IF (p_revoke AND done) OR (NOT p_revoke AND NOT done) THEN RAISE EXCEPTION 'Activity state does not match award'; END IF;
 SELECT xp,streak_days,last_active_on INTO oldxp,streak,lastday FROM public.profiles WHERE id=uid FOR UPDATE;
 IF oldxp IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
 SELECT coalesce(sum(amount),0) INTO balance FROM public.xp_events WHERE user_id=uid AND kind=p_kind AND reference_id=p_ref;
 IF p_kind='daily_checkin' AND EXISTS(SELECT 1 FROM public.xp_events WHERE user_id=uid AND kind=p_kind AND created_at>=current_date AND amount>0) THEN balance=reward; END IF;
 delta=CASE WHEN p_revoke THEN -greatest(balance,0) ELSE greatest(reward-balance,0) END;
 newxp=greatest(0,oldxp+delta);
 IF delta<>0 THEN
  IF delta>0 AND lastday IS DISTINCT FROM current_date THEN streak=CASE WHEN lastday=current_date-1 THEN streak+1 ELSE 1 END; increased=true; END IF;
  UPDATE public.profiles SET xp=newxp,streak_days=streak,last_active_on=CASE WHEN delta>0 THEN current_date ELSE last_active_on END,updated_at=now() WHERE id=uid;
  INSERT INTO public.xp_events(user_id,kind,amount,reference_id) VALUES(uid,p_kind,delta,p_ref);
 END IF;
 RETURN jsonb_build_object('leveledUp',floor(sqrt(newxp/50.0))>floor(sqrt(oldxp/50.0)),'leveledDown',floor(sqrt(newxp/50.0))<floor(sqrt(oldxp/50.0)),'newLevel',floor(sqrt(newxp/50.0))+1,'newXp',newxp,'streakIncreased',increased,'newStreak',streak);
END $function$;

-- ---- Triggers
CREATE TRIGGER trg_journey_action_step AFTER INSERT OR DELETE OR UPDATE ON public.action_steps FOR EACH ROW EXECUTE FUNCTION public.journey_from_action_step();
CREATE TRIGGER career_action_guard BEFORE INSERT OR UPDATE ON public.career_actions FOR EACH ROW EXECUTE FUNCTION public.career_record_guard();
CREATE TRIGGER career_goal_guard BEFORE INSERT OR UPDATE ON public.career_goals FOR EACH ROW EXECUTE FUNCTION public.career_record_guard();
CREATE TRIGGER career_goal_sync AFTER INSERT OR DELETE OR UPDATE ON public.career_goals FOR EACH ROW EXECUTE FUNCTION public.sync_career_goal();
CREATE TRIGGER career_memory_guard BEFORE INSERT OR UPDATE ON public.career_memory_entries FOR EACH ROW EXECUTE FUNCTION public.career_record_guard();
CREATE TRIGGER trg_notify_on_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();
CREATE TRIGGER trg_notify_on_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();
CREATE TRIGGER ld_invite_slug BEFORE INSERT ON public.leader_drop_invites FOR EACH ROW EXECUTE FUNCTION public.ld_invite_before_insert();
CREATE TRIGGER ld_notify AFTER INSERT ON public.leader_drops FOR EACH ROW EXECUTE FUNCTION public.ld_notify_submission();
CREATE TRIGGER ld_touch BEFORE UPDATE ON public.leader_drops FOR EACH ROW EXECUTE FUNCTION public.ld_touch_updated_at();
CREATE TRIGGER trg_journey_milestone_task AFTER INSERT OR DELETE OR UPDATE ON public.milestone_tasks FOR EACH ROW EXECUTE FUNCTION public.journey_from_milestone_task();
CREATE TRIGGER trg_notify_on_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();
CREATE TRIGGER profile_goal_sync AFTER INSERT OR UPDATE OF career_goal ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_career_goal();
CREATE TRIGGER protect_profile_progress BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_progress();
CREATE TRIGGER trg_journey_action_completion AFTER INSERT OR DELETE ON public.user_action_completions FOR EACH ROW EXECUTE FUNCTION public.journey_from_action_completion();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---- Row-level security
ALTER TABLE public.action_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_drop_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_drop_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalized_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_action_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users delete own action steps" ON public.action_steps AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own action steps" ON public.action_steps AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users update own action steps" ON public.action_steps AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users view own action steps" ON public.action_steps AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "admins append audit log" ON public.admin_audit_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND (auth.uid() = actor_id)));
CREATE POLICY "admins read audit log" ON public.admin_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own ai usage select" ON public.ai_usage AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY action_owner ON public.career_actions AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY goal_owner ON public.career_goals AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "own journey delete" ON public.career_journey AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own journey insert" ON public.career_journey AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "own journey select" ON public.career_journey AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own journey update" ON public.career_journey AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY memory_owner ON public.career_memory_entries AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users delete own coach messages" ON public.coach_messages AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own coach messages" ON public.coach_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users view own coach messages" ON public.coach_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Comments viewable by authenticated" ON public.comments AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT (EXISTS ( SELECT 1
   FROM user_blocks b
  WHERE ((b.blocker_id = auth.uid()) AND (b.blocked_id = comments.user_id))))));
CREATE POLICY "Users delete own comments" ON public.comments AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own comments" ON public.comments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "admins manage reports" ON public.content_reports AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "users file own reports" ON public.content_reports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = reporter_id));
CREATE POLICY "users read own reports" ON public.content_reports AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = reporter_id));
CREATE POLICY checkin_owner ON public.daily_checkins AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Follows viewable by authenticated" ON public.follows AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users delete own follows" ON public.follows AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = follower_id));
CREATE POLICY "Users insert own follows" ON public.follows AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY "ld admin all" ON public.leader_drop_invites AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ld admin all" ON public.leader_drop_nominations AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ld admin all" ON public.leader_drops AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users delete own milestone tasks" ON public.milestone_tasks AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own milestone tasks" ON public.milestone_tasks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users update own milestone tasks" ON public.milestone_tasks AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users view own milestone tasks" ON public.milestone_tasks AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users delete own milestones" ON public.milestones AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own milestones" ON public.milestones AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users update own milestones" ON public.milestones AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users view own milestones" ON public.milestones AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users delete own notifications" ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users view own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own personalized delete" ON public.personalized_actions AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own personalized insert" ON public.personalized_actions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "own personalized select" ON public.personalized_actions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own personalized update" ON public.personalized_actions AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Likes viewable by authenticated" ON public.post_likes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users delete own likes" ON public.post_likes AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own likes" ON public.post_likes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Reposts viewable by authenticated" ON public.post_reposts AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users delete own reposts" ON public.post_reposts AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own reposts" ON public.post_reposts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Posts viewable by authenticated" ON public.posts AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT (EXISTS ( SELECT 1
   FROM user_blocks b
  WHERE ((b.blocker_id = auth.uid()) AND (b.blocked_id = posts.user_id))))));
CREATE POLICY "Users delete own posts" ON public.posts AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own posts" ON public.posts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users update own posts" ON public.posts AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "admins manage privacy requests" ON public.privacy_requests AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "users file own privacy requests" ON public.privacy_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "users read own privacy requests" ON public.privacy_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Users view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Users view own subscription" ON public.subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own completions delete" ON public.user_action_completions AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own completions insert" ON public.user_action_completions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "own completions select" ON public.user_action_completions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "own completions update" ON public.user_action_completions AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "users manage own blocks" ON public.user_blocks AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = blocker_id)) WITH CHECK ((auth.uid() = blocker_id));
CREATE POLICY "admins manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins read all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "read own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Videos viewable by authenticated" ON public.videos AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "actions readable by authenticated" ON public.weekly_actions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage actions" ON public.weekly_actions AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins manage themes" ON public.weekly_themes AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "themes readable by authenticated" ON public.weekly_themes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users view own xp events" ON public.xp_events AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- ---- Who can call which function
REVOKE ALL ON FUNCTION public.action_completion_counts(p_theme_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.action_completion_counts(p_theme_id uuid) TO PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_theme_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_theme_stats() TO PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_active_theme() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.career_record_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_checkin_extraction(p_user uuid, p_id uuid, p_note text, p_entries jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_from_action_completion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_from_action_step() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journey_from_milestone_task() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_get_invite(p_code text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_get_invite(p_code text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_invite_before_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_invite_before_insert() TO PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_invite_open(p_folder text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_invite_open(p_folder text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_make_slug(p_name text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_mark_started(p_invite uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_mark_started(p_invite uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_nominate(p_invite uuid, p_leader uuid, p_name text, p_contact text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_nominate(p_invite uuid, p_leader uuid, p_name text, p_contact text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_notify_submission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_ping(p_title text, p_message text, p_priority integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_submit(p_invite uuid, p jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_submit(p_invite uuid, p jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.ld_touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ld_touch_updated_at() TO PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_theme(p_theme_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_theme(p_theme_id uuid) TO PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_daily_checkin(p_date date, p_mood smallint, p_note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_daily_checkin(p_date date, p_mood smallint, p_note text) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_career_goal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verified_xp(p_kind text, p_ref uuid, p_revoke boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verified_xp(p_kind text, p_ref uuid, p_revoke boolean) TO authenticated;

-- ---- Tables signed-out visitors can't read
REVOKE SELECT ON public.comments FROM anon;
REVOKE SELECT ON public.follows FROM anon;
REVOKE SELECT ON public.post_likes FROM anon;
REVOKE SELECT ON public.post_reposts FROM anon;
REVOKE SELECT ON public.posts FROM anon;
REVOKE SELECT ON public.videos FROM anon;

-- ---- File storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('leader-drops', 'leader-drops', false, 52428800,
  '{video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp,image/jpeg,image/png,image/webp,image/heic,image/heif}'::text[])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars viewable by authenticated" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Users delete own avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users update own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users upload own avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "ld admin delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'leader-drops'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "ld admin read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'leader-drops'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "ld leaders read own open invite" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated, anon USING (((bucket_id = 'leader-drops'::text) AND public.ld_invite_open((storage.foldername(name))[1])));
CREATE POLICY "ld leaders upload to open invite" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated, anon WITH CHECK (((bucket_id = 'leader-drops'::text) AND public.ld_invite_open((storage.foldername(name))[1])));

-- ---- Live updates (the notification bell)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
