-- NOT auto-applied. Run this by hand on a branch, then regression-test the app.
--
-- Pinning SECURITY DEFINER functions to an empty search_path is the Supabase-
-- recommended posture and an explicit HECVAT 4 database-security question.
-- It is held out of the migrations directory on purpose: any function body that
-- references an unqualified table (`profiles` rather than `public.profiles`)
-- will start erroring the moment this runs. That is the point of the change,
-- but it must not happen unattended on a deploy.
--
-- Procedure: run this on a branch, exercise signup, posting, liking, commenting,
-- following, the roadmap generator, and the admin themes page. Fix each function
-- that breaks by schema-qualifying its references. Then promote.

-- ---------------------------------------------------------------------------
-- 1. search_path hardening
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER functions currently run with `search_path = public`, which
-- is still resolvable by a caller who can create objects in an earlier schema.
-- Pinning to an empty search_path and fully qualifying is the Supabase-
-- recommended posture and is an explicit HECVAT 4 database-security question.

alter function public.has_role(uuid, public.app_role)            set search_path = '';
alter function public.handle_new_user()                          set search_path = '';
alter function public.publish_theme(uuid)                        set search_path = '';
alter function public.action_completion_counts()                 set search_path = '';
alter function public.admin_theme_stats()                        set search_path = '';
alter function public.broadcast_active_theme()                   set search_path = '';
alter function public.journey_from_action_completion()           set search_path = '';
alter function public.journey_from_milestone_task()              set search_path = '';
alter function public.journey_from_action_step()                 set search_path = '';
alter function public.notify_on_follow()                         set search_path = '';
alter function public.notify_on_like()                           set search_path = '';
alter function public.notify_on_comment()                        set search_path = '';

-- NOTE: after running this, re-test the app. Any function body that referenced
-- an unqualified table (e.g. `profiles` instead of `public.profiles`) will now
-- error and must be rewritten with schema-qualified names. Do this on a branch.

