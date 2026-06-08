
-- Profiles: restrict to authenticated
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Milestones: owner-only
DROP POLICY IF EXISTS "Milestones viewable by everyone" ON public.milestones;
CREATE POLICY "Users view own milestones"
  ON public.milestones FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Milestone tasks: owner-only
DROP POLICY IF EXISTS "Milestone tasks viewable by everyone" ON public.milestone_tasks;
CREATE POLICY "Users view own milestone tasks"
  ON public.milestone_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Action steps: owner-only
DROP POLICY IF EXISTS "Action steps viewable by everyone" ON public.action_steps;
CREATE POLICY "Users view own action steps"
  ON public.action_steps FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Avatars storage: owner-only direct read (signed URLs still work)
DROP POLICY IF EXISTS "Avatars are viewable by signed-in users" ON storage.objects;
CREATE POLICY "Users view own avatar"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- xp_events: remove client insert; server-only via service role
DROP POLICY IF EXISTS "Users insert own xp events" ON public.xp_events;

-- Realtime: only allow subscribing to own notif-<uid> topic
DROP POLICY IF EXISTS "Users subscribe own notification channel" ON realtime.messages;
CREATE POLICY "Users subscribe own notification channel"
  ON realtime.messages FOR SELECT TO authenticated
  USING (realtime.topic() = ('notif-' || auth.uid()::text));
